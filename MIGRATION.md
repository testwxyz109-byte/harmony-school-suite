# Migration Guide: Supabase → MySQL + Local Docker

This document lists **every file** you need to touch to move this project off Supabase
onto a self-hosted MySQL database with email/password auth, runnable locally via Docker.

---

## 1. Files to DELETE

These are Supabase-specific and have no MySQL equivalent:

```
src/integrations/supabase/client.ts
src/integrations/supabase/client.server.ts
src/integrations/supabase/auth-middleware.ts
src/integrations/supabase/types.ts
supabase/                         # entire folder (config.toml + migrations/)
```

Also remove the dependency:
```bash
bun remove @supabase/supabase-js
```

---

## 2. New dependencies to ADD

```bash
bun add mysql2 bcryptjs jsonwebtoken cookie zod
bun add -d @types/bcryptjs @types/jsonwebtoken @types/cookie
```

- `mysql2` — MySQL driver (with promise API)
- `bcryptjs` — password hashing
- `jsonwebtoken` — session JWTs
- `cookie` — parse/serialize cookies
- `zod` — input validation

---

## 3. New files to CREATE

### Database connection (`src/server/db.server.ts`)
A `mysql2/promise` connection pool reading `process.env.DATABASE_URL`.

### Schema (`src/server/schema.sql`)
Already provided in this project at the same path — full MySQL translation
of every Postgres table. Auto-loaded by Docker on first DB start.

### Auth layer
```
src/server/auth.server.ts          // bcrypt + JWT helpers, role checks
src/server/auth-middleware.ts      // TanStack middleware: cookie -> user/roles
src/routes/api/auth/login.ts       // POST email+password -> set httpOnly cookie
src/routes/api/auth/signup.ts      // POST -> create user (first = admin enabled, rest disabled)
src/routes/api/auth/logout.ts      // POST -> clear cookie
src/routes/api/auth/me.ts          // GET -> current profile + roles
```

### File storage (replaces Supabase Storage buckets `avatars`, `school-assets`, `student-photos`)
```
src/routes/api/upload.ts           // POST multipart -> save under UPLOAD_DIR/{bucket}/...
src/routes/api/files/$.ts          // GET -> stream a file
```
Store the resulting URL (`/api/files/student-photos/abc.jpg`) in the DB instead
of the Supabase public URL.

### Per-resource server functions (replaces all `supabase.from(...)` calls)
Create one file per table group, e.g.:
```
src/server/students.functions.ts
src/server/academic.functions.ts
src/server/finance.functions.ts
src/server/attendance.functions.ts
src/server/exams.functions.ts
src/server/expenses.functions.ts
src/server/payroll.functions.ts
src/server/transport.functions.ts
src/server/users.functions.ts
src/server/announcements.functions.ts
src/server/settings.functions.ts
src/server/results.functions.ts    // public results lookup
```
Each exports `createServerFn` wrappers (list/create/update/delete) and enforces
role checks server-side using helpers from `auth.server.ts`.

---

## 4. Files to MODIFY

| File | What changes |
|---|---|
| `.env` | Remove all `VITE_SUPABASE_*` and `SUPABASE_*`. Add `DATABASE_URL`, `JWT_SECRET`, `UPLOAD_DIR`. See `.env.example`. |
| `src/hooks/useAuth.tsx` | Remove `supabase.auth.*`. Replace with `fetch('/api/auth/me')` on mount + a `signOut` that POSTs `/api/auth/logout`. Drop `onAuthStateChange` (no equivalent — just rely on cookie + revalidation on route change). |
| `src/routes/login.tsx` | Replace `supabase.auth.signInWithPassword(...)` with `fetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })`. On success → call `refreshProfile()` then navigate. |
| `src/routes/signup.tsx` | Replace `supabase.auth.signUp(...)` with `fetch('/api/auth/signup', ...)`. Already email/password only — no Google to remove. |
| `src/components/AppLayout.tsx` | The `signOut` call already goes through `useAuth`; once `useAuth` is updated nothing else here needs changing. |

### Every `_app/*.tsx` route file
All call `import { supabase } from "@/integrations/supabase/client"` and run
`.from("table").select/insert/update/delete`. Replace each with a call to
the matching server function:

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
```

Mechanical example:
```ts
// BEFORE
const { data } = await supabase.from("students").select("*").order("created_at", { ascending: false });

// AFTER
import { listStudents } from "@/server/students.functions";
const { data } = await listStudents();
```

For uploads:
```ts
// BEFORE
await supabase.storage.from("student-photos").upload(path, file);
const { data: { publicUrl } } = supabase.storage.from("student-photos").getPublicUrl(path);

// AFTER
const fd = new FormData();
fd.append("file", file);
fd.append("bucket", "student-photos");
const res = await fetch("/api/upload", { method: "POST", body: fd });
const { url } = await res.json();   // store this in students.photo_url
```

### Realtime
`dashboard.tsx` and `announcements.tsx` use `supabase.channel(...).on('postgres_changes', ...)`.
MySQL has no realtime. Replace with polling:
```ts
useEffect(() => {
  const t = setInterval(load, 10_000);
  return () => clearInterval(t);
}, []);
```

---

## 5. Schema differences (Postgres → MySQL)

The translated schema is in `src/server/schema.sql`. Key changes:

| Postgres | MySQL |
|---|---|
| `uuid` + `gen_random_uuid()` | `CHAR(36)` + `UUID()` default |
| `text` | `TEXT` (or `VARCHAR(255)` when indexed) |
| `timestamp with time zone` | `DATETIME(3)` (UTC) |
| `boolean` | `TINYINT(1)` |
| `numeric` | `DECIMAL(12,2)` |
| `int[]` | `JSON` |
| Postgres `ENUM` types (`app_role`, etc.) | MySQL `ENUM(...)` inline |
| RLS policies | **Dropped** — enforced in server functions instead |
| DB functions/triggers (`has_role`, `handle_new_user`, `generate_student_code`, `check_attendance_date`) | Re-implemented in `auth.server.ts` and resource server functions |

### Things to re-implement in code (used to be DB triggers):
1. **First-user-is-admin** → in `/api/auth/signup`: if `SELECT COUNT(*) FROM profiles = 0`, set `enabled=1` and insert `user_roles` row with `role='admin'`. Otherwise `enabled=0`, `role='teacher'`.
2. **Student code generation** → in `students.functions.ts` `createStudent`: read `school_settings.student_id_prefix` + `student_id_padding`, find max existing numeric suffix, increment.
3. **Attendance date guard** → in `attendance.functions.ts` `markAttendance`: reject if `date > today`.

---

## 6. Permissions (replaces Row-Level Security)

Postgres RLS guaranteed that even a buggy frontend couldn't read other rows.
With MySQL **every server function must validate the caller**. Add to
`src/server/auth.server.ts`:

```ts
export function requireAdmin(roles: AppRole[]) {
  if (!roles.includes("admin")) throw new Response("Forbidden", { status: 403 });
}
export function requireAdminOrSub(roles: AppRole[]) {
  if (!roles.some(r => r === "admin" || r === "sub_admin"))
    throw new Response("Forbidden", { status: 403 });
}
export function requireEnabled(profile: { enabled: boolean }) {
  if (!profile.enabled) throw new Response("Account disabled", { status: 403 });
}
```

Use them at the top of every server function handler.

---

## 7. Docker — running locally

Files at the project root (already created):

- `Dockerfile` — multi-stage build (Bun → Node runtime)
- `docker-compose.yml` — `mysql` + `app` + `adminer` services
- `.dockerignore`
- `.env.example`

### Run
```bash
cp .env.example .env       # adjust passwords / JWT_SECRET
docker compose up --build
```
Then open:
- App: http://localhost:3000
- DB UI (Adminer): http://localhost:8080  (server: `mysql`, user/pass from `.env`)

The MySQL container auto-runs `src/server/schema.sql` on first start.
Uploads persist in the `uploads_data` named volume.

---

## 8. Caveats

1. **No RLS** — every server function MUST check roles. A missed check is a security hole.
2. **File storage is local disk.** Fine for dev / single-server deploys; for multi-instance production swap to S3/R2.
3. **No realtime.** Polling only.
4. **No password reset / email verification** — Supabase handled these. Add SMTP (e.g. nodemailer) if you need them.
5. **Cloudflare Worker target** is no longer used — Docker runs Node. You may want to remove `wrangler.jsonc` and the `cloudflare` plugin from `vite.config.ts` if it causes build issues; standard TanStack Start Node output works fine.
