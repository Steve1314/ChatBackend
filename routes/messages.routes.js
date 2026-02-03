import express from "express";
import Chat from "../model/Chat.js";
import Message from "../model/Message.js";
import Media from "../model/Media.js";
import User from "../model/User.js";

const router = express.Router();

/* =========================
   POST /chats/:chatId/messages
========================= */
router.post("/chats/:chatId/messages", async (req, res) => {
  try {
    const { senderEmail, text = "", mediaIds = [] } = req.body;

    if (!senderEmail)
      return res.status(400).json({ error: "senderEmail is required" });

    const sender = await User.findOne({ email: senderEmail });
    if (!sender) return res.status(404).json({ error: "Sender not found" });

    const chat = await Chat.findOne({
      _id: req.params.chatId,
      members: sender._id,
    });
    if (!chat) return res.status(403).json({ error: "Not in chat" });

    const mediaDocs = mediaIds.length
      ? await Media.find({ _id: { $in: mediaIds } })
      : [];

    const msg = await Message.create({
      chat: chat._id,
      sender: sender._id,
      text,
      media: mediaDocs.map((m) => m._id),
    });

    chat.lastMessageAt = new Date();
    await chat.save();

    const populated = await msg.populate([
  { path: "sender", select: "name email avatarUrl" },
  { path: "media" }
]);

    const io = req.app.get("io");
    if (io) io.to(String(chat._id)).emit("newMessage", populated);

    res.status(201).json(populated);
  } catch (e) {
    console.error("SEND MESSAGE ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
});

/* =========================
   DELETE /messages/:id (email based)
========================= */
router.delete("/messages/:id", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) return res.status(400).json({ error: "email is required" });

    const me = await User.findOne({ email });
    if (!me) return res.status(404).json({ error: "User not found" });

    const msg = await Message.findById(req.params.id);
    if (!msg) return res.status(404).json({ error: "Message not found" });

    if (String(msg.sender) !== String(me._id)) {
      return res.status(403).json({ error: "Can delete only your messages" });
    }

    msg.deleted = true;
    await msg.save();

    const io = req.app.get("io");
    if (io) io.to(String(msg.chat)).emit("messageDeleted", { id: msg._id });

    res.json({ success: true });
  } catch (e) {
    console.error("DELETE MESSAGE ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;