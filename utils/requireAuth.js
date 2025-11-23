import jwt from 'jsonwebtoken';

import { User } from '../models/userModel.js';
import { Logger } from './logger.js';

export const requireAuth = async (source) => {
  let token;

  // ✅ Case 1: HTTP request (Express req object)
  if (source?.cookies || source?.headers || source?.body) {
    token =
      source.cookies?.token ||
      source.body?.token ||
      source.headers?.authorization?.replace('Bearer ', '');
  }

  // ✅ Case 2: WebSocket or custom context (direct token)
  if (!token && source?.token) {
    token = source.token.startsWith('Bearer ')
      ? source.token.slice(7)
      : source.token;
  }

  // 🔥 NEW: Case 3: Direct string token (for WebSocket subscriptions)
  if (!token && typeof source === 'string') {
    token = source.startsWith('Bearer ') ? source.slice(7) : source;
  }

  // console.log('Auth Token:', token ? '***' + token.slice(-8) : 'NOT_FOUND');

  if (!token) {
    Logger.warn('No token provided in request');
    throw new Error('401:Token missing');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      throw new Error('401:User not found');
    }

    // Logger.info(`✅ Auth success for user: ${user.username || user._id}`);
    return user; // ✅ Valid authenticated user
  } catch (err) {
    Logger.error(`401:Invalid or expired token -> ${err.message}`);
    throw new Error('401:Invalid or expired token');
  }
};
