import express from "express";
import Notification from "../model/Notification.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// POST /notifications/send
router.post("/send", auth, async (req, res) => {
  const { userId, title = "New Message", body = "", meta = {} } = req.body;
  if (!userId) return res.status(400).json({ error: "userId is required" });

  const n = await Notification.create({ user: userId, title, body, meta, type: "message" });

  // TODO: integrate FCM here if you want push notifications
  // await sendFCM(userId, title, body, meta)

  res.status(201).json(n);
});

// GET /notifications
router.get("/", auth, async (req, res) => {
  const list = await Notification.find({ user: req.user.id }).sort({ createdAt: -1 });
  res.json(list);
});

export default router;
