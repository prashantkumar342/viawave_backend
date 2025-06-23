import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const NotificationSchema = new Schema({
  recipient: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  sender: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null, // system notifications may not have a sender
  },
  type: {
    type: String,
    enum: [
      'like',
      'comment',
      'mention',
      'link_request',
      'link_accept',
      'post_tag',
      'new_follower',
      'system',
    ],
    required: true,
  },
  post: {
    type: Schema.Types.ObjectId,
    ref: 'Post',
  },
  link: {
    type: Schema.Types.ObjectId,
    ref: 'Link',
  },
  message: {
    type: String,
    trim: true,
  },
  isRead: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

const Notification = model('Notification', NotificationSchema);

export default Notification;
