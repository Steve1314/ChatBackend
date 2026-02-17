import express from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";

// Routes
import authRoutes from "./routes/auth.routes.js";
import usersRoutes from "./routes/users.routes.js";
import chatsRoutes from "./routes/chats.routes.js";
import messagesRoutes from "./routes/messages.routes.js";
import contactsRoutes from "./routes/contacts.routes.js";
import mediaRoutes from "./routes/media.routes.js";
import notificationsRoutes from "./routes/notifications.routes.js";
import callsRoutes from "./routes/calls.routes.js";

dotenv.config();

const app = express();
const server = http.createServer(app);

// ------------------ CORS ORIGINS ------------------
const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(",").map((s) => s.trim())
  : ["*"];

// ------------------ SOCKET.IO ------------------
const io = new SocketIOServer(server, {
  cors: {
    origin: (origin, callback) => {
      callback(null, true); // allow all origins
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// ------------------ MIDDLEWARES ------------------
app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, true); // allow all origins
    },
    credentials: true,
  })
);


app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));

// Serve static uploads
app.use("/media", express.static("uploads"));

// ------------------ ROUTES ------------------
app.use("/auth", authRoutes);
app.use("/users", usersRoutes);
app.use("/chats", chatsRoutes);
app.use("/", messagesRoutes); // /chats/:chatId/messages & /messages/:id
app.use("/contacts", contactsRoutes);
app.use("/media", mediaRoutes);
app.use("/notifications", notificationsRoutes);
app.use("/calls", callsRoutes);

app.get("/health", (req, res) => res.json({ ok: true }));

// ------------------- PRESENCE STORAGE -------------------
const onlineUsers = new Set(); // set of emails
const emailToSocketId = new Map(); // email => socket.id
const lastSeenMap = new Map(); // email => timestamp (ms)

// Queue ICE candidates for offline users
const iceCandidateQueue = new Map(); // email => [{ candidate, callId, fromEmail }]

app.set("onlineUsers", onlineUsers);
app.set("io", io);

const getSocketIdByEmail = (email) => emailToSocketId.get(email);

io.on("connection", (socket) => {
  console.log("✅ Client connected:", socket.id);

  // ------------------- IDENTIFY -------------------
  socket.on("identify", ({ email }) => {
    if (!email) return;

    socket.data.email = email;

    onlineUsers.add(email);
    emailToSocketId.set(email, socket.id);

    if (!lastSeenMap.has(email)) lastSeenMap.set(email, null);

    // send status update
    io.emit("userStatus", {
      email,
      online: true,
      lastSeen: lastSeenMap.get(email),
    });
    io.emit("presence", { online: Array.from(onlineUsers) });

    // Send any queued ICE candidates
    const queued = iceCandidateQueue.get(email) || [];
    queued.forEach(({ candidate, callId, fromEmail }) => {
      io.to(socket.id).emit("iceCandidate", { candidate, callId, fromEmail });
      console.log(`✅ Sent queued ICE candidate to ${email}`);
    });
    iceCandidateQueue.delete(email);
  });

  // ------------------- CHAT ROOMS -------------------
  socket.on("joinChat", ({ chatId }) => {
    if (chatId) socket.join(String(chatId));
  });

  socket.on("leaveChat", ({ chatId }) => {
    if (chatId) socket.leave(String(chatId));
  });

  // ------------------- TYPING -------------------
  socket.on("typing", ({ chatId, email }) => {
    if (!chatId || !email) return;
    socket.to(String(chatId)).emit("typing", { chatId, email });
  });

  socket.on("stopTyping", ({ chatId, email }) => {
    if (!chatId || !email) return;
    socket.to(String(chatId)).emit("stopTyping", { chatId, email });
  });

  // ------------------- MESSAGE READ RECEIPTS -------------------
  socket.on("messageRead", ({ chatId, messageId, email }) => {
    if (!chatId || !messageId || !email) return;
    socket.to(String(chatId)).emit("messageReadReceipt", {
      messageId,
      readBy: email,
      readAt: new Date(),
    });
  });

  socket.on("messagesDelivered", ({ chatId, messageIds }) => {
    if (!chatId || !messageIds) return;
    socket.to(String(chatId)).emit("deliveryReceipt", {
      messageIds,
      deliveredAt: new Date(),
    });
  });

  // ------------------- CALLING FEATURE (WebRTC Signaling) -------------------

  // Initiate call
  socket.on(
    "initiateCall",
    ({ toEmail, fromEmail, chatId, callType = "audio" }) => {
      if (!toEmail || !fromEmail || !chatId) return;
      const targetId = getSocketIdByEmail(toEmail);
      if (targetId) {
        io.to(targetId).emit("incomingCall", {
          fromEmail,
          chatId,
          callType,
          timestamp: new Date(),
        });
        console.log(`📞 Incoming call from ${fromEmail} to ${toEmail}`);
      }
    },
  );

  // Call offer
  socket.on("callOffer", ({ toEmail, fromEmail, offer, callId }) => {
    if (!toEmail || !fromEmail || !offer) return;
    const targetId = getSocketIdByEmail(toEmail);
    if (targetId) {
      io.to(targetId).emit("callOffer", { fromEmail, offer, callId });
      console.log(`📋 Forwarded callOffer from ${fromEmail} to ${toEmail}`);
    }
  });

  // Call answer
  socket.on("callAnswer", ({ toEmail, fromEmail, answer, callId }) => {
    if (!toEmail || !answer) return;
    const targetId = getSocketIdByEmail(toEmail);
    if (targetId) {
      io.to(targetId).emit("callAnswer", { fromEmail, answer, callId });
      console.log(`📋 Forwarded callAnswer from ${fromEmail} to ${toEmail}`);
    }
  });

  // ICE candidate
  socket.on("iceCandidate", ({ toEmail, candidate, callId, fromEmail }) => {
    if (!toEmail || !candidate) return;

    const targetId = getSocketIdByEmail(toEmail);
    if (targetId) {
      io.to(targetId).emit("iceCandidate", { candidate, callId, fromEmail });
      console.log(`🧊 ICE candidate sent from ${fromEmail} to ${toEmail}`);
    } else {
      // Queue candidate for later if callee offline
      if (!iceCandidateQueue.has(toEmail)) iceCandidateQueue.set(toEmail, []);
      iceCandidateQueue.get(toEmail).push({ candidate, callId, fromEmail });
      console.log(`🧊 ICE candidate queued for offline user ${toEmail}`);
    }
  });

  // Add to your socket.io backend
  socket.on("muteState", (data) => {
    socket.to(data.toEmail).emit("muteState", {
      isMuted: data.isMuted,
      callId: data.callId,
    });
  });

  // End call
  socket.on("endCall", ({ toEmail, callId }) => {
    if (!toEmail) return;
    const targetId = getSocketIdByEmail(toEmail);
    if (targetId) io.to(targetId).emit("callEnded", { callId });
  });

  // Reject call
  socket.on("rejectCall", ({ toEmail, callId, reason = "user-declined" }) => {
    if (!toEmail) return;
    const targetId = getSocketIdByEmail(toEmail);
    if (targetId) io.to(targetId).emit("callRejected", { callId, reason });
  });

  // ------------------- DISCONNECT -------------------
  socket.on("disconnect", () => {
    const email = socket.data.email;

    if (email) {
      onlineUsers.delete(email);
      emailToSocketId.delete(email);
      lastSeenMap.set(email, Date.now());

      io.emit("userStatus", {
        email,
        online: false,
        lastSeen: lastSeenMap.get(email),
      });
      io.emit("presence", { online: Array.from(onlineUsers) });
    }

    console.log("❌ Client disconnected:", socket.id);
  });
});

// ------------------ START SERVER ------------------
const PORT = process.env.PORT || 5000;

connectDB(process.env.MONGO_URI)
  .then(() => {
    server.listen(PORT, () => {
      console.log(`🚀 API + Socket running on http://localhost:${PORT}`);
      console.log("Allowed origins:", allowedOrigins);
    });
  })
  .catch((e) => {
    console.error("Mongo connection failed:", e);
    process.exit(1);
  });
