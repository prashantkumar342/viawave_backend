import { Conversation as ConversationModel } from '../models/conversationModel.js';
import { Notification } from '../models/notificationModel.js';
import { User } from '../models/userModel.js';
import { Logger } from '../utils/logger.js';

/**
 * Sync user unreads from actual database counts
 * This ensures the userUnreads field matches actual unread items
 * Should be called on user login or periodically
 * 
 * @param {string} userId - User ID to sync unreads for
 * @returns {Promise<Object>} Updated unreads
 */
export const syncUserUnreads = async (userId) => {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Count actual unread notifications
    const notificationsUnreads = await Notification.countDocuments({
      userId: userId,
      status: 'UNREAD',
    });

    // Count actual unread messages across all conversations
    // Get all conversations the user participates in
    const conversations = await ConversationModel.find({
      participants: userId,
    }).select('_id unreadCounts');

    let messagesUnreads = 0;
    for (const conversation of conversations) {
      const userIdStr = String(userId);

      // Get unread count from conversation
      if (conversation.unreadCounts) {
        if (typeof conversation.unreadCounts.get === 'function') {
          messagesUnreads += conversation.unreadCounts.get(userIdStr) || 0;
        } else if (typeof conversation.unreadCounts === 'object') {
          messagesUnreads += conversation.unreadCounts[userIdStr] || 0;
        }
      }
    }

    // Update user's unreads field
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          'userUnreads.notificationsUnreads': notificationsUnreads,
          'userUnreads.messagesUnreads': messagesUnreads,
        },
      },
      { new: true, select: 'userUnreads' }
    );

    if (!user) {
      throw new Error('User not found');
    }

    Logger.info(`✅ Synced unreads for user ${userId}: ${notificationsUnreads} notifications, ${messagesUnreads} messages`);

    return {
      userId,
      notificationsUnreads,
      messagesUnreads,
      totalUnreads: notificationsUnreads + messagesUnreads,
      synced: true,
    };
  } catch (error) {
    Logger.error(`❌ Failed to sync unreads for user ${userId}:`, error);
    throw new Error(`Failed to sync user unreads: ${error.message}`);
  }
};

/**
 * Batch sync unreads for multiple users
 * Useful for maintenance tasks or migrations
 * 
 * @param {Array<string>} userIds - Array of user IDs
 * @returns {Promise<Array>} Array of sync results
 */
export const batchSyncUserUnreads = async (userIds) => {
  try {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new Error('userIds must be a non-empty array');
    }

    Logger.info(`🔄 Starting batch sync for ${userIds.length} users...`);

    const results = await Promise.allSettled(
      userIds.map((userId) => syncUserUnreads(userId))
    );

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    Logger.info(`✅ Batch sync complete: ${successful} successful, ${failed} failed`);

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          userId: userIds[index],
          error: result.reason.message,
          synced: false,
        };
      }
    });
  } catch (error) {
    Logger.error('❌ Batch sync unreads error:', error);
    throw error;
  }
};

/**
 * Sync unreads for all users in the database
 * Use with caution - can be resource intensive
 * 
 * @param {number} batchSize - Number of users to process at once
 * @returns {Promise<Object>} Sync summary
 */
export const syncAllUsersUnreads = async (batchSize = 100) => {
  try {
    Logger.info('🔄 Starting sync for all users...');

    const totalUsers = await User.countDocuments();
    let processed = 0;
    let successful = 0;
    let failed = 0;

    // Process users in batches
    for (let skip = 0; skip < totalUsers; skip += batchSize) {
      const users = await User.find()
        .select('_id')
        .skip(skip)
        .limit(batchSize)
        .lean();

      const userIds = users.map((u) => String(u._id));
      const results = await batchSyncUserUnreads(userIds);

      successful += results.filter((r) => r.synced).length;
      failed += results.filter((r) => !r.synced).length;
      processed += userIds.length;

      Logger.info(`Progress: ${processed}/${totalUsers} users processed`);
    }

    const summary = {
      totalUsers,
      processed,
      successful,
      failed,
      completedAt: new Date().toISOString(),
    };

    Logger.info('✅ All users sync complete:', summary);

    return summary;
  } catch (error) {
    Logger.error('❌ Sync all users unreads error:', error);
    throw error;
  }
};

/**
 * Verify unreads accuracy for a user
 * Compares stored unreads with actual counts
 * 
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Verification result
 */
export const verifyUserUnreads = async (userId) => {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const user = await User.findById(userId).select('userUnreads');
    if (!user) {
      throw new Error('User not found');
    }

    const storedNotifications = user.userUnreads?.notificationsUnreads || 0;
    const storedMessages = user.userUnreads?.messagesUnreads || 0;

    // Count actual unreads
    const actualNotifications = await Notification.countDocuments({
      userId: userId,
      status: 'UNREAD',
    });

    const conversations = await ConversationModel.find({
      participants: userId,
    }).select('unreadCounts');

    let actualMessages = 0;
    for (const conversation of conversations) {
      const userIdStr = String(userId);
      if (conversation.unreadCounts) {
        if (typeof conversation.unreadCounts.get === 'function') {
          actualMessages += conversation.unreadCounts.get(userIdStr) || 0;
        } else if (typeof conversation.unreadCounts === 'object') {
          actualMessages += conversation.unreadCounts[userIdStr] || 0;
        }
      }
    }

    const notificationsMatch = storedNotifications === actualNotifications;
    const messagesMatch = storedMessages === actualMessages;
    const isAccurate = notificationsMatch && messagesMatch;

    return {
      userId,
      isAccurate,
      stored: {
        notifications: storedNotifications,
        messages: storedMessages,
        total: storedNotifications + storedMessages,
      },
      actual: {
        notifications: actualNotifications,
        messages: actualMessages,
        total: actualNotifications + actualMessages,
      },
      differences: {
        notifications: actualNotifications - storedNotifications,
        messages: actualMessages - storedMessages,
      },
    };
  } catch (error) {
    Logger.error(`❌ Failed to verify unreads for user ${userId}:`, error);
    throw error;
  }
};