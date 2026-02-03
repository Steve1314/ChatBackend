import express from "express";
import User from "../model/User.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// GET /contacts?phones=+91123456,+91987654
router.get("/", async (req, res) => {
  const emails = String(req.query.emails || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  const users = await User.find({ email: { $in: emails } })
    .select("name email avatarUrl status");

  res.json(users);
});

export default router;
