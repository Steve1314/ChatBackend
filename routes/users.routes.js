import express from "express";
import User from "../model/User.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// PUT /users/:id
router.put("/", async (req, res) => {
  const { email, name, avatarUrl, status } = req.body;

  const updated = await User.findOneAndUpdate(
    { email },
    { $set: { name, avatarUrl, status } },
    { new: true }
  );

  res.json(updated);
});

// GET /users/online
router.get("/online", auth, async (req, res) => {
  // populated by socket.io in server.js
  const onlineIds = req.app.get("onlineUsers") || new Set();
  res.json({ online: Array.from(onlineIds) });
});

// POST /status/update
router.post("/status/update", auth, async (req, res) => {
  const { typingIn } = req.body; // chatId or null
  const updated = await User.findByIdAndUpdate(
    req.user.id,
    { $set: { lastSeen: new Date(), typingIn: typingIn || null } },
    { new: true }
  );
  // Inform room about typing changes (optional, if socket available)
  const io = req.app.get("io");
  if (io && typingIn) io.to(String(typingIn)).emit("typing", { userId: req.user.id });
  res.json(updated);
});

export default router;
