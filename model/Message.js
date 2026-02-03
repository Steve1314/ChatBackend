import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    chat: { type: mongoose.Schema.Types.ObjectId, ref: "Chat", required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: String,
    media: [{ type: mongoose.Schema.Types.ObjectId, ref: "Media" }],
    deleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export default mongoose.model("Message", messageSchema);
