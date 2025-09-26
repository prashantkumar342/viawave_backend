// models/Block.js
import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const BlockListSchema = new Schema({
  blocker: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  blocked: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  }
}, {
  timestamps: true,
  indexes: [{ blocker: 1, blocked: 1 }, { unique: true }],
});

const BlockList = model('BlockList', BlockListSchema);

export default BlockList;