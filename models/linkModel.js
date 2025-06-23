import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const LinkSchema = new Schema({
  requester: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  recipient: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['requested', 'linked', 'rejected', 'blocked'],
    default: 'requested',
  },
  actionBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  reason: {
    type: String, // Optional message for rejection/blocking
    trim: true,
  }
}, {
  timestamps: true, // adds createdAt and updatedAt
});

// Optional: unique constraint to avoid duplicate link requests
LinkSchema.index({ requester: 1, recipient: 1 }, { unique: true });

const Link = model('Link', LinkSchema);

export default Link;
