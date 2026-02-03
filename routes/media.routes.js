import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import Media from "../model/Media.js";
import User from "../model/User.js";

const router = express.Router();

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

/* =========================
   POST /media/upload
   Body: { senderEmail }
========================= */
router.post("/upload", upload.array("files", 10), async (req, res) => {
  try {
    const { senderEmail } = req.body;

    if (!senderEmail)
      return res.status(400).json({ error: "senderEmail is required" });

    const user = await User.findOne({ email: senderEmail });
    if (!user) return res.status(404).json({ error: "User not found" });

    const saved = await Media.insertMany(
      req.files.map((f) => ({
        filename: f.filename,
        mimetype: f.mimetype,
        size: f.size,
        path: `/media/${f.filename}`,
        uploader: user._id,
      }))
    );

    res.status(201).json(saved);
  } catch (e) {
    console.error("UPLOAD ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /media/:filename
router.get("/:filename", async (req, res) => {
  const file = path.join(uploadDir, req.params.filename);
  if (!fs.existsSync(file)) return res.status(404).send("Not found");
  res.sendFile(file);
});

export default router;