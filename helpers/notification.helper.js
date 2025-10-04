import { createSocialActivity, deleteLinkRequestNotification } from '../services/notifications.service.js';
import { Logger } from '../utils/logger.js';
import { pubsub } from '../utils/pubsub.js';

/**
 * Notification update types
 */
export const NOTIFICATION_UPDATE_TYPES = {
  NEW: 'NEW',
  DELETED: 'DELETED',
  READ: 'READ',
  UPDATED: 'UPDATED',
  BATCH_DELETE: 'BATCH_DELETE'
};

/**
 * Generate notification topic for pubsub
 */
export const notificationTopic = (userId) => `NOTIFICATION_${String(userId)}`;

/**
 * Helper to create and publish notifications consistently
 * 
 * @param {string} recipientId - User ID who will receive the notification
 * @param {string} actorId - User ID who triggered the notification
 * @param {string} actorName - Name of the actor
 * @param {string|null} actorAvatar - Avatar URL of the actor
 * @param {string} title - Notification title
 * @param {string} description - Notification description
 * @param {string|null} actionText - Action button text (optional)
 * @param {string|null} actionData - Action data (optional)
 * @param {string} updateType - Type of notification update (NEW, DELETED, etc.)
 * @returns {Promise<Object>} The published notification object
 */
export async function createAndPublishNotificationSocialActivity(
  recipientId,
  actorId,
  actorName,
  actorAvatar,
  title,
  description,
  actionText = null,
  actionData = null,
  updateType = NOTIFICATION_UPDATE_TYPES.NEW
) {
  try {
    const rawNotification = await createSocialActivity(
      recipientId,
      actorId,
      actorName,
      actorAvatar,
      title,
      description,
      actionText,
      actionData
    );

    // Normalize notification object
    const notificationObj = rawNotification.toObject
      ? rawNotification.toObject()
      : rawNotification;

    // Add consistent metadata
    const notification = {
      ...notificationObj,
      id: notificationObj._id.toString(),
      notificationUpdate: updateType
    };

    // Publish to subscriber
    pubsub.publish(notificationTopic(recipientId), {
      notificationUpdateListen: notification
    });

    Logger.info(`✅ Notification published: ${updateType} for user ${recipientId}`);
    return notification;
  } catch (error) {
    Logger.error('❌ Failed to create/publish notification:', error);
    throw error;
  }
}

/**
 * Helper to delete and publish notification removal
 * 
 * @param {string} recipientId - User ID whose notification should be deleted
 * @param {string} actorId - User ID who triggered the notification
 * @returns {Promise<Object>} The published notification deletion object
 */
export async function deleteAndPublishNotification(recipientId, actorId) {
  try {
    const result = await deleteLinkRequestNotification(recipientId, actorId);

    // Normalize the result object
    const notificationObj = result.toObject ? result.toObject() : result;

    // Add consistent metadata
    const notification = {
      ...notificationObj,
      id: notificationObj._id?.toString() || notificationObj.id,
      notificationUpdate: NOTIFICATION_UPDATE_TYPES.DELETED
    };

    // Publish deletion to subscriber
    pubsub.publish(notificationTopic(recipientId), {
      notificationUpdateListen: notification
    });

    Logger.info(`✅ Notification deletion published for user ${recipientId}`);
    return notification;
  } catch (error) {
    Logger.error('❌ Failed to delete/publish notification:', error);
    throw error;
  }
}

/**
 * Wrapper for non-critical notification operations
 * Catches errors and logs them without throwing
 * 
 * @param {Function} notificationFn - Async function that creates/publishes notification
 * @param {string} context - Context description for logging
 */
export async function safeNotification(notificationFn, context = 'Notification operation') {
  try {
    await notificationFn();
  } catch (error) {
    Logger.error(`❌ ${context} failed:`, error);
    // Don't throw - notifications should not break main operations
  }
}