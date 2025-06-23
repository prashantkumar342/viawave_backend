// models/Block.js
import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const BlockSchema = new Schema({
  blocker: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  blocked: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  reason: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
  indexes: [{ unique: true, fields: ['blocker', 'blocked'] }],
});

const Block = model('Block', BlockSchema);

export default Block;
