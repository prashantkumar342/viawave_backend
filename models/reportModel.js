// models/Report.js
import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const ReportSchema = new Schema({
  reporter: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  targetUser: {
    type: Schema.Types.ObjectId,
    ref: 'User', // This is for reports involving users
  },
  targetPost: {
    type: Schema.Types.ObjectId,
    ref: 'Post', // This is for reports involving posts
  },
  targetComment: {
    type: Schema.Types.ObjectId,
    ref: 'Comment', // This is for reports involving comments
  },
  targetMessage: {
    type: Schema.Types.ObjectId,
    ref: 'Message', // This is for reports involving messages
  },
  reportReason: {
    type: Schema.Types.ObjectId,
    ref: 'Guideline', // This points to the violated guideline
    required: true,
  },
  description: {
    type: String,
    trim: true,
  },
  breakedGuidelines: [{
    type: Schema.Types.ObjectId,
    ref: 'Guideline', // Linking multiple guidelines that are violated
  }],
  caseStatus: {
    type: String,
    enum: ['active', 'closed'],
    default: 'active',
  },
  handledBy: {
    type: Schema.Types.ObjectId,
    ref: 'User', // Admin/Moderator
  },
  resolutionNotes: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
});

const Report = model('Report', ReportSchema);

export default Report;
