// models/Guideline.js
import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const GuidelineSchema = new Schema({
  title: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    enum: ['content', 'behavior', 'spam', 'harassment', 'other'],
    required: true,
  },
  active: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

const Guideline = model('Guideline', GuidelineSchema);

export default Guideline;
