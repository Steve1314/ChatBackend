import express from "express";
import Chat from "../model/Chat.js";
import Message from "../model/Message.js";
import Media from "../model/Media.js";
import User from "../model/User.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

/* =========================
   POST /chats/:chatId/messages
========================= */
router.post("/chats/:chatId/messages", auth, async (req, res) => {
  try {
    const { text = "", mediaIds = [] } = req.body;
    const userId = req.user.id;

    if (!text.trim() && mediaIds.length === 0) {
      return res
        .status(400)
        .json({ error: "Message text or media is required" });
    }

    const chat = await Chat.findOne({
      _id: req.params.chatId,
      members: { $in: [userId] },
    });

    if (!chat) {
      return res.status(403).json({ error: "Not a member of this chat" });
    }

    const mediaDocs = mediaIds.length
      ? await Media.find({
          _id: { $in: mediaIds },
          uploadedBy: userId, // 🔒 ownership check
        })
      : [];

    if (mediaDocs.length !== mediaIds.length) {
      return res.status(403).json({ error: "Invalid media attachment" });
    }

    const msg = await Message.create({
      chat: chat._id,
      sender: userId,
      text: text.trim(),
      media: mediaDocs.map((m) => m._id),
    });

    chat.lastMessageAt = new Date();
    await chat.save();

    const populated = await msg.populate([
      { path: "sender", select: "name email avatarUrl" },
      { path: "media" },
    ]);

    const io = req.app.get("io");
    if (io) {
      io.to(String(chat._id)).emit("newMessage", {
        chatId: chat._id,
        message: populated,
      });
    }

    res.status(201).json(populated);
  } catch (err) {
    console.error("SEND MESSAGE ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* =========================
   DELETE /messages/:id
========================= */
router.delete("/messages/:id", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const msg = await Message.findById(req.params.id);
    if (!msg) return res.status(404).json({ error: "Message not found" });

    if (String(msg.sender) !== String(userId)) {
      return res
        .status(403)
        .json({ error: "You can delete only your messages" });
    }

    msg.deleted = true;
    await msg.save();

    const io = req.app.get("io");
    if (io) {
      io.to(String(msg.chat)).emit("messageDeleted", {
        chatId: msg.chat,
        messageId: msg._id,
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE MESSAGE ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
