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
    origin: allowedOrigins.includes("*") ? "*" : allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// ------------------ MIDDLEWARES ------------------
app.use(
  cors({
    origin: allowedOrigins.includes("*") ? "*" : allowedOrigins,
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

app.get("/health", (req, res) => res.json({ ok: true }));

// ------------------ PRESENCE STORAGE ------------------
// ------------------ PRESENCE STORAGE ------------------
const onlineUsers = new Set(); // set of emails
const emailToSocketId = new Map(); // email => socket.id
const lastSeenMap = new Map(); // email => timestamp (ms)

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

    // if user never had lastSeen -> keep null
    if (!lastSeenMap.has(email)) lastSeenMap.set(email, null);

    // send status update
    io.emit("userStatus", {
      email,
      online: true,
      lastSeen: lastSeenMap.get(email),
    });

    // keep existing presence too
    io.emit("presence", { online: Array.from(onlineUsers) });
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

  // ------------------- CALLING FEATURE -------------------
  socket.on("callUser", ({ toEmail, fromEmail, offer }) => {
    if (!toEmail || !fromEmail || !offer) return;
    const targetId = getSocketIdByEmail(toEmail);
    if (targetId) {
      io.to(targetId).emit("incomingCall", { fromEmail, offer });
    }
  });

  socket.on("answerCall", ({ toEmail, answer }) => {
    if (!toEmail || !answer) return;
    const targetId = getSocketIdByEmail(toEmail);
    if (targetId) {
      io.to(targetId).emit("callAnswered", answer);
    }
  });

  socket.on("iceCandidate", ({ toEmail, candidate }) => {
    if (!toEmail || !candidate) return;
    const targetId = getSocketIdByEmail(toEmail);
    if (targetId) {
      io.to(targetId).emit("iceCandidate", candidate);
    }
  });

  socket.on("endCall", ({ toEmail }) => {
    if (!toEmail) return;
    const targetId = getSocketIdByEmail(toEmail);
    if (targetId) {
      io.to(targetId).emit("callEnded");
    }
  });

  // ------------------- DISCONNECT -------------------
  socket.on("disconnect", () => {
    const email = socket.data.email;

    if (email) {
      onlineUsers.delete(email);
      emailToSocketId.delete(email);

      // set last seen at disconnect
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
