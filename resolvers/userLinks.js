import {
  createAndPublishNotificationSocialActivity,
  deleteAndPublishNotification,
  NOTIFICATION_UPDATE_TYPES,
  notificationTopic,
  safeNotification
} from '../helpers/notification.helper.js';
import { User as UserModel } from '../models/userModel.js';
import { Logger } from '../utils/logger.js';
import { pubsub } from '../utils/pubsub.js';
import { requireAuth } from '../utils/requireAuth.js';

const linkTopic = (userId) => `LINK_REQUEST_UPDATED_${String(userId)}`;

// Re-export for backward compatibility
export { notificationTopic as notificationUpdate } from '../helpers/notification.helper.js';

export const userLinkResolvers = {
  Mutation: {
    handleLinkRequest: async (_, { receiverId }, context) => {
      try {
        const user = await requireAuth(context.req);
        const receiver = await UserModel.findById(receiverId);

        if (!receiver) {
          return { success: false, statusCode: 404, message: 'Receiver not found' };
        }

        const userIdStr = String(user._id);
        const receiverIdStr = String(receiver._id);

        // Check if link request already exists
        if (user.sentLinks.includes(receiver._id)) {
          return { success: false, statusCode: 400, message: 'Link request already sent' };
        }

        user.sentLinks.push(receiver._id);
        receiver.receivedLinks.push(user._id);
        await Promise.all([user.save(), receiver.save()]);

        const senderView = {
          id: `${userIdStr}_${receiverIdStr}_${Date.now()}`,
          sender: { id: userIdStr, name: user.name || null, avatar: user.avatar || null },
          receiver: { id: receiverIdStr, name: receiver.name || null, avatar: receiver.avatar || null },
          status: 'sent',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const receiverView = {
          ...senderView,
          status: 'accept'
        };

        // Publish to each user with their own status
        pubsub.publish(linkTopic(userIdStr), { linkRequestUpdated: senderView });
        pubsub.publish(linkTopic(receiverIdStr), { linkRequestUpdated: receiverView });

        // ✅ Create and publish notification for the receiver
        await safeNotification(async () => {
          await createAndPublishNotificationSocialActivity(
            receiver._id,
            user._id,
            user.username || user.name || 'Someone',
            user.profilePicture || null,
            'New Link Request',
            `${user.username || user.name || 'Someone'} sent you a link request!`,
            'Accept',
            `${user._id}`,
            NOTIFICATION_UPDATE_TYPES.NEW
          );
        }, 'Link request notification');

        return {
          success: true,
          statusCode: 200,
          message: 'Link request sent successfully.',
          linkRequest: senderView
        };

      } catch (err) {
        Logger.error('❌ Link request error:', err);
        return { success: false, statusCode: 500, message: err.message || 'Failed sending Link Request' };
      }
    },

    handleWithdrawRequest: async (_, { receiverId }, context) => {
      try {
        const user = await requireAuth(context.req);
        const receiver = await UserModel.findById(receiverId);
        if (!receiver) {
          return { success: false, statusCode: 404, message: 'Receiver not found' };
        }

        const userIdStr = String(user._id);
        const receiverIdStr = String(receiver._id);

        // Check if link request exists
        if (!user.sentLinks.some(id => String(id) === receiverIdStr)) {
          return { success: false, statusCode: 400, message: 'No link request found to withdraw' };
        }

        // Remove IDs from sent/received lists
        user.sentLinks = user.sentLinks.filter(id => String(id) !== receiverIdStr);
        receiver.receivedLinks = receiver.receivedLinks.filter(id => String(id) !== userIdStr);
        await Promise.all([user.save(), receiver.save()]);

        const linkUpdate = {
          id: `${userIdStr}_${receiverIdStr}_${Date.now()}`,
          sender: { id: userIdStr, name: user.name || null, avatar: user.avatar || null },
          receiver: { id: receiverIdStr, name: receiver.name || null, avatar: receiver.avatar || null },
          status: 'WITHDRAWN',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Publish to sender & receiver
        pubsub.publish(linkTopic(userIdStr), { linkRequestUpdated: linkUpdate });
        pubsub.publish(linkTopic(receiverIdStr), { linkRequestUpdated: linkUpdate });

        // ✅ Delete and publish notification removal
        await safeNotification(async () => {
          await deleteAndPublishNotification(receiver._id, user._id);
        }, 'Link request withdrawal notification');

        return { success: true, statusCode: 200, message: 'Link request withdrawn successfully.', linkRequest: linkUpdate };
      } catch (err) {
        Logger.error('❌ Withdraw link request error:', err);
        return { success: false, statusCode: 500, message: err.message || 'Failed withdrawing Link Request' };
      }
    },

    handleAcceptRequest: async (_, { senderId }, context) => {
      try {
        const user = await requireAuth(context.req); // current user (receiver)
        const sender = await UserModel.findById(senderId);

        if (!sender) {
          return { success: false, statusCode: 404, message: 'Sender not found' };
        }

        const userIdStr = String(user._id);
        const senderIdStr = String(sender._id);

        // Check if link request exists
        if (!user.receivedLinks.some(id => String(id) === senderIdStr)) {
          return { success: false, statusCode: 400, message: 'No link request found to accept' };
        }

        // Remove from pending request lists
        user.receivedLinks = user.receivedLinks.filter(id => String(id) !== senderIdStr);
        sender.sentLinks = sender.sentLinks.filter(id => String(id) !== userIdStr);

        // Add to each other's linked list if not already present
        if (!user.links.includes(sender._id)) {
          user.links.push(sender._id);
        }
        if (!sender.links.includes(user._id)) {
          sender.links.push(user._id);
        }

        await Promise.all([user.save(), sender.save()]);

        const linkUpdateForReceiver = {
          id: `${senderIdStr}_${userIdStr}_${Date.now()}`,
          sender: {
            id: senderIdStr,
            name: sender.username || null,
            avatar: sender.avatar || null,
            totalLinks: sender?.links.length || 0
          },
          receiver: {
            id: userIdStr,
            name: user.username || null,
            avatar: user.avatar || null,
            totalLinks: user?.links.length || 0
          },
          status: 'linked',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const linkUpdateForSender = {
          ...linkUpdateForReceiver,
          sender: { id: userIdStr, name: user.username || null, avatar: user.avatar || null, totalLinks: user?.links.length || 0 },
          receiver: { id: senderIdStr, name: sender.username || null, avatar: sender.avatar || null, totalLinks: sender?.links.length || 0 },
        };

        // Publish status update to both parties
        pubsub.publish(linkTopic(userIdStr), { linkRequestUpdated: linkUpdateForReceiver });
        pubsub.publish(linkTopic(senderIdStr), { linkRequestUpdated: linkUpdateForSender });

        // ✅ Delete the original link request notification since it's accepted
        await safeNotification(async () => {
          await deleteAndPublishNotification(user._id, sender._id);
        }, 'Link request acceptance notification deletion');

        return {
          success: true,
          statusCode: 200,
          message: 'Link request accepted successfully.',
          linkRequest: linkUpdateForReceiver
        };
      } catch (err) {
        Logger.error('❌ Accept link request error:', err);
        return { success: false, statusCode: 500, message: err.message || 'Failed to accept Link Request' };
      }
    },

    handleRejectRequest: async (_, { senderId }, context) => {
      try {
        const user = await requireAuth(context.req); // current user (receiver)
        const sender = await UserModel.findById(senderId);

        if (!sender) {
          return { success: false, statusCode: 404, message: 'Sender not found' };
        }

        const userIdStr = String(user._id);
        const senderIdStr = String(sender._id);

        // Check if link request exists
        if (!user.receivedLinks.some(id => String(id) === senderIdStr)) {
          return { success: false, statusCode: 400, message: 'No link request found to reject' };
        }

        // Remove from pending request lists
        user.receivedLinks = user.receivedLinks.filter(id => String(id) !== senderIdStr);
        sender.sentLinks = sender.sentLinks.filter(id => String(id) !== userIdStr);

        await Promise.all([user.save(), sender.save()]);

        const linkUpdate = {
          id: `${senderIdStr}_${userIdStr}_${Date.now()}`,
          sender: { id: senderIdStr, name: sender.username || null, avatar: sender.avatar || null },
          receiver: { id: userIdStr, name: user.username || null, avatar: user.avatar || null },
          status: 'REJECTED',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Publish to sender & receiver
        pubsub.publish(linkTopic(userIdStr), { linkRequestUpdated: linkUpdate });
        pubsub.publish(linkTopic(senderIdStr), { linkRequestUpdated: linkUpdate });

        // ✅ Delete the original link request notification since it's rejected
        await safeNotification(async () => {
          await deleteAndPublishNotification(user._id, sender._id);
        }, 'Link request rejection notification deletion');

        return {
          success: true,
          statusCode: 200,
          message: 'Link request rejected successfully.',
          linkRequest: linkUpdate
        };
      } catch (err) {
        Logger.error('❌ Reject link request error:', err);
        return { success: false, statusCode: 500, message: err.message || 'Failed to reject Link Request' };
      }
    },

    handleRemoveLink: async (_, { linkedUserId }, context) => {
      try {
        const user = await requireAuth(context.req);
        const linkedUser = await UserModel.findById(linkedUserId);

        if (!linkedUser) {
          return { success: false, statusCode: 404, message: 'Linked user not found' };
        }

        const userIdStr = String(user._id);
        const linkedUserIdStr = String(linkedUser._id);

        // Check if they are actually linked
        const userHasLink = user.links.some(id => String(id) === linkedUserIdStr);
        const linkedUserHasLink = linkedUser.links.some(id => String(id) === userIdStr);

        if (!userHasLink || !linkedUserHasLink) {
          return { success: false, statusCode: 400, message: 'Users are not linked' };
        }

        // Remove from each other's links array
        user.links = user.links.filter(id => String(id) !== linkedUserIdStr);
        linkedUser.links = linkedUser.links.filter(id => String(id) !== userIdStr);

        await Promise.all([user.save(), linkedUser.save()]);

        const linkUpdateForUser = {
          id: `${userIdStr}_${linkedUserIdStr}_${Date.now()}`,
          sender: { id: userIdStr, name: user.username || null, avatar: user.avatar || null, totalLinks: user?.links.length || 0 },
          receiver: { id: linkedUserIdStr, name: linkedUser.username || null, avatar: linkedUser.avatar || null, totalLinks: linkedUser?.links.length || 0 },
          status: 'REMOVED',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const linkUpdateForLinkedUser = {
          ...linkUpdateForUser,
          sender: { id: linkedUserIdStr, name: linkedUser.username || null, avatar: linkedUser.avatar || null, totalLinks: linkedUser?.links.length || 0 },
          receiver: { id: userIdStr, name: user.username || null, avatar: user.avatar || null, totalLinks: user?.links.length || 0 },
        };

        // Publish status update to both parties
        pubsub.publish(linkTopic(userIdStr), { linkRequestUpdated: linkUpdateForUser });
        pubsub.publish(linkTopic(linkedUserIdStr), { linkRequestUpdated: linkUpdateForLinkedUser });

        // No notification needed for link removal as per requirements

        return {
          success: true,
          statusCode: 200,
          message: 'Link removed successfully.',
          linkRequest: linkUpdateForUser
        };
      } catch (err) {
        Logger.error('❌ Remove link error:', err);
        return { success: false, statusCode: 500, message: err.message || 'Failed to remove link' };
      }
    }
  },

  Subscription: {
    linkRequestUpdated: {
      subscribe: (_, { userId }) => pubsub.asyncIterableIterator(linkTopic(userId)),
    },
    notificationUpdateListen: {
      subscribe: (_, { userId }) => {

        return pubsub.asyncIterableIterator(notificationTopic(userId));
      }
    }
  }
}