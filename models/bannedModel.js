// models/Banned.js
import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const BannedSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  bannedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User', // Admin/Moderator who banned the user
    required: true,
  },
  reason: {
    type: String,
    enum: ['harassment', 'spamming', 'hate_speech', 'violence', 'nudity', 'misinformation', 'other'],
    required: true,
  },
  banStartDate: {
    type: Date,
    default: Date.now,
  },
  banEndDate: {
    type: Date, // If the ban is temporary
  },
  permanentBan: {
    type: Boolean,
    default: false, // Indicates if the ban is permanent
  },
  notes: {
    type: String,
    trim: true,
  },
  active: {
    type: Boolean,
    default: true, // If the ban is still active
  },
}, {
  timestamps: true,
});

const Banned = model('Banned', BannedSchema);

export default Banned;
