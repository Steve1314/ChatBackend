import express from "express";
import Call from "../model/Call.js";
import Chat from "../model/Chat.js";
import User from "../model/User.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// ==========================================
// POST /calls/initiate - Start a new call
// ==========================================
router.post("/initiate", auth, async (req, res) => {
  try {
    const { chatId, type = "audio", receiverIds = [] } = req.body;
    const callerId = req.user.id;

    if (!chatId) {
      return res.status(400).json({ error: "chatId is required" });
    }

    if (!["audio", "video"].includes(type)) {
      return res.status(400).json({ error: "type must be 'audio' or 'video'" });
    }

    const chat = await Chat.findOne({
      _id: chatId,
      members: { $in: [callerId] },
    });

    if (!chat) {
      return res.status(403).json({ error: "Not a member of this chat" });
    }

    const call = await Call.create({
      chat: chatId,
      caller: callerId,
      receivers: receiverIds.length ? receiverIds : chat.members.filter(m => String(m) !== String(callerId)),
      type,
      status: "ringing",
      participants: [{ user: callerId, joinedAt: new Date() }]
    });

    const populated = await call.populate([
      { path: "caller", select: "name email avatarUrl" },
      { path: "receivers", select: "name email avatarUrl" },
      { path: "chat" }
    ]);

    const io = req.app.get("io");
    if (io) {
      io.to(String(chatId)).emit("incomingCall", {
        callId: call._id,
        chatId,
        caller: {
          id: callerId,
          name: req.user.name,
          email: req.user.email
        },
        type,
        timestamp: new Date()
      });
    }

    res.status(201).json(populated);
  } catch (err) {
    console.error("INITIATE CALL ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ==========================================
// POST /calls/:callId/accept - Accept a call
// ==========================================
router.post("/:callId/accept", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const call = await Call.findById(req.params.callId);

    if (!call) {
      return res.status(404).json({ error: "Call not found" });
    }

    // Update status and add participant
    call.status = "ongoing";
    call.startedAt = new Date();
    
    // Check if user already in participants
    const isParticipant = call.participants.some(p => String(p.user) === String(userId));
    if (!isParticipant) {
      call.participants.push({ user: userId, joinedAt: new Date() });
    }

    await call.save();

    const io = req.app.get("io");
    if (io) {
      io.to(String(call.chat)).emit("callAccepted", {
        callId: call._id,
        acceptedBy: userId,
        status: "ongoing"
      });
    }

    res.json(call);
  } catch (err) {
    console.error("ACCEPT CALL ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ==========================================
// POST /calls/:callId/reject - Reject a call
// ==========================================
router.post("/:callId/reject", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { reason = "user-declined" } = req.body;
    
    const call = await Call.findById(req.params.callId);
    if (!call) {
      return res.status(404).json({ error: "Call not found" });
    }

    if (call.status === "ringing") {
      call.status = "rejected";
      call.rejectionReason = reason;
      await call.save();
    }

    const io = req.app.get("io");
    if (io) {
      io.to(String(call.chat)).emit("callRejected", {
        callId: call._id,
        rejectedBy: userId,
        reason
      });
    }

    res.json(call);
  } catch (err) {
    console.error("REJECT CALL ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ==========================================
// POST /calls/:callId/end - End a call
// ==========================================
router.post("/:callId/end", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const call = await Call.findById(req.params.callId);

    if (!call) {
      return res.status(404).json({ error: "Call not found" });
    }

    if (call.status === "ongoing" || call.status === "ringing") {
      call.status = "ended";
      call.endedAt = new Date();

      // Calculate duration
      if (call.startedAt) {
        call.duration = Math.floor((call.endedAt - call.startedAt) / 1000);
      }

      // Update participant duration
      call.participants = call.participants.map(p => ({
        ...p,
        leftAt: new Date(),
        duration: Math.floor((new Date() - (p.joinedAt || call.startedAt || new Date())) / 1000)
      }));

      await call.save();
    }

    const io = req.app.get("io");
    if (io) {
      io.to(String(call.chat)).emit("callEnded", {
        callId: call._id,
        endedBy: userId,
        duration: call.duration
      });
    }

    res.json(call);
  } catch (err) {
    console.error("END CALL ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ==========================================
// GET /calls/chat/:chatId - Get call history
// ==========================================
router.get("/chat/:chatId", auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    const chat = await Chat.findOne({
      _id: chatId,
      members: { $in: [userId] }
    });

    if (!chat) {
      return res.status(403).json({ error: "Not a member of this chat" });
    }

    const calls = await Call.find({ chat: chatId })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate([
        { path: "caller", select: "name email avatarUrl" },
        { path: "receivers", select: "name email avatarUrl" },
        { path: "participants.user", select: "name email avatarUrl" }
      ]);

    res.json(calls);
  } catch (err) {
    console.error("GET CALL HISTORY ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ==========================================
// GET /calls/:callId - Get call details
// ==========================================
router.get("/:callId", auth, async (req, res) => {
  try {
    const call = await Call.findById(req.params.callId).populate([
      { path: "caller", select: "name email avatarUrl" },
      { path: "receivers", select: "name email avatarUrl" },
      { path: "participants.user", select: "name email avatarUrl" }
    ]);

    if (!call) {
      return res.status(404).json({ error: "Call not found" });
    }

    res.json(call);
  } catch (err) {
    console.error("GET CALL ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ==========================================
// DELETE /calls/:callId - Delete call history
// ==========================================
router.delete("/:callId", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const call = await Call.findById(req.params.callId);

    if (!call) {
      return res.status(404).json({ error: "Call not found" });
    }

    // Only caller or receivers can delete
    const isAuthorized = String(call.caller) === String(userId) || 
                         call.receivers.some(r => String(r) === String(userId));

    if (!isAuthorized) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await Call.deleteOne({ _id: req.params.callId });

    res.json({ message: "Call deleted" });
  } catch (err) {
    console.error("DELETE CALL ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
