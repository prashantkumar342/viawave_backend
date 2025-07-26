// models/messageModel.ts
import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
  },
  fileType: {
    type: String, // e.g. "image", "video", "pdf", "audio", "other"
    required: true,
  },
  fileName: {
    type: String,
  },
  size: {
    type: Number, // in bytes
  },
});

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
    },
    attachments: [attachmentSchema], // ➕ added field for attachments
    seenBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

messageSchema.index({ conversation: 1, createdAt: -1 });

export const Message = mongoose.model("Message", messageSchema);
