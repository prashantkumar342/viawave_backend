import { deleteNotificationAndPublish, markNotificationAsReadAndPublish } from '../helpers/notification.helper.js';
import {
  deleteAllNotifications,
  getNotifications,
  getUnreadCount,
  markAllAsRead,
} from '../services/notifications.service.js';
import { Logger } from '../utils/logger.js';
import { requireAuth } from '../utils/requireAuth.js';

export const notificationResolvers = {
  Query: {
    getNotifications: async (_, { limit = 20, offset = 0, status }, context) => {
      try {
        const user = await requireAuth(context.req);
        const notifications = await getNotifications(user._id, limit, offset, status);

        return {
          success: true,
          statusCode: 200,
          message: 'Notifications retrieved successfully',
          notifications,
          pagination: {
            limit,
            offset,
            hasMore: notifications.length === limit
          }
        };
      } catch (err) {
        Logger.error('❌ Get notifications error:', err);
        return {
          success: false,
          statusCode: 500,
          message: err.message || 'Failed to retrieve notifications',
          notifications: [],
          pagination: {
            limit,
            offset,
            hasMore: false
          }
        };
      }
    },

    getUnreadNotificationCount: async (_, __, context) => {
      try {
        const user = await requireAuth(context.req);
        const count = await getUnreadCount(user._id);

        return {
          success: true,
          statusCode: 200,
          message: 'Unread count retrieved successfully',
          count
        };
      } catch (err) {
        Logger.error('❌ Get unread count error:', err);
        return {
          success: false,
          statusCode: 500,
          message: err.message || 'Failed to get unread count',
          count: 0
        };
      }
    }
  },

  Mutation: {
    markNotificationsAsRead: async (_, { notificationIds }, context) => {
      try {
        const user = await requireAuth(context.req);

        if (!notificationIds || notificationIds.length === 0) {
          return {
            success: false,
            statusCode: 400,
            message: 'Notification IDs are required'
          };
        }

        const result = await markNotificationAsReadAndPublish(notificationIds, user._id);

        return {
          success: true,
          statusCode: 200,
          message: `${result.modifiedCount} notifications marked as read`,
          modifiedCount: result.modifiedCount
        };
      } catch (err) {
        Logger.error('❌ Mark notifications as read error:', err);
        return {
          success: false,
          statusCode: 500,
          message: err.message || 'Failed to mark notifications as read'
        };
      }
    },

    markAllNotificationsAsRead: async (_, __, context) => {
      try {
        const user = await requireAuth(context.req);
        const result = await markAllAsRead(user._id);

        return {
          success: true,
          statusCode: 200,
          message: `${result.modifiedCount} notifications marked as read`,
          modifiedCount: result.modifiedCount
        };
      } catch (err) {
        Logger.error('❌ Mark all notifications as read error:', err);
        return {
          success: false,
          statusCode: 500,
          message: err.message || 'Failed to mark all notifications as read'
        };
      }
    },

    deleteNotification: async (_, { notificationId }, context) => {
      try {
        const user = await requireAuth(context.req);

        if (!notificationId) {
          return {
            success: false,
            statusCode: 400,
            message: 'Notification ID is required'
          };
        }

        // const result = await deleteNotification(notificationId, user._id);
        const result = await deleteNotificationAndPublish(notificationId, user._id)
        console.log(result)

        if (result.deletedCount === 0) {
          return {
            success: false,
            statusCode: 404,
            message: 'Notification not found or not authorized to delete'
          };
        }

        return {
          success: true,
          statusCode: 200,
          message: 'Notification deleted successfully'
        };
      } catch (err) {
        Logger.error('❌ Delete notification error:', err);
        return {
          success: false,
          statusCode: 500,
          message: err.message || 'Failed to delete notification'
        };
      }
    },

    deleteAllNotifications: async (_, __, context) => {
      try {
        const user = await requireAuth(context.req);
        const result = await deleteAllNotifications(user._id);

        return {
          success: true,
          statusCode: 200,
          message: `${result.deletedCount} notifications deleted`,
          deletedCount: result.deletedCount
        };
      } catch (err) {
        Logger.error('❌ Delete all notifications error:', err);
        return {
          success: false,
          statusCode: 500,
          message: err.message || 'Failed to delete all notifications'
        };
      }
    }
  }
};