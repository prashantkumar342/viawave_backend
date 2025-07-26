import mongoose from 'mongoose';

import { Logger } from '../utils/logger.js';

const connectDb = async (url) => {
  try {
    await mongoose.connect(url);
    Logger.success('💾 Connected to MongoDB');
  } catch (error) {
    Logger.error('Error connecting to the database: ', error.message);
    // Retry logic
    setTimeout(() => connectDb(url), 5000);
  }
};
export default connectDb;
