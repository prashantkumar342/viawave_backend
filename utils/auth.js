import jwt from 'jsonwebtoken';

import { User } from '../models/userModel.js';
import { Logger } from './logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = '7d'; // token expiration, adjust as needed

/**
 * Generate a JWT token for a user.
 * @param {Object} user - User object
 * @returns {string} JWT token
 */
export const generateToken = (user) => {
  const payload = {
    id: user._id,
    email: user.email,
    username: user.username,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

/**
 * Verify a JWT token.
 * @param {string} token
 * @returns {Object} Decoded token payload if valid
 * @throws Error if invalid or expired
 */
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    Logger.error('401: Invalid or expired token', err);
    throw new Error('401: Invalid or expired token');
  }
};

/**
 * Middleware-like function to require authentication.
 * Extracts token from req (cookies, body or headers) and verifies user.
 * @param {Object} req - HTTP Request object
 * @returns {Promise<Object>} User document if authenticated
 */
export const requireAuth = async (req) => {
  const token =
    req.cookies?.token ||
    req.body?.token ||
    req.headers?.authorization?.replace('Bearer ', '');

  if (!token) {
    Logger.error('401: Token missing');
    throw new Error('401: Token missing');
  }

  const decoded = verifyToken(token);

  const user = await User.findById(decoded.id);

  if (!user) {
    Logger.error('401: User not found');
    throw new Error('401: User not found');
  }

  return user;
};
