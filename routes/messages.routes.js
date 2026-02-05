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

/* =========================
   PUT /messages/:id/status
   Mark message as delivered or read
========================= */
router.put("/:id/status", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.body; // "delivered" or "read"

    if (!["delivered", "read"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const msg = await Message.findById(req.params.id);
    if (!msg) return res.status(404).json({ error: "Message not found" });

    // Update message status
    if (msg.status === "sent" && status === "delivered") {
      msg.status = "delivered";
    } else if (status === "read") {
      msg.status = "read";
    }

    // Add to readBy array if marking as read
    if (status === "read") {
      const alreadyRead = msg.readBy.some(r => String(r.user) === String(userId));
      if (!alreadyRead) {
        msg.readBy.push({ user: userId, readAt: new Date() });
      }
    }

    await msg.save();

    const io = req.app.get("io");
    if (io) {
      io.to(String(msg.chat)).emit("messageStatusUpdate", {
        messageId: msg._id,
        status: msg.status,
        readBy: msg.readBy
      });
    }

    res.json(msg);
  } catch (err) {
    console.error("UPDATE MESSAGE STATUS ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* =========================
   PUT /messages/:id/edit
   Edit an existing message
========================= */
router.put("/:id/edit", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Text is required" });
    }

    const msg = await Message.findById(req.params.id);
    if (!msg) return res.status(404).json({ error: "Message not found" });

    // Only sender can edit
    if (String(msg.sender) !== String(userId)) {
      return res.status(403).json({ error: "You can edit only your messages" });
    }

    // Only text messages can be edited (no media)
    if (msg.media.length > 0) {
      return res.status(400).json({ error: "Cannot edit messages with media" });
    }

    // Store edit history
    msg.editHistory.push({
      oldText: msg.text,
      editedAt: new Date()
    });

    msg.text = text.trim();
    msg.editedAt = new Date();
    await msg.save();

    const populated = await msg.populate([
      { path: "sender", select: "name email avatarUrl" },
      { path: "media" }
    ]);

    const io = req.app.get("io");
    if (io) {
      io.to(String(msg.chat)).emit("messageEdited", {
        chatId: msg.chat,
        message: populated
      });
    }

    res.json(populated);
  } catch (err) {
    console.error("EDIT MESSAGE ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* =========================
   POST /messages/:id/star
   Star a message
========================= */
router.post("/:id/star", auth, async (req, res) => {
  try {
    const msg = await Message.findById(req.params.id);
    if (!msg) return res.status(404).json({ error: "Message not found" });

    msg.starred = !msg.starred;
    await msg.save();

    const io = req.app.get("io");
    if (io) {
      io.to(String(msg.chat)).emit("messageStarred", {
        messageId: msg._id,
        starred: msg.starred
      });
    }

    res.json({ starred: msg.starred });
  } catch (err) {
    console.error("STAR MESSAGE ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* =========================
   GET /chats/:chatId/messages/unread
   Get unread messages count
========================= */
router.get("/chats/:chatId/unread", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { chatId } = req.params;

    const chat = await Chat.findOne({
      _id: chatId,
      members: { $in: [userId] }
    });

    if (!chat) {
      return res.status(403).json({ error: "Not a member of this chat" });
    }

    const unreadCount = await Message.countDocuments({
      chat: chatId,
      status: { $ne: "read" },
      "readBy.user": { $ne: userId }
    });

    res.json({ unreadCount });
  } catch (err) {
    console.error("GET UNREAD ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
