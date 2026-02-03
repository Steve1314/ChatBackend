import mongoose from "mongoose";

const chatSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["private", "group"], default: "private" },
    name: String, // for group
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    lastMessageAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export default mongoose.model("Chat", chatSchema);
