// Supabase-compatible translator.
// Re-exports a `supabase` object whose .from(table), .auth.*, .storage.from(bucket)
// chains have the same shape as @supabase/supabase-js but talk to our Express API.
//
// This lets the existing route files keep working without rewriting every
// .select/.insert/.update/.delete chain. Realtime channels are no-ops.

import { api, query, uploadFile } from "@/lib/api";

type Filter = { col: string; op: string; val: unknown };
interface QueryState {
  table: string;
  select: string;
  filters: Filter[];
  order: { col: string; asc?: boolean }[];
  limit: number | null;
  count: "exact" | null;
  head: boolean;
  publicRead?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Result = { data: any; error: any; count: any };

function makeBuilder(initial: QueryState, op: "select" | "insert" | "update" | "delete", values?: unknown) {
  const state: QueryState = { ...initial };
  const opVal = op;
  const valuesArg: unknown = values;
  let single: "single" | "maybeSingle" | null = null;

  const exec = async (): Promise<Result> => {
    const body: Record<string, unknown> = {
      table: state.table,
      op: opVal,
      filters: state.filters,
    };
    if (opVal === "select") {
      body.select = state.select;
      body.order = state.order;
      if (state.limit) body.limit = state.limit;
      if (single) body.single = single;
      if (state.count) body.count = state.count;
      if (state.head) body.head = state.head;
    } else if (opVal === "insert" || opVal === "update") {
      body.values = valuesArg;
      if (state.count) body.count = state.count;
    }
    const r = await query(body, { publicRead: state.publicRead });
    return { data: r.data, error: r.error, count: r.count };
  };

  const builder: Record<string, unknown> = {
    eq: (col: string, val: unknown) => { state.filters.push({ col, op: "eq", val }); return builder; },
    neq: (col: string, val: unknown) => { state.filters.push({ col, op: "neq", val }); return builder; },
    gt:  (col: string, val: unknown) => { state.filters.push({ col, op: "gt",  val }); return builder; },
    gte: (col: string, val: unknown) => { state.filters.push({ col, op: "gte", val }); return builder; },
    lt:  (col: string, val: unknown) => { state.filters.push({ col, op: "lt",  val }); return builder; },
    lte: (col: string, val: unknown) => { state.filters.push({ col, op: "lte", val }); return builder; },
    is:  (col: string, val: unknown) => { state.filters.push({ col, op: "is",  val }); return builder; },
    in:  (col: string, val: unknown) => { state.filters.push({ col, op: "in",  val }); return builder; },
    like:  (col: string, val: unknown) => { state.filters.push({ col, op: "like",  val }); return builder; },
    ilike: (col: string, val: unknown) => { state.filters.push({ col, op: "ilike", val }); return builder; },
    order: (col: string, opts?: { ascending?: boolean }) => {
      state.order.push({ col, asc: opts?.ascending !== false }); return builder;
    },
    limit: (n: number) => { state.limit = n; return builder; },
    single: () => { single = "single"; return builder; },
    maybeSingle: () => { single = "maybeSingle"; return builder; },
    select: (cols?: string, opts?: { count?: "exact"; head?: boolean }) => {
      // After insert/update, .select() switches the response shape to return rows
      if (opVal === "insert" || opVal === "update") {
        // server already returns rows; just attach select if specified
        if (cols) state.select = cols;
        return builder;
      }
      if (cols) state.select = cols;
      if (opts?.count) state.count = opts.count;
      if (opts?.head) state.head = opts.head;
      return builder;
    },
    then: (resolve: (v: Result) => unknown, reject?: (e: unknown) => unknown) =>
      exec().then(resolve, reject),
    catch: (reject: (e: unknown) => unknown) => exec().catch(reject),
  };
  return builder as unknown as PromiseLike<Result> & Record<string, (...args: any[]) => any>;
}

function fromTable(table: string, opts?: { publicRead?: boolean }) {
  const initial: QueryState = {
    table,
    select: "*",
    filters: [],
    order: [],
    limit: null,
    count: null,
    head: false,
    publicRead: opts?.publicRead,
  };
  return {
    select: (cols?: string, selOpts?: { count?: "exact"; head?: boolean }) => {
      const b = makeBuilder(initial, "select") as any;
      return b.select(cols, selOpts);
    },
    insert: (values: unknown, _opts?: { count?: "exact" }) =>
      makeBuilder(initial, "insert", values),
    update: (values: unknown, opts?: { count?: "exact" }) =>
      makeBuilder({ ...initial, count: opts?.count ?? null }, "update", values),
    delete: () => makeBuilder(initial, "delete"),
    upsert: (values: unknown) => makeBuilder(initial, "insert", values),
  };
}

// ---------------------------------------------------------------------------
// Auth shim (matches the small subset useAuth/login/signup use)
// ---------------------------------------------------------------------------

type AuthListener = (
  event: "SIGNED_IN" | "SIGNED_OUT" | "TOKEN_REFRESHED",
  session: { user: { id: string; email: string } } | null,
) => void;

const listeners = new Set<AuthListener>();

async function loadMe(): Promise<{ user: { id: string; email: string } | null }> {
  const r = await fetch(`${(import.meta.env.VITE_API_URL as string | undefined) || "/api"}/auth/me`, {
    credentials: "include",
  });
  if (!r.ok) return { user: null };
  const j = await r.json();
  return { user: j.user };
}

const auth = {
  async signInWithPassword(creds: { email: string; password: string }) {
    const r = await api.post<{ ok: true }>("/auth/login", creds);
    if (r.error) return { data: { session: null, user: null }, error: r.error };
    const me = await loadMe();
    listeners.forEach((cb) => cb("SIGNED_IN", me.user ? { user: me.user } : null));
    return { data: { session: me.user ? { user: me.user } : null, user: me.user }, error: null };
  },
  async signUp(args: { email: string; password: string; options?: { data?: { full_name?: string } } }) {
    const r = await api.post<{ ok: true; autoApproved: boolean }>("/auth/signup", {
      email: args.email,
      password: args.password,
      full_name: args.options?.data?.full_name ?? args.email,
    });
    if (r.error) return { data: { user: null, session: null }, error: r.error };
    if ((r.data as { autoApproved: boolean } | null)?.autoApproved) {
      const me = await loadMe();
      listeners.forEach((cb) => cb("SIGNED_IN", me.user ? { user: me.user } : null));
    }
    return { data: { user: null, session: null }, error: null };
  },
  async signOut() {
    await api.post("/auth/logout");
    listeners.forEach((cb) => cb("SIGNED_OUT", null));
    return { error: null };
  },
  async getSession() {
    const me = await loadMe();
    return { data: { session: me.user ? { user: me.user } : null }, error: null };
  },
  async getUser() {
    const me = await loadMe();
    return { data: { user: me.user }, error: null };
  },
  onAuthStateChange(cb: AuthListener) {
    listeners.add(cb);
    return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
  },
};

// ---------------------------------------------------------------------------
// Storage shim
// ---------------------------------------------------------------------------

function storageBucket(bucket: string) {
  return {
    async upload(_path: string, file: File, _opts?: { upsert?: boolean }) {
      const r = await uploadFile(bucket, file);
      if ("error" in r) return { data: null, error: { message: r.error } };
      // store the returned URL on a side channel via a closure
      lastUploadedUrlByBucket.set(bucket, r.url);
      return { data: { path: r.path }, error: null };
    },
    getPublicUrl(_path: string) {
      // The path arg here is ignored — we return the URL of the most recent
      // upload to this bucket. Route code always calls upload then getPublicUrl
      // back-to-back, so this is safe in practice.
      const url = lastUploadedUrlByBucket.get(bucket) || "";
      return { data: { publicUrl: url } };
    },
    async remove(_paths: string[]) {
      // Not implemented server-side yet — silent no-op.
      return { data: [], error: null };
    },
  };
}
const lastUploadedUrlByBucket = new Map<string, string>();

// ---------------------------------------------------------------------------
// Realtime no-op
// ---------------------------------------------------------------------------
function channel(_name: string) {
  const ch = {
    on: (_event: string, _filter: unknown, _cb: unknown) => ch,
    subscribe: () => ch,
    unsubscribe: () => Promise.resolve("ok"),
  };
  return ch;
}
function removeChannel(_ch: unknown) { return Promise.resolve("ok"); }

// ---------------------------------------------------------------------------
// Export a Supabase-shaped client. Public read mode (used by /results) is
// flagged via `supabase.publicRead.from("students")...`.
// ---------------------------------------------------------------------------
export const supabase = {
  from: (table: string) => fromTable(table),
  auth,
  storage: { from: storageBucket },
  channel,
  removeChannel,
  // Extension: public read mode for unauthenticated pages (e.g. /results)
  publicRead: { from: (table: string) => fromTable(table, { publicRead: true }) },
};

export default supabase;
