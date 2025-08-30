import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const baseOptions = {
  timestamps: true,
  discriminatorKey: 'type', // adds a `type` field for post types
};

const PostSchema = new Schema({
  author: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  caption: {
    type: String,
    trim: true,
  },
  tags: [String], // optional hashtags or keywords
  likesCount: { type: Number, default: 0 },
  commentsCount: { type: Number, default: 0 },
}, baseOptions);

// Base Post Model
const Post = model('Post', PostSchema);

// Discriminator for Article Post
const ArticlePost = Post.discriminator('Article', new Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
}));

// Discriminator for Image Post
const ImagePost = Post.discriminator('Image', new Schema({
  images: [{ type: String, required: true }], // array of image URLs
}));

// Discriminator for Video Post
const VideoPost = Post.discriminator('Video', new Schema({
  videoUrl: { type: String, required: true },
  thumbnailUrl: { type: String },
}));

export { Post, ArticlePost, ImagePost, VideoPost };
