import mongoose from "mongoose";

const callSchema = new mongoose.Schema(
  {
    chat: { type: mongoose.Schema.Types.ObjectId, ref: "Chat", required: true },
    caller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receivers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // for group calls
    
    // Call type
    type: { 
      type: String, 
      enum: ["audio", "video"], 
      default: "audio" 
    },
    
    // Call status
    status: {
      type: String,
      enum: ["ringing", "ongoing", "ended", "missed", "rejected", "no-answer"],
      default: "ringing"
    },
    
    // Call timing
    startedAt: Date,
    endedAt: Date,
    
    // Duration in seconds
    duration: { type: Number, default: 0 },
    
    // Participants who joined
    participants: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      joinedAt: Date,
      leftAt: Date,
      duration: Number // individual duration
    }],
    
    // Call rejection reason
    rejectionReason: String, // "user-declined", "user-busy", "call-ended", etc.
    
    // Recording
    recordingUrl: String,
    isRecorded: { type: Boolean, default: false },
    
    // Call quality metrics
    quality: {
      avgLatency: Number, // milliseconds
      packetLoss: Number, // percentage
      jitter: Number
    }
  },
  { timestamps: true }
);

export default mongoose.model("Call", callSchema);
