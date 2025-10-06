import mongoose from 'mongoose';
import { User } from '../models/userModel.js';
import { pubsub } from '../utils/pubsub.js';


// Helper functions
const validateUserId = (userId) => {
  if (!userId) {
    throw new Error('User ID is required');
  }
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid user ID format');
  }
};

const validateUnreadType = (type) => {
  const validTypes = ['notifications', 'messages'];
  if (!type) {
    throw new Error('Unread type is required');
  }
  if (!validTypes.includes(type)) {
    throw new Error(`Invalid unread type. Must be one of: ${validTypes.join(', ')}`);
  }
};

const sanitizeUnreadCount = (count) => {
  const parsedCount = parseInt(count, 10);
  if (isNaN(parsedCount)) {
    throw new Error('Count must be a valid number');
  }
  if (parsedCount < 0) {
    throw new Error('Count cannot be negative');
  }
  return parsedCount;
};

// PubSub event constants
const UNREADS_UPDATED = 'UNREADS_UPDATED';

/**
 * Get user unreads
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User unreads object
 */
export const getUserUnreads = async (userId) => {
  try {
    validateUserId(userId);

    const user = await User.findById(userId).select('userUnreads');
    if (!user) {
      throw new Error('User not found');
    }

    return {
      notificationsUnreads: user.userUnreads?.notificationsUnreads || 0,
      messagesUnreads: user.userUnreads?.messagesUnreads || 0,
    };
  } catch (error) {
    throw new Error(`Failed to get user unreads: ${error.message}`);
  }
};

/**
 * Increment unread count
 * @param {string} userId - User ID
 * @param {string} type - Type of unread ('notifications' or 'messages')
 * @param {number} count - Count to increment (default: 1)
 * @returns {Promise<Object>} Updated unreads
 */
export const incrementUnread = async (userId, type, count = 1) => {
  try {
    validateUserId(userId);
    validateUnreadType(type);
    const sanitizedCount = sanitizeUnreadCount(count);

    const fieldName = `userUnreads.${type}Unreads`;

    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { [fieldName]: sanitizedCount } },
      { new: true, select: 'userUnreads' }
    );

    if (!user) {
      throw new Error('User not found');
    }

    const updatedUnreads = {
      userId,
      notificationsUnreads: user.userUnreads?.notificationsUnreads || 0,
      messagesUnreads: user.userUnreads?.messagesUnreads || 0,
    };

    // Publish update for real-time subscription
    pubsub.publish(UNREADS_UPDATED, {
      unreadsUpdated: updatedUnreads,
    });

    return updatedUnreads;
  } catch (error) {
    throw new Error(`Failed to increment unread: ${error.message}`);
  }
};

/**
 * Decrement unread count
 * @param {string} userId - User ID
 * @param {string} type - Type of unread ('notifications' or 'messages')
 * @param {number} count - Count to decrement (default: 1)
 * @returns {Promise<Object>} Updated unreads
 */
export const decrementUnread = async (userId, type, count = 1) => {
  try {
    validateUserId(userId);
    validateUnreadType(type);
    const sanitizedCount = sanitizeUnreadCount(count);

    const fieldName = `userUnreads.${type}Unreads`;

    // First get current value to prevent negative counts
    const currentUser = await User.findById(userId).select('userUnreads');
    if (!currentUser) {
      throw new Error('User not found');
    }

    const currentCount = currentUser.userUnreads?.[`${type}Unreads`] || 0;
    const decrementAmount = Math.min(sanitizedCount, currentCount);

    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { [fieldName]: -decrementAmount } },
      { new: true, select: 'userUnreads' }
    );

    const updatedUnreads = {
      userId,
      notificationsUnreads: user.userUnreads?.notificationsUnreads || 0,
      messagesUnreads: user.userUnreads?.messagesUnreads || 0,
    };

    // Publish update for real-time subscription
    pubsub.publish(UNREADS_UPDATED, {
      unreadsUpdated: updatedUnreads,
    });

    return updatedUnreads;
  } catch (error) {
    throw new Error(`Failed to decrement unread: ${error.message}`);
  }
};

/**
 * Set unread count to a specific value
 * @param {string} userId - User ID
 * @param {string} type - Type of unread ('notifications' or 'messages')
 * @param {number} count - Count to set
 * @returns {Promise<Object>} Updated unreads
 */
export const setUnreadCount = async (userId, type, count) => {
  try {
    validateUserId(userId);
    validateUnreadType(type);
    const sanitizedCount = sanitizeUnreadCount(count);

    const fieldName = `userUnreads.${type}Unreads`;

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { [fieldName]: sanitizedCount } },
      { new: true, select: 'userUnreads' }
    );

    if (!user) {
      throw new Error('User not found');
    }

    const updatedUnreads = {
      userId,
      notificationsUnreads: user.userUnreads?.notificationsUnreads || 0,
      messagesUnreads: user.userUnreads?.messagesUnreads || 0,
    };

    // Publish update for real-time subscription
    pubsub.publish(UNREADS_UPDATED, {
      unreadsUpdated: updatedUnreads,
    });

    return updatedUnreads;
  } catch (error) {
    throw new Error(`Failed to set unread count: ${error.message}`);
  }
};

/**
 * Reset all unreads for a specific type
 * @param {string} userId - User ID
 * @param {string} type - Type of unread ('notifications' or 'messages')
 * @returns {Promise<Object>} Updated unreads
 */
export const resetUnreads = async (userId, type) => {
  try {
    return await setUnreadCount(userId, type, 0);
  } catch (error) {
    throw new Error(`Failed to reset unreads: ${error.message}`);
  }
};

/**
 * Reset all unreads (both notifications and messages)
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Updated unreads
 */
export const resetAllUnreads = async (userId) => {
  try {
    validateUserId(userId);

    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          'userUnreads.notificationsUnreads': 0,
          'userUnreads.messagesUnreads': 0,
        },
      },
      { new: true, select: 'userUnreads' }
    );

    if (!user) {
      throw new Error('User not found');
    }

    const updatedUnreads = {
      userId,
      notificationsUnreads: 0,
      messagesUnreads: 0,
    };

    // Publish update for real-time subscription
    pubsub.publish(UNREADS_UPDATED, {
      unreadsUpdated: updatedUnreads,
    });

    return updatedUnreads;
  } catch (error) {
    throw new Error(`Failed to reset all unreads: ${error.message}`);
  }
};

/**
 * Batch update unreads for multiple users
 * @param {Array<Object>} updates - Array of {userId, type, count} objects
 * @returns {Promise<Array>} Array of updated unreads
 */
export const batchIncrementUnreads = async (updates) => {
  try {
    if (!Array.isArray(updates) || updates.length === 0) {
      throw new Error('Updates must be a non-empty array');
    }

    const results = await Promise.all(
      updates.map(({ userId, type, count = 1 }) =>
        incrementUnread(userId, type, count).catch((err) => ({
          error: err.message,
          userId,
          type,
        }))
      )
    );

    return results;
  } catch (error) {
    throw new Error(`Failed to batch increment unreads: ${error.message}`);
  }
};

/**
 * Subscribe to unread updates for a specific user
 * @param {string} userId - User ID to subscribe to
 * @returns {AsyncIterator} Subscription iterator
 */
export const subscribeToUnreads = (userId) => {
  validateUserId(userId);

  return pubsub.asyncIterableIterator([UNREADS_UPDATED]);
};

/**
 * Filter subscription payload for specific user
 * @param {Object} payload - Subscription payload
 * @param {Object} variables - Subscription variables
 * @returns {boolean} Whether to send update to subscriber
 */
export const filterUnreadsSubscription = (payload, variables) => {
  return payload.unreadsUpdated.userId === variables.userId;
};

/**
 * Get total unreads for a user (notifications + messages)
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Total unreads breakdown
 */
export const getTotalUserUnreads = async (userId) => {
  try {
    validateUserId(userId);

    const user = await User.findById(userId).select('userUnreads');
    if (!user) {
      throw new Error('User not found');
    }

    const notificationsUnreads = user.userUnreads?.notificationsUnreads || 0;
    const messagesUnreads = user.userUnreads?.messagesUnreads || 0;

    return {
      notificationsUnreads,
      messagesUnreads,
      totalUnreads: notificationsUnreads + messagesUnreads,
    };
  } catch (error) {
    throw new Error(`Failed to get total user unreads: ${error.message}`);
  }
};

// Export pubsub instance and event constant for GraphQL resolvers
export { pubsub, UNREADS_UPDATED };

