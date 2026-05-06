# Migration Plan: Supabase → MySQL + Docker

This is a **large refactor**. The current app uses Supabase for: database (Postgres + RLS), auth (JWT), and storage (3 buckets). MySQL has none of these built-in, so we replace each piece with a custom backend layer running inside TanStack Start server functions.

---

## Part 1 — Files & Places That Need Changes

### A. Files to DELETE (Supabase-specific)
```
src/integrations/supabase/client.ts
src/integrations/supabase/client.server.ts
src/integrations/supabase/auth-middleware.ts
src/integrations/supabase/types.ts
supabase/                          (entire folder: config.toml + migrations)
```

### B. Files to REPLACE (auth + data layer)
| File | Change |
|---|---|
| `src/hooks/useAuth.tsx` | Drop `supabase.auth.*`. Use a new `/api/auth/*` fetch-based session (httpOnly cookie). |
| `src/routes/login.tsx` | Replace `supabase.auth.signInWithPassword` with `POST /api/auth/login`. |
| `src/routes/signup.tsx` | Replace `supabase.auth.signUp` with `POST /api/auth/signup`. Remove Google references (none present — good). |
| `.env` | Remove `VITE_SUPABASE_*`. Add `DATABASE_URL`, `JWT_SECRET`, `UPLOAD_DIR`. |

### C. Every route file that imports `supabase` — rewrite data calls
All ~15 files do `import { supabase } from "@/integrations/supabase/client"` and call `.from("table").select/insert/update/delete`. Each needs to call new server functions instead:

```
src/routes/_app/dashboard.tsx
src/routes/_app/students.tsx
src/routes/_app/academic.tsx
src/routes/_app/subjects.tsx
src/routes/_app/users.tsx
src/routes/_app/announcements.tsx
src/routes/_app/attendance.tsx
src/routes/_app/finance.tsx
src/routes/_app/exams.tsx
src/routes/_app/expenses.tsx
src/routes/_app/payroll.tsx
src/routes/_app/transport.tsx
src/routes/_app/publish.tsx
src/routes/_app/settings.tsx
src/routes/results.tsx
src/components/AppLayout.tsx       (signOut)
```

Two approaches — pick one:
- **Server functions** (`createServerFn`) per resource: `src/server/students.functions.ts`, etc. Component code calls them like `await listStudents()`. Type-safe, RPC-style.
- **REST endpoints** under `src/routes/api/` that the client calls with `fetch`. Simpler if you want to consume from non-React clients later.

Plan recommends **server functions** to minimise component changes.

### D. NEW files to create

**Database layer**
```
src/server/db.server.ts             // mysql2/promise pool from DATABASE_URL
src/server/schema.sql               // full MySQL schema (translated from Postgres)
src/server/seed.sql                 // optional initial data
```

**Auth layer (replaces Supabase Auth)**
```
src/server/auth.server.ts           // bcrypt hashing, JWT sign/verify, session cookie
src/server/auth-middleware.ts       // createMiddleware: parse cookie → user + roles
src/routes/api/auth/login.ts        // POST email+password → set httpOnly cookie
src/routes/api/auth/signup.ts       // POST → create user (first = admin, rest disabled)
src/routes/api/auth/logout.ts       // POST → clear cookie
src/routes/api/auth/me.ts           // GET → current user + profile + roles
```

**Storage layer (replaces Supabase Storage)**
```
src/routes/api/upload.ts            // POST multipart → save to /app/uploads/{bucket}/...
src/routes/api/files/$.ts           // GET → stream file from /app/uploads
```
Buckets to support: `avatars`, `school-assets`, `student-photos`. Store relative paths in DB; serve via `/api/files/{bucket}/{filename}`.

**Permissions (replaces RLS)**
RLS lives in Postgres; MySQL has no equivalent. Every server function must call `requireRole(user, ["admin","sub_admin"])` etc. before reading/writing. The existing `src/lib/permissions.ts` stays and is used **server-side** now (currently it is only client-side gating, which is not security).

### E. Schema translation notes (Postgres → MySQL)
- `uuid` → `CHAR(36)` with default `(UUID())` or generate in app code.
- `gen_random_uuid()` → app-side `crypto.randomUUID()` or MySQL `UUID()`.
- `text` → `TEXT` / `VARCHAR(255)` where indexed.
- `timestamp with time zone` → `DATETIME(3)` (UTC convention) or `TIMESTAMP`.
- `boolean` → `TINYINT(1)`.
- `numeric` → `DECIMAL(12,2)`.
- `ARRAY` (e.g. `non_school_weekdays int[]`) → `JSON`.
- `USER-DEFINED` enums (`app_role`, attendance shifts, exam term/kind) → MySQL `ENUM(...)`.
- All RLS policies → **dropped**; replaced by server-side checks.
- DB functions (`has_role`, `is_admin`, `handle_new_user`, `generate_student_code`, `check_attendance_date`) → re-implement in `src/server/auth.server.ts` and resource modules.
- Triggers (auto-create profile on signup, generate student code, block future-dated attendance) → re-implement in the signup endpoint and `students` / `attendance` server functions.

### F. Realtime
Current code uses Supabase Realtime in dashboard/announcements. MySQL has no realtime. Options:
1. Replace with simple polling (`useQuery` + `refetchInterval`). Recommended for simplicity.
2. Add a websocket layer later. Out of scope for this plan.

---

## Part 2 — Docker Setup

### Files to create at project root
```
Dockerfile
docker-compose.yml
.dockerignore
.env.example
```

### `docker-compose.yml` (services)
- **mysql** — `mysql:8.4`, named volume `mysql_data`, port `3306`, env `MYSQL_DATABASE=school`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`. Mount `src/server/schema.sql` to `/docker-entrypoint-initdb.d/` for auto-init.
- **app** — built from `Dockerfile`, depends_on mysql (healthcheck), exposes `3000`, env `DATABASE_URL=mysql://user:pass@mysql:3306/school`, `JWT_SECRET`, `UPLOAD_DIR=/app/uploads`. Named volume `uploads_data` mounted at `/app/uploads`.
- **adminer** *(optional)* — DB UI on port `8080`.

### `Dockerfile` (multi-stage)
1. **deps** — `oven/bun:1` → copy `package.json`, `bun.lockb` → `bun install --frozen-lockfile`.
2. **build** — copy source → `bun run build` (TanStack Start production build).
3. **runtime** — `node:20-alpine` (or `oven/bun:1-slim`) → copy `.output` (or build artifacts) → `EXPOSE 3000` → `CMD ["node", ".output/server/index.mjs"]` (exact path depends on TanStack Start build output; verify after first build).

### `.dockerignore`
```
node_modules
.output
.vinxi
dist
.git
.env
*.log
```

### Local run
```bash
cp .env.example .env       # edit secrets
docker compose up --build
# app: http://localhost:3000
# adminer: http://localhost:8080
```

---

## Part 3 — Dependencies

Add: `mysql2`, `bcryptjs`, `jsonwebtoken`, `cookie`, `zod` (already present?), `@types/bcryptjs`, `@types/jsonwebtoken`, `@types/cookie`.
Remove: `@supabase/supabase-js`.

---

## Part 4 — Caveats / Things You Should Know

1. **No RLS safety net.** With Supabase, even a buggy frontend couldn't bypass row security. With MySQL, every server function MUST validate the caller. I'll add `requireAdmin` / `requireAdminOrSub` / `requireEnabled` helpers and use them everywhere.
2. **File storage is local disk** (`/app/uploads` volume). Fine for local Docker; for production you'd swap to S3/R2.
3. **No realtime.** Dashboard/announcements switch to polling.
4. **Cloudflare Worker target removed.** Docker runs Node, so we drop the Worker-specific Vite config concerns. `vite.config.ts` may need `target: "node"` adjustment.
5. **Email verification / password reset** — Supabase handled these. Out of scope unless you want me to wire up SMTP (nodemailer) too. Currently signup just creates a disabled account that admin approves.
6. **Migration of existing data** — none assumed; you'll start with an empty MySQL DB. If you have existing Supabase data to export, that's a separate task.
7. **Heavy rewrite scope.** ~16 route files + new server layer + schema + Docker = big diff. I'll do it in one shot but it's a lot of mechanical change.

---

## Execution order (when you approve)

1. Add deps, write `.env.example`, `Dockerfile`, `docker-compose.yml`, `.dockerignore`.
2. Write MySQL `schema.sql` + `db.server.ts` connection pool.
3. Write auth server (`auth.server.ts`, middleware, `/api/auth/*` routes).
4. Write storage routes (`/api/upload`, `/api/files/$`).
5. Write per-resource server functions (students, academic, finance, attendance, exams, expenses, payroll, transport, users, announcements, settings, results).
6. Rewrite `useAuth`, `login`, `signup`, `AppLayout` signOut.
7. Rewrite each `_app/*.tsx` route to call server functions instead of `supabase`.
8. Delete `src/integrations/supabase/*` and `supabase/` folder.
9. Verify `docker compose up --build` boots clean.

Reply **approve** to proceed, or tell me what to change (e.g. "use REST not server functions", "add nodemailer for password reset", "use Postgres in Docker instead of MySQL", "skip Docker", "only do the Docker part now").
