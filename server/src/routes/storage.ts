import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { requireAuth, type AuthedRequest } from "../auth.js";

const router = Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./data/uploads";
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_BUCKETS = new Set(["avatars", "school-assets", "student-photos"]);

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const bucket = (req.params.bucket || "").toString();
    if (!ALLOWED_BUCKETS.has(bucket)) return cb(new Error("Invalid bucket"), "");
    const dir = path.join(UPLOAD_DIR, bucket);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^.\w]/g, "");
    cb(null, `${Date.now()}-${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (!/^image\//.test(file.mimetype)) return cb(new Error("Only image uploads allowed"));
    cb(null, true);
  },
});

router.post(
  "/upload/:bucket",
  requireAuth,
  (req, res, next) => {
    if (!ALLOWED_BUCKETS.has(req.params.bucket)) {
      return res.status(400).json({ error: "Invalid bucket" });
    }
    next();
  },
  upload.single("file"),
  (req: AuthedRequest, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });
    const url = `/api/files/${req.params.bucket}/${file.filename}`;
    res.json({ url, path: `${req.params.bucket}/${file.filename}` });
  },
);

// Public file serving
router.get("/files/:bucket/:filename", (req, res) => {
  const { bucket, filename } = req.params;
  if (!ALLOWED_BUCKETS.has(bucket)) return res.status(404).end();
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return res.status(400).end();
  }
  const full = path.join(UPLOAD_DIR, bucket, filename);
  if (!fs.existsSync(full)) return res.status(404).end();
  res.sendFile(path.resolve(full));
});

export default router;
