const mongoose = require('mongoose');
const { Schema } = mongoose;

const NotificationSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: [
      'PROMOTIONAL',
      'JOB_OPPORTUNITY',
      'CONTENT_RECOMMENDATION',
      'SOCIAL_ACTIVITY',
      'PERSONALIZED_SUGGESTION',
      'PROFILE_ACTIVITY'
    ],
    required: true
  },
  // Optional actor or source (e.g., company, user, system)
  source: {
    id: Schema.Types.ObjectId,
    name: String,
    avatarUrl: String
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  // Optional image or icon URL
  imageUrl: {
    type: String
  },
  // Optional action button data
  action: {
    label: String,
    url: String
  },
  // Status indicator (e.g., unread, read)
  status: {
    type: String,
    enum: ['UNREAD', 'READ'],
    default: 'UNREAD'
  },
  // Timestamp for sorting/display
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Compound index for fast retrieval by user and status
NotificationSchema.index({ userId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);
