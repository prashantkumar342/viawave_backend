import { Message } from '../models/messageModel.js';
import { Notification } from '../models/notificationModel.js';
import { Logger } from '../utils/logger.js';
import { pubsub } from '../utils/pubsub.js';

/**
 * PubSub topic generator for user unread updates
 */
export const userUnreadTopic = (userId) => `USER_UNREADS_${String(userId)}`;

/**
 * Calculate current unread counts for a user
 */
export async function getUserUnreadCounts(userId) {
  try {
    const [unreadMessages, unreadNotifications] = await Promise.all([
      Message.countDocuments({ seenBy: { $ne: userId } }),
      Notification.countDocuments({ userId, status: 'UNREAD' }),
    ]);

    return { unreadMessages, unreadNotifications };
  } catch (error) {
    Logger.error(`❌ Failed to fetch unread counts for user ${userId}:`, error);
    return { unreadMessages: 0, unreadNotifications: 0 };
  }
}

/**
 * Publish updated unread counts to subscribed clients
 */
export async function publishUserUnreadUpdate(userId) {
  try {
    const unreadCounts = await getUserUnreadCounts(userId);

    const payload = {
      userUnreadUpdated: {
        userId,
        ...unreadCounts,
      },
    };

    await pubsub.publish(userUnreadTopic(userId), payload);

    Logger.info(`✅ USER_UNREADS published for user ${userId}`, unreadCounts);
    return payload.userUnreadUpdated;
  } catch (error) {
    Logger.error(`❌ Failed to publish USER_UNREADS for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Safe wrapper to trigger unread updates without breaking main flow
 */
export async function safeUserUnreadUpdate(userId, context = 'Unread update') {
  try {
    await publishUserUnreadUpdate(userId);
  } catch (error) {
    Logger.error(`⚠️ ${context} failed for user ${userId}:`, error);
  }
}
