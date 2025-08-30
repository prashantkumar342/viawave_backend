import mongoose from "mongoose";
const { Schema, model } = mongoose;

const commentSchema = new Schema({
  post: { type: Schema.Types.ObjectId, ref: "Post", required: true },
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  text: { type: String, required: true },
  parentComment: { type: Schema.Types.ObjectId, ref: "Comment", default: null }, // reply support
}, { timestamps: true });

export const Comment = model("Comment", commentSchema);
