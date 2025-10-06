import { withFilter } from 'graphql-subscriptions';
import {
  getTotalUserUnreads,
  resetAllUnreads,
  resetUnreads,
  subscribeToUnreads
} from '../services/userUnreads.services.js';
import { Logger } from '../utils/logger.js';
import { requireAuth } from '../utils/requireAuth.js';

export const userUnreadsResolvers = {
  Query: {
    /**
     * Get current user's unread counts
     */
    myUnreads: async (_, __, context) => {
      try {
        const user = await requireAuth(context.req);
        const unreads = await getTotalUserUnreads(user._id);

        return {
          success: true,
          statusCode: 200,
          message: 'Unreads fetched successfully',
          ...unreads,
        };
      } catch (err) {
        Logger.error('❌ Get unreads error:', err);
        return {
          success: false,
          statusCode: 500,
          message: err.message || 'Failed to fetch unreads',
          notificationsUnreads: 0,
          messagesUnreads: 0,
          totalUnreads: 0,
        };
      }
    },

    /**
     * Get unread counts for a specific user (admin only)
     */
    getUserUnreads: async (_, { userId }, context) => {
      try {
        const currentUser = await requireAuth(context.req);

        // Only allow users to view their own unreads or admins to view any
        if (
          String(currentUser._id) !== String(userId) &&
          !['admin', 'superadmin'].includes(currentUser.role)
        ) {
          throw new Error('403:Not authorized to view other users unreads');
        }

        const unreads = await getTotalUserUnreads(userId);

        return {
          success: true,
          statusCode: 200,
          message: 'Unreads fetched successfully',
          userId,
          ...unreads,
        };
      } catch (err) {
        Logger.error('❌ Get user unreads error:', err);
        return {
          success: false,
          statusCode: err.message.startsWith('403:') ? 403 : 500,
          message: err.message.replace(/^\d{3}:/, '') || 'Failed to fetch unreads',
          notificationsUnreads: 0,
          messagesUnreads: 0,
          totalUnreads: 0,
        };
      }
    },
  },

  Mutation: {
    /**
     * Reset notification unreads to zero
     */
    resetNotificationUnreads: async (_, __, context) => {
      try {
        const user = await requireAuth(context.req);
        const unreads = await resetUnreads(user._id, 'notifications');

        return {
          success: true,
          statusCode: 200,
          message: 'Notification unreads reset successfully',
          ...unreads,
        };
      } catch (err) {
        Logger.error('❌ Reset notification unreads error:', err);
        return {
          success: false,
          statusCode: 500,
          message: err.message || 'Failed to reset notification unreads',
          notificationsUnreads: 0,
          messagesUnreads: 0,
          totalUnreads: 0,
        };
      }
    },

    /**
     * Reset message unreads to zero
     */
    resetMessageUnreads: async (_, __, context) => {
      try {
        const user = await requireAuth(context.req);
        const unreads = await resetUnreads(user._id, 'messages');

        return {
          success: true,
          statusCode: 200,
          message: 'Message unreads reset successfully',
          ...unreads,
        };
      } catch (err) {
        Logger.error('❌ Reset message unreads error:', err);
        return {
          success: false,
          statusCode: 500,
          message: err.message || 'Failed to reset message unreads',
          notificationsUnreads: 0,
          messagesUnreads: 0,
          totalUnreads: 0,
        };
      }
    },

    /**
     * Reset all unreads (notifications + messages) to zero
     */
    resetAllUnreads: async (_, __, context) => {
      try {
        const user = await requireAuth(context.req);
        const unreads = await resetAllUnreads(user._id);

        return {
          success: true,
          statusCode: 200,
          message: 'All unreads reset successfully',
          ...unreads,
        };
      } catch (err) {
        Logger.error('❌ Reset all unreads error:', err);
        return {
          success: false,
          statusCode: 500,
          message: err.message || 'Failed to reset all unreads',
          notificationsUnreads: 0,
          messagesUnreads: 0,
          totalUnreads: 0,
        };
      }
    },
  },

  Subscription: {
    /**
     * Subscribe to unread count updates for the current user
     */
    unreadsUpdated: {
      subscribe: withFilter(
        async (_, __, context) => {
          try {
            // Require authentication for subscription
            if (!context.authenticated || !context.user) {
              throw new Error('401:Authentication required for subscription');
            }

            const userId = String(context.user._id);
            Logger.info(`📡 User ${userId} subscribed to unreads updates`);

            return subscribeToUnreads(userId);
          } catch (err) {
            Logger.error('❌ Unreads subscription error:', err);
            throw err;
          }
        },
        (payload, _, context) => {
          try {
            // Filter to only send updates for the subscribed user
            const subscribedUserId = String(context.user._id);
            const payloadUserId = String(payload.unreadsUpdated.userId);

            return subscribedUserId === payloadUserId;
          } catch (err) {
            Logger.error('❌ Unreads subscription filter error:', err);
            return false;
          }
        }
      ),
    },
  },
};