import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const HashtagSchema = new Schema({
  tag: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  usedBy: [
    {
      type: Schema.Types.ObjectId,
      ref: 'User',
    }
  ],
  posts: [
    {
      type: Schema.Types.ObjectId,
      ref: 'Post',
    }
  ],
  usageCount: {
    type: Number,
    default: 1,
  },
  trendingScore: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

HashtagSchema.index({ tag: 1 }); // for fast searching by tag

const Hashtag = model('Hashtag', HashtagSchema);

export default Hashtag;
