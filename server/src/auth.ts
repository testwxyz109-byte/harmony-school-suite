import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { db } from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-change-me-please-32chars-min";
const COOKIE_NAME = "sms_session";
const ONE_WEEK = 7 * 24 * 60 * 60;

export type AppRole = "admin" | "sub_admin" | "teacher";

export interface SessionPayload {
  uid: string;
  email: string;
}

export function hashPassword(plain: string) {
  return bcrypt.hashSync(plain, 10);
}
export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compareSync(plain, hash);
}

export function signToken(payload: SessionPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ONE_WEEK });
}

export function setAuthCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ONE_WEEK * 1000,
    path: "/",
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

export interface AuthedRequest extends Request {
  user?: {
    id: string;
    email: string;
    enabled: boolean;
    roles: AppRole[];
  };
}

const getRoles = db.prepare("SELECT role FROM user_roles WHERE user_id = ?");
const getProfile = db.prepare("SELECT enabled FROM profiles WHERE id = ?");

export function loadUser(req: AuthedRequest, _res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return next();
  try {
    const payload = jwt.verify(token, JWT_SECRET) as SessionPayload;
    const profile = getProfile.get(payload.uid) as { enabled: number } | undefined;
    if (!profile) return next();
    const roles = (getRoles.all(payload.uid) as { role: AppRole }[]).map((r) => r.role);
    req.user = {
      id: payload.uid,
      email: payload.email,
      enabled: !!profile.enabled,
      roles,
    };
  } catch {
    // invalid/expired token — proceed unauthenticated
  }
  next();
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  if (!req.user.enabled) return res.status(403).json({ error: "Account disabled. Awaiting admin approval." });
  next();
}

export function requireRole(...roles: AppRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    if (!req.user.enabled) return res.status(403).json({ error: "Account disabled" });
    if (!req.user.roles.some((r) => roles.includes(r))) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

export function isAdmin(roles: AppRole[]) {
  return roles.includes("admin");
}
export function isSubOrAdmin(roles: AppRole[]) {
  return roles.includes("admin") || roles.includes("sub_admin");
}
