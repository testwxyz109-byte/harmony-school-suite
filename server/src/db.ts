import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_PATH = process.env.DATABASE_PATH || "./data/app.db";

// Ensure parent dir exists
fs.mkdirSync(path.dirname(path.resolve(DB_PATH)), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Run schema (idempotent — uses CREATE TABLE IF NOT EXISTS)
const schemaPath = path.join(__dirname, "schema.sql");
const schema = fs.readFileSync(schemaPath, "utf8");
db.exec(schema);

// Graceful shutdown
process.on("SIGTERM", () => { try { db.close(); } catch {} process.exit(0); });
process.on("SIGINT",  () => { try { db.close(); } catch {} process.exit(0); });

export default db;
