import mongoose from "mongoose";

const chatSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["private", "group"], default: "private" },
    name: String, // for group
    description: String, // group description
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    
    // Group-specific fields
    admin: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // group admin
    groupImage: String, // group profile picture URL
    
    // Muted notifications (user won't get notifications)
    mutedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    
    // Archived chats
    archivedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    
    // Last message details
    lastMessageAt: { type: Date, default: Date.now },
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
    
    // Block list
    blockedMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    
    // Chat color/theme
    theme: { type: String, default: null },
    
    // Member roles in group
    memberRoles: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      role: { type: String, enum: ["admin", "moderator", "member"], default: "member" }
    }],
    
    // Disappearing messages (24 hours, 7 days, 90 days, etc.)
    disappearingMessages: { type: Boolean, default: false },
    disappearingDuration: { type: Number, default: null } // in milliseconds
  },
  { timestamps: true }
);

export default mongoose.model("Chat", chatSchema);
