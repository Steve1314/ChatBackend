import express from "express";
import Chat from "../model/Chat.js";
import Message from "../model/Message.js";
import User from "../model/User.js";

const router = express.Router();

/* =========================
   GET /chats?email=...
========================= */
router.get("/", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: "email is required" });

    const me = await User.findOne({ email });
    if (!me) return res.status(404).json({ error: "User not found" });

    const chats = await Chat.find({ members: me._id })
      .sort({ lastMessageAt: -1 })
      .populate("members", "name email avatarUrl status");

    res.json(chats);
  } catch (e) {
    console.error("GET /chats error:", e);
    res.status(500).json({ error: "Server error" });
  }
});

/* =========================
   POST /chats
   { myEmail, otherEmail }
========================= */
router.post("/", async (req, res) => {
  try {
    const { myEmail, otherEmail } = req.body;
    if (!myEmail || !otherEmail) {
      return res.status(400).json({ error: "myEmail and otherEmail required" });
    }

    if (myEmail === otherEmail) {
      return res.status(400).json({ error: "Cannot chat with yourself" });
    }

    const me = await User.findOne({ email: myEmail });
    const other = await User.findOne({ email: otherEmail });

    if (!me || !other) {
      return res.status(404).json({ error: "User not found" });
    }

    const members = [me._id, other._id];

    const existing = await Chat.findOne({
      type: "private",
      members: { $all: members, $size: 2 },
    }).populate("members", "name email avatarUrl status");

    if (existing) return res.json(existing);

    const chat = await Chat.create({ type: "private", members });

    const populated = await Chat.findById(chat._id).populate(
      "members",
      "name email avatarUrl status",
    );

    res.status(201).json(populated);
  } catch (e) {
    console.error("POST /chats error:", e);
    res.status(500).json({ error: "Server error" });
  }
});

/* =========================
   GET /chats/:id/messages?email=...
========================= */
router.get("/:id/messages", async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.query;

    if (!email) return res.status(400).json({ error: "email is required" });

    const me = await User.findOne({ email });
    if (!me) return res.status(404).json({ error: "User not found" });

    const isMember = await Chat.exists({ _id: id, members: me._id });
    if (!isMember) return res.status(403).json({ error: "Not in chat" });

    const msgs = await Message.find({ chat: id })
      .sort({ createdAt: 1 })
      .populate([
        { path: "sender", select: "name email avatarUrl" },
        { path: "media" },
      ]);

    res.json(msgs);
  } catch (e) {
    console.error("GET messages error:", e);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
