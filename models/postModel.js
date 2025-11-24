import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const baseOptions = {
  timestamps: true,
  discriminatorKey: 'type', // adds a `type` field automatically
};

// Base Post Schema
const PostSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    caption: { type: String, trim: true },

    // Flexible media field (images or video)
    media: [
      {
        url: { type: String, required: true },
        type: { type: String, enum: ['image', 'video'], required: true },
        thumbnailUrl: { type: String, required: false, default: '' },
      },
    ],
    likesCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
  },
  baseOptions
);

const Post = model('Post', PostSchema);

// Article Post (adds title)
const ArticlePost = Post.discriminator(
  'Article',
  new Schema({
    title: { type: String, required: true },
  })
);

export { ArticlePost, Post };
