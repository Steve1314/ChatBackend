import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema(
  {
    filename: String,
    mimetype: String,
    size: Number,
    path: String, // local path or remote URL if using S3/Cloudinary
    uploader: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

export default mongoose.model("Media", mediaSchema);
