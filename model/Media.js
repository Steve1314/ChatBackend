import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema(
  {
    filename: String,
    mimetype: String,
    size: Number, // in bytes
    path: String, // local path or remote URL if using S3/Cloudinary
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    
    // Media classification
    type: { 
      type: String, 
      enum: ["image", "video", "audio", "document", "other"], 
      default: "other" 
    },
    
    // Image/Video thumbnails
    thumbnailUrl: String,
    
    // Video specific
    duration: Number, // in seconds
    width: Number,
    height: Number,
    
    // Metadata
    description: String,
    caption: String,
    
    // Compression status
    isCompressed: { type: Boolean, default: false },
    originalSize: Number, // original size before compression
    
    // Download count
    downloadCount: { type: Number, default: 0 },
    
    // Virus scan status
    virusScanned: { type: Boolean, default: false },
    isSafe: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export default mongoose.model("Media", mediaSchema);

