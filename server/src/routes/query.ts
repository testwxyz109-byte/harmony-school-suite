// Generic Supabase-style query endpoint.
// Frontend (via the supabase shim) sends a JSON body describing the operation,
// the server validates against an allowlist + role policy, then executes.

import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db } from "../db.js";
import { type AuthedRequest, isSubOrAdmin, isAdmin } from "../auth.js";

const router = Router();

// ---------------------------------------------------------------------------
// Table allowlist & policy matrix
// ---------------------------------------------------------------------------
type Op = "select" | "insert" | "update" | "delete";

interface TablePolicy {
  read: "any" | "auth" | "admin" | "subOrAdmin";
  write: "admin" | "subOrAdmin" | "auth";
}

const TABLES: Record<string, TablePolicy> = {
  profiles:           { read: "auth", write: "admin" },
  user_roles:         { read: "auth", write: "admin" },
  school_settings:    { read: "any",  write: "admin" },
  academic_years:     { read: "auth", write: "admin" },
  programs:           { read: "auth", write: "subOrAdmin" },
  batches:            { read: "auth", write: "subOrAdmin" },
  classes:            { read: "auth", write: "subOrAdmin" },
  subjects:           { read: "auth", write: "subOrAdmin" },
  class_subjects:     { read: "auth", write: "subOrAdmin" },
  students:           { read: "auth", write: "subOrAdmin" },
  attendance:         { read: "auth", write: "auth" },
  fee_types:          { read: "auth", write: "subOrAdmin" },
  fee_structures:     { read: "auth", write: "subOrAdmin" },
  student_fees:       { read: "auth", write: "subOrAdmin" },
  fee_items:          { read: "auth", write: "subOrAdmin" },
  payments:           { read: "auth", write: "subOrAdmin" },
  expense_categories: { read: "auth", write: "subOrAdmin" },
  expenses:           { read: "auth", write: "subOrAdmin" },
  staff:              { read: "auth", write: "subOrAdmin" },
  salary_payments:    { read: "auth", write: "subOrAdmin" },
  transport_routes:   { read: "auth", write: "subOrAdmin" },
  student_transport:  { read: "auth", write: "subOrAdmin" },
  exams:              { read: "auth", write: "subOrAdmin" },
  exam_subjects:      { read: "auth", write: "subOrAdmin" },
  exam_marks:         { read: "auth", write: "auth" },
  announcements:      { read: "auth", write: "subOrAdmin" },
};

// Public read-only access (used by /results page)
const PUBLIC_READ = new Set([
  "students", "exams", "exam_subjects", "exam_marks", "subjects", "classes", "school_settings",
]);

function checkPolicy(table: string, op: Op, req: AuthedRequest): string | null {
  const policy = TABLES[table];
  if (!policy) return `Unknown table: ${table}`;

  const isRead = op === "select";
  if (isRead) {
    if (policy.read === "any") return null;
    if (req.headers["x-public-read"] === "1" && PUBLIC_READ.has(table)) return null;
    if (!req.user) return "Not authenticated";
    if (!req.user.enabled) return "Account disabled";
    if (policy.read === "auth") return null;
    if (policy.read === "admin" && isAdmin(req.user.roles)) return null;
    if (policy.read === "subOrAdmin" && isSubOrAdmin(req.user.roles)) return null;
    return "Forbidden";
  } else {
    if (!req.user) return "Not authenticated";
    if (!req.user.enabled) return "Account disabled";
    if (policy.write === "auth") return null;
    if (policy.write === "admin" && isAdmin(req.user.roles)) return null;
    if (policy.write === "subOrAdmin" && isSubOrAdmin(req.user.roles)) return null;
    return "Forbidden";
  }
}

// ---------------------------------------------------------------------------
// Filter operators
// ---------------------------------------------------------------------------
interface Filter {
  col: string;
  op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "like" | "ilike" | "is";
  val: unknown;
}

const COL_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
function safeCol(c: string) {
  if (!COL_RE.test(c)) throw new Error(`Invalid column: ${c}`);
  return c;
}

function buildWhere(filters: Filter[] | undefined): { sql: string; params: unknown[] } {
  if (!filters || filters.length === 0) return { sql: "", params: [] };
  const parts: string[] = [];
  const params: unknown[] = [];
  for (const f of filters) {
    const col = safeCol(f.col);
    switch (f.op) {
      case "eq":  parts.push(`${col} = ?`);  params.push(f.val); break;
      case "neq": parts.push(`${col} != ?`); params.push(f.val); break;
      case "gt":  parts.push(`${col} > ?`);  params.push(f.val); break;
      case "gte": parts.push(`${col} >= ?`); params.push(f.val); break;
      case "lt":  parts.push(`${col} < ?`);  params.push(f.val); break;
      case "lte": parts.push(`${col} <= ?`); params.push(f.val); break;
      case "like":
      case "ilike":
        parts.push(`${col} LIKE ?`); params.push(f.val); break;
      case "is":
        if (f.val === null) parts.push(`${col} IS NULL`);
        else parts.push(`${col} IS ?`), params.push(f.val);
        break;
      case "in": {
        const arr = Array.isArray(f.val) ? f.val : [];
        if (arr.length === 0) {
          parts.push("0=1");
        } else {
          parts.push(`${col} IN (${arr.map(() => "?").join(",")})`);
          params.push(...arr);
        }
        break;
      }
      default: throw new Error(`Unsupported operator: ${(f as Filter).op}`);
    }
  }
  return { sql: ` WHERE ${parts.join(" AND ")}`, params };
}

// Convert SQLite integer flags (0/1) on known boolean columns back to booleans.
const BOOL_COLS = new Set([
  "enabled", "attendance_permitted", "is_current", "is_recurring",
  "active", "is_advance", "published",
]);
function decodeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (BOOL_COLS.has(k) && typeof v === "number") out[k] = v === 1;
    else if (k === "non_school_weekdays" && typeof v === "string") {
      try { out[k] = JSON.parse(v); } catch { out[k] = []; }
    } else out[k] = v;
  }
  return out;
}
function encodeValue(k: string, v: unknown): unknown {
  if (BOOL_COLS.has(k) && typeof v === "boolean") return v ? 1 : 0;
  if (k === "non_school_weekdays" && Array.isArray(v)) return JSON.stringify(v);
  return v;
}

// ---------------------------------------------------------------------------
// Embedded selects:  select="*, classes(name), fee_types(name)"
// We parse out child references and resolve them with a follow-up query.
// ---------------------------------------------------------------------------
interface EmbedSpec { table: string; cols: string[]; alias: string; }

function parseSelect(sel: string): { cols: string[]; embeds: EmbedSpec[] } {
  // Naive parser: top-level comma split honoring parens.
  const parts: string[] = [];
  let depth = 0, buf = "";
  for (const ch of sel) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) { parts.push(buf.trim()); buf = ""; }
    else buf += ch;
  }
  if (buf.trim()) parts.push(buf.trim());

  const cols: string[] = [];
  const embeds: EmbedSpec[] = [];
  for (const p of parts) {
    const m = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)$/.exec(p);
    if (m) {
      const [, table, inner] = m;
      const ec = inner.split(",").map((s) => s.trim()).filter(Boolean);
      embeds.push({ table, cols: ec.length ? ec : ["*"], alias: table });
    } else {
      cols.push(p);
    }
  }
  return { cols, embeds };
}

// Given a parent table + its rows + an embed (e.g. classes(name)),
// figure out the foreign-key column on parent (commonly `${embed.table.singular}_id`).
function resolveEmbedKey(parentTable: string, embedTable: string): string {
  // common conventions
  const singular = embedTable.endsWith("s") ? embedTable.slice(0, -1) : embedTable;
  const candidates = [`${singular}_id`, `${embedTable}_id`];
  // table-specific fallbacks
  const map: Record<string, Record<string, string>> = {
    fee_structures: { fee_types: "fee_type_id", classes: "class_id", programs: "program_id" },
    fee_items:      { fee_types: "fee_type_id" },
    student_fees:   { students: "student_id" },
    payments:       { student_fees: "student_fee_id" },
    students:       { classes: "class_id", programs: "program_id", batches: "batch_id", academic_years: "academic_year_id" },
    batches:        { academic_years: "academic_year_id" },
    classes:        { programs: "program_id" },
    expenses:       { expense_categories: "category_id" },
    salary_payments:{ staff: "staff_id" },
    student_transport: { students: "student_id", transport_routes: "route_id" },
    exam_subjects:  { exams: "exam_id", subjects: "subject_id", classes: "class_id" },
    exam_marks:     { exam_subjects: "exam_subject_id", students: "student_id" },
    attendance:     { students: "student_id" },
    subjects:       { auth_users: "teacher_id" },
    user_roles:     { auth_users: "user_id" },
  };
  if (map[parentTable]?.[embedTable]) return map[parentTable][embedTable];
  return candidates[0];
}

function applyEmbeds(table: string, rows: Record<string, unknown>[], embeds: EmbedSpec[]) {
  if (rows.length === 0 || embeds.length === 0) return rows;
  for (const emb of embeds) {
    const fk = resolveEmbedKey(table, emb.table);
    const ids = Array.from(new Set(rows.map((r) => r[fk]).filter((v) => v != null)));
    if (ids.length === 0) {
      for (const r of rows) r[emb.alias] = null;
      continue;
    }
    const colList = emb.cols.includes("*") ? "*" : ["id", ...emb.cols.map(safeCol)].join(",");
    const stmt = db.prepare(
      `SELECT ${colList} FROM ${safeCol(emb.table)} WHERE id IN (${ids.map(() => "?").join(",")})`,
    );
    const childRows = stmt.all(...ids) as Record<string, unknown>[];
    const byId = new Map(childRows.map((c) => [c.id as string, decodeRow(c)]));
    for (const r of rows) {
      const fkVal = r[fk] as string | null | undefined;
      r[emb.alias] = fkVal ? byId.get(fkVal) ?? null : null;
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// POST /api/q  — generic query endpoint
// ---------------------------------------------------------------------------
interface QueryBody {
  table: string;
  op: Op;
  select?: string;
  filters?: Filter[];
  order?: { col: string; asc?: boolean }[];
  limit?: number;
  offset?: number;
  single?: "single" | "maybeSingle" | null;
  count?: "exact" | null;
  head?: boolean;
  values?: Record<string, unknown> | Record<string, unknown>[];
  upsert?: boolean;
  onConflict?: string; // unused — sqlite uses unique constraints
}

router.post("/q", (req: AuthedRequest, res) => {
  try {
    const body = req.body as QueryBody;
    const { table, op } = body;
    const policyErr = checkPolicy(table, op, req);
    if (policyErr) return res.status(policyErr.includes("authenticated") ? 401 : 403).json({ error: policyErr });

    const safeTable = safeCol(table);

    if (op === "select") {
      const sel = body.select ?? "*";
      const { cols, embeds } = parseSelect(sel);
      const colList = cols.length === 0 || cols.includes("*") ? "*" : cols.map(safeCol).join(",");

      const where = buildWhere(body.filters);

      // count requested
      if (body.count === "exact") {
        const countStmt = db.prepare(`SELECT COUNT(*) as c FROM ${safeTable}${where.sql}`);
        const c = (countStmt.get(...where.params) as { c: number }).c;
        if (body.head) return res.json({ data: null, count: c });
        // fall through to also fetch rows + count
        let sql = `SELECT ${colList} FROM ${safeTable}${where.sql}`;
        if (body.order?.length) {
          sql += " ORDER BY " + body.order.map((o) => `${safeCol(o.col)} ${o.asc === false ? "DESC" : "ASC"}`).join(",");
        }
        if (body.limit) sql += ` LIMIT ${Number(body.limit) | 0}`;
        const rows = (db.prepare(sql).all(...where.params) as Record<string, unknown>[]).map(decodeRow);
        applyEmbeds(table, rows, embeds);
        return res.json({ data: rows, count: c });
      }

      let sql = `SELECT ${colList} FROM ${safeTable}${where.sql}`;
      if (body.order?.length) {
        sql += " ORDER BY " + body.order.map((o) => `${safeCol(o.col)} ${o.asc === false ? "DESC" : "ASC"}`).join(",");
      }
      const limit = body.single ? 1 : body.limit;
      if (limit) sql += ` LIMIT ${Number(limit) | 0}`;

      const rows = (db.prepare(sql).all(...where.params) as Record<string, unknown>[]).map(decodeRow);
      applyEmbeds(table, rows, embeds);

      if (body.single === "single") {
        if (rows.length !== 1) return res.json({ data: null, error: { message: "Expected single row" } });
        return res.json({ data: rows[0] });
      }
      if (body.single === "maybeSingle") {
        return res.json({ data: rows[0] ?? null });
      }
      return res.json({ data: rows });
    }

    if (op === "insert") {
      const arr = Array.isArray(body.values) ? body.values : body.values ? [body.values] : [];
      if (arr.length === 0) return res.status(400).json({ error: "No values to insert" });

      // student_code auto-generation
      if (table === "students") {
        const s = db.prepare("SELECT student_id_prefix as p, student_id_padding as pad FROM school_settings WHERE id=1").get() as { p: string; pad: number };
        const max = db.prepare("SELECT student_code FROM students WHERE student_code LIKE ? ORDER BY student_code DESC LIMIT 1").get(`${s.p}%`) as { student_code: string } | undefined;
        let next = 1;
        if (max) { const n = parseInt(max.student_code.slice(s.p.length), 10); if (!isNaN(n)) next = n + 1; }
        for (const row of arr) {
          if (!row.student_code) {
            row.student_code = s.p + String(next).padStart(s.pad, "0");
            next++;
          }
        }
      }

      // attendance future-date guard
      if (table === "attendance") {
        const today = new Date().toISOString().slice(0, 10);
        for (const row of arr) {
          if (typeof row.date === "string" && row.date > today) {
            return res.status(400).json({ error: "Cannot record attendance for a future date" });
          }
        }
      }

      const inserted: Record<string, unknown>[] = [];
      const txn = db.transaction(() => {
        for (const raw of arr) {
          const row: Record<string, unknown> = { ...raw };
          if (!row.id && table !== "school_settings") row.id = randomUUID();
          // recorded_by / created_by auto
          if (("recorded_by" in row) && !row.recorded_by && req.user) row.recorded_by = req.user.id;
          if (("created_by" in row) && !row.created_by && req.user) row.created_by = req.user.id;
          const keys = Object.keys(row).map(safeCol);
          const vals = keys.map((k) => encodeValue(k, row[k]));
          const stmt = db.prepare(
            `INSERT INTO ${safeTable} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`,
          );
          stmt.run(...vals);
          const back = db.prepare(`SELECT * FROM ${safeTable} WHERE id = ?`).get(row.id) as Record<string, unknown> | undefined;
          if (back) inserted.push(decodeRow(back));
        }
      });
      txn();
      return res.json({ data: inserted });
    }

    if (op === "update") {
      const values = (body.values && !Array.isArray(body.values)) ? body.values : null;
      if (!values) return res.status(400).json({ error: "Update requires an object" });
      const where = buildWhere(body.filters);
      const setKeys = Object.keys(values).map(safeCol);
      if (setKeys.length === 0) return res.status(400).json({ error: "Nothing to update" });
      const setVals = setKeys.map((k) => encodeValue(k, values[k]));
      const setClause = setKeys.map((k) => `${k} = ?`).join(",");
      const sql = `UPDATE ${safeTable} SET ${setClause}${where.sql}`;
      const result = db.prepare(sql).run(...setVals, ...where.params);
      let data: Record<string, unknown>[] = [];
      if (where.sql) {
        data = (db.prepare(`SELECT * FROM ${safeTable}${where.sql}`).all(...where.params) as Record<string, unknown>[]).map(decodeRow);
      }
      return res.json({ data, count: result.changes });
    }

    if (op === "delete") {
      const where = buildWhere(body.filters);
      if (!where.sql) return res.status(400).json({ error: "Delete requires filters" });
      const result = db.prepare(`DELETE FROM ${safeTable}${where.sql}`).run(...where.params);
      return res.json({ data: null, count: result.changes });
    }

    return res.status(400).json({ error: `Unknown op: ${op}` });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    console.error("[/api/q] error:", msg);
    return res.status(500).json({ error: msg });
  }
});

export default router;
