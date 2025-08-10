import jwt from 'jsonwebtoken';

import { User } from '../models/userModel.js';
import { Logger } from './logger.js';

export const requireAuth = async (req) => {
  const token =
    req.cookies.token ||
    req.body.token ||
    req.headers.authorization?.replace('Bearer ', '');
  console.log(req.headers.authorization?.replace('Bearer ', ''));
  if (!token) {
    Logger.error('401:Token missing');
    throw new Error('401:Token missing');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      throw new Error('401:User not found');
    }
    // console.log(user);

    return user; // ✅ Valid authenticated user
  } catch (err) {
    throw new Error('401:Invalid or expired token', err);
  }
};
