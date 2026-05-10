# Migration Plan: Supabase → SQLite + Express + Node + Docker

Replace the Supabase backend with a separate **Express + Node.js** API server backed by **SQLite** (file-based, zero-config), keep the existing TanStack Start frontend, and ship both via Docker for production.

---

## Architecture

```text
┌────────────────────────┐        ┌──────────────────────────┐
│  Frontend (TanStack)   │  HTTP  │  Express API (Node 20)   │
│  Vite build → Nginx    │ ─────> │  /api/auth, /api/...     │
│  Container: web        │        │  Container: api          │
└────────────────────────┘        │  ├─ better-sqlite3       │
                                  │  ├─ bcryptjs + JWT       │
                                  │  └─ multer (uploads)     │
                                  └────────────┬─────────────┘
                                               │
                                  ┌────────────┴─────────────┐
                                  │  Volumes (persistent)    │
                                  │  ├─ /data/app.db (SQLite)│
                                  │  └─ /data/uploads        │
                                  └──────────────────────────┘
```

Two containers behind one network. SQLite + uploads live on a named Docker volume so data survives restarts/redeploys.

---

## Part 1 — Backend (new `server/` folder at project root)

```
server/
├── package.json              # separate from frontend; only API deps
├── tsconfig.json
├── src/
│   ├── index.ts              # express app, CORS, JSON, cookie-parser, routes mount
│   ├── db.ts                 # better-sqlite3 connection + migration runner
│   ├── schema.sql            # SQLite translation of current Postgres schema
│   ├── auth/
│   │   ├── jwt.ts            # sign/verify JWT, httpOnly cookie helpers
│   │   ├── hash.ts           # bcryptjs wrappers
│   │   └── middleware.ts     # requireAuth, requireRole(['admin'])
│   ├── routes/
│   │   ├── auth.routes.ts        # POST /signup /login /logout, GET /me
│   │   ├── students.routes.ts
│   │   ├── academic.routes.ts
│   │   ├── subjects.routes.ts
│   │   ├── users.routes.ts
│   │   ├── announcements.routes.ts
│   │   ├── attendance.routes.ts
│   │   ├── finance.routes.ts
│   │   ├── exams.routes.ts
│   │   ├── expenses.routes.ts
│   │   ├── payroll.routes.ts
│   │   ├── transport.routes.ts
│   │   ├── settings.routes.ts
│   │   ├── results.routes.ts     # public results lookup
│   │   └── upload.routes.ts      # multer → /data/uploads/{bucket}/...
│   └── lib/
│       ├── permissions.ts        # mirrors src/lib/permissions.ts (server-side)
│       └── validators.ts         # zod schemas per route
└── Dockerfile
```

**Dependencies:** `express`, `better-sqlite3`, `bcryptjs`, `jsonwebtoken`, `cookie-parser`, `cors`, `multer`, `zod`, `helmet`, `compression`, `morgan`, `dotenv` + `@types/*`.

**Key choices:**
- **better-sqlite3** (synchronous, fastest, battle-tested) over `sqlite3`.
- **WAL mode** enabled at boot for concurrent reads.
- **httpOnly + Secure + SameSite=Lax cookie** holds the JWT.
- **First-signup-is-admin** logic in the signup handler (mirrors current behavior).
- **No RLS** — every route handler calls `requireRole(...)` before queries.
- **Triggers re-implemented in JS:** student-code generation, attendance future-date guard.
- **Schema translation:** UUIDs → `TEXT` (generated with `crypto.randomUUID()`), enums → `TEXT CHECK(... IN (...))`, `JSON` columns stored as `TEXT` and parsed in app code, timestamps as ISO strings.

---

## Part 2 — Frontend changes

Keep TanStack Start, but strip all Supabase usage.

### Files to DELETE
```
src/integrations/supabase/         (entire folder)
supabase/                          (entire folder)
.env  (Supabase vars)
```

### Files to REPLACE
| File | Change |
|---|---|
| `src/lib/api.ts` (NEW) | Thin `fetch` wrapper: `api.get/post/put/delete`, sends `credentials: 'include'`, base URL from `VITE_API_URL`. |
| `src/hooks/useAuth.tsx` | `signIn` → `POST /api/auth/login`; `signOut` → `POST /api/auth/logout`; on mount → `GET /api/auth/me`. Drop Supabase listeners. |
| `src/routes/login.tsx` | Use `api.post('/auth/login', ...)`. |
| `src/routes/signup.tsx` | Use `api.post('/auth/signup', ...)`. Already email/password. |
| `src/components/AppLayout.tsx` | No change needed once `useAuth` is updated. |

### Every `_app/*.tsx` route + `results.tsx`
Replace each `supabase.from('table').select/insert/update/delete` with `api.get/post/put/delete('/table', ...)`. Mechanical 1:1 swap. Replace `supabase.storage.from(bucket).upload(...)` with `FormData` POST to `/api/upload`.

### Realtime
Dashboard + announcements switch from `supabase.channel(...)` to `useQuery({ refetchInterval: 10_000 })`.

### Build
- Drop Cloudflare Worker target from `vite.config.ts` and remove `wrangler.jsonc`.
- Frontend builds to static assets served by **Nginx** in the `web` container.
- `VITE_API_URL` baked at build time (defaults to `/api` so Nginx proxies same-origin).

---

## Part 3 — Docker (production ready)

### Files at project root
```
Dockerfile.web          # multi-stage: bun build → nginx:alpine
Dockerfile.api          # multi-stage: node 20 build → node 20-alpine runtime
docker-compose.yml      # web + api + named volume for /data
nginx.conf              # serves SPA, proxies /api → api:4000, gzip, caching
.dockerignore
.env.example
```

### `docker-compose.yml` (services)
- **api** — built from `Dockerfile.api`, exposes `4000` (internal), env: `JWT_SECRET`, `DATABASE_PATH=/data/app.db`, `UPLOAD_DIR=/data/uploads`, `NODE_ENV=production`. Volume `app_data:/data`. Restart `unless-stopped`. Healthcheck on `/api/health`.
- **web** — built from `Dockerfile.web`, exposes `80` → host `3000`. Nginx serves static SPA and proxies `/api/*` to `api:4000`. Depends on `api` healthy.

No DB container — SQLite is just a file in the `app_data` volume.

### Production hardening included
- `helmet` + strict CORS on API
- Rate limiting on `/api/auth/*` (`express-rate-limit`)
- httpOnly+Secure+SameSite cookies, `JWT_SECRET` from env (min 32 chars)
- Non-root user in both Dockerfiles
- Multi-stage builds → small final images
- SQLite WAL + automatic on-startup migrations
- Daily backup script (`scripts/backup.sh`) that copies `app.db` to `/data/backups/` (cron-friendly)
- Nginx: gzip, long cache for hashed assets, no-cache for `index.html`
- Logging via `morgan` → stdout (Docker collects)
- Graceful shutdown (SIGTERM → close server → close DB)

### Local run
```bash
cp .env.example .env        # set JWT_SECRET
docker compose up --build   # → http://localhost:3000
```

---

## Part 4 — Caveats

1. **SQLite single-writer** — fine for one app instance. Do not horizontally scale the `api` service; scale vertically. For multi-instance, switch to Postgres (the route layer is designed to make that swap easy).
2. **No RLS safety net** — every route handler must call role checks. Plan adds a `requireRole` middleware applied per route.
3. **File storage on local volume** — works for single-host deploys. Swap multer storage for S3/R2 if you go multi-host.
4. **No realtime** — polling only.
5. **No password reset / email verification** out of scope unless you want SMTP wired up too (say the word and I'll add nodemailer).
6. **Heavy mechanical rewrite** — ~16 frontend route files + a new Express server. I'll do it in one pass.

---

## Execution order (when you approve)

1. Scaffold `server/` (package.json, tsconfig, Dockerfile, schema.sql, db.ts, index.ts).
2. Implement auth routes + middleware + JWT/bcrypt helpers.
3. Implement per-resource Express routes with role checks + zod validation.
4. Implement `/api/upload` (multer) and static serving of uploaded files.
5. Add `src/lib/api.ts` on the frontend; rewrite `useAuth`, `login`, `signup`.
6. Rewrite each `_app/*.tsx` and `results.tsx` to use `api.*` instead of `supabase`.
7. Swap realtime calls for polling.
8. Delete `src/integrations/supabase/`, `supabase/`, drop CF Worker config.
9. Write `Dockerfile.web`, `Dockerfile.api`, `nginx.conf`, `docker-compose.yml`, `.dockerignore`, `.env.example`, `scripts/backup.sh`.
10. Verify `docker compose up --build` boots clean and signup → login → CRUD works end-to-end.

Reply **approve** to proceed, or tell me what to change (e.g. "add nodemailer for password reset", "use Postgres instead of SQLite", "single Dockerfile not two", "skip Nginx, serve frontend from Express").
