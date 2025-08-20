// models/conversationModel.ts
import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['PRIVATE', 'GROUP'],
      default: 'PRIVATE',
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],

    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
    },

    // For group conversations
    groupName: {
      type: String,
    },
    groupAvatar: {
      type: String,
    },

    // Track unread count per user
    unreadCounts: {
      type: Map,
      of: Number, // { userId: count }
      default: {},
    },
  },
  { timestamps: true }
);

// Indexes
conversationSchema.index({ participants: 1 }); // optimize queries for user's conversations
conversationSchema.index({ updatedAt: -1 });   // for sorting by activity

export const Conversation = mongoose.model('Conversation', conversationSchema);
