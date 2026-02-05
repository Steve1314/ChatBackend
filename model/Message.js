import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    chat: { type: mongoose.Schema.Types.ObjectId, ref: "Chat", required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: String,
    media: [{ type: mongoose.Schema.Types.ObjectId, ref: "Media" }],
    
    // Message Status (WhatsApp-like: sent, delivered, read)
    status: { 
      type: String, 
      enum: ["sent", "delivered", "read"], 
      default: "sent" 
    },
    
    // Read receipts - track who read the message and when
    readBy: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      readAt: { type: Date, default: Date.now }
    }],
    
    // Message editing
    editedAt: Date,
    editHistory: [{
      oldText: String,
      editedAt: { type: Date, default: Date.now }
    }],
    
    // Reply to feature (quote/forward)
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
    
    // Message deletion (soft delete for retained read receipts)
    deleted: { type: Boolean, default: false },
    deletedAt: Date,
    deletedForEveryone: { type: Boolean, default: false },
    
    // Message type classification
    type: { 
      type: String, 
      enum: ["text", "image", "video", "audio", "document", "location", "contact"], 
      default: "text" 
    },
    
    // Starred/Pinned message
    starred: { type: Boolean, default: false },
    pinned: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export default mongoose.model("Message", messageSchema);
