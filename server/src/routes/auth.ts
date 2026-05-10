import { Router } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import rateLimit from "express-rate-limit";
import { db } from "../db.js";
import {
  hashPassword, verifyPassword, signToken, setAuthCookie, clearAuthCookie,
  requireAuth, type AuthedRequest,
} from "../auth.js";

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

const SignupSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(255),
  full_name: z.string().min(1).max(255),
});

const LoginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(255),
});

const countUsers = db.prepare("SELECT COUNT(*) as c FROM profiles");
const getUserByEmail = db.prepare("SELECT * FROM auth_users WHERE email = ? COLLATE NOCASE");
const insertAuth = db.prepare("INSERT INTO auth_users (id, email, password_hash) VALUES (?, ?, ?)");
const insertProfile = db.prepare(
  "INSERT INTO profiles (id, email, full_name, enabled) VALUES (?, ?, ?, ?)",
);
const insertRole = db.prepare("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)");

router.post("/signup", authLimiter, (req, res) => {
  const parsed = SignupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  const { email, password, full_name } = parsed.data;

  if (getUserByEmail.get(email)) return res.status(409).json({ error: "Email already registered" });

  const id = randomUUID();
  const hash = hashPassword(password);
  const isFirst = (countUsers.get() as { c: number }).c === 0;
  const role = isFirst ? "admin" : "teacher";

  const txn = db.transaction(() => {
    insertAuth.run(id, email, hash);
    insertProfile.run(id, email, full_name, isFirst ? 1 : 0);
    insertRole.run(randomUUID(), id, role);
  });
  txn();

  if (isFirst) {
    const token = signToken({ uid: id, email });
    setAuthCookie(res, token);
    return res.json({ ok: true, autoApproved: true });
  }
  return res.json({ ok: true, autoApproved: false, message: "Awaiting admin approval" });
});

router.post("/login", authLimiter, (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid email or password" });
  const { email, password } = parsed.data;

  const user = getUserByEmail.get(email) as { id: string; email: string; password_hash: string } | undefined;
  if (!user) return res.status(401).json({ error: "Invalid email or password" });
  if (!verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const token = signToken({ uid: user.id, email: user.email });
  setAuthCookie(res, token);
  res.json({ ok: true });
});

router.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

const getProfile = db.prepare("SELECT * FROM profiles WHERE id = ?");
const getRoles = db.prepare("SELECT role FROM user_roles WHERE user_id = ?");

router.get("/me", (req: AuthedRequest, res) => {
  if (!req.user) return res.json({ user: null, profile: null, roles: [] });
  const profile = getProfile.get(req.user.id);
  const roles = (getRoles.all(req.user.id) as { role: string }[]).map((r) => r.role);
  res.json({
    user: { id: req.user.id, email: req.user.email },
    profile,
    roles,
  });
});

// Stub used by useAuth.refreshProfile
router.get("/session", requireAuth, (req: AuthedRequest, res) => {
  res.json({ user: req.user });
});

export default router;
