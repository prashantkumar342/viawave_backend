import { requireAuth } from '../utils/requireAuth.js';
import { User as UserModel } from '../models/userModel.js';
import { Logger } from '../utils/logger.js';
import { pubsub } from '../utils/pubsub.js';

const linkTopic = (userId) => `LINK_REQUEST_UPDATED_${String(userId)}`;

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

        return {
          success: true,
          statusCode: 200,
          message: 'Link request sent successfully.',
          linkRequest: senderView
        };

      } catch (err) {
        Logger.error('⌐ Link request error:', err);
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

        // Remove IDs from sent/received lists...
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

        return { success: true, statusCode: 200, message: 'Link request withdrawn successfully.', linkRequest: linkUpdate };
      } catch (err) {
        Logger.error('⌐ Withdraw link request error:', err);
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

        return {
          success: true,
          statusCode: 200,
          message: 'Link request accepted successfully.',
          linkRequest: linkUpdateForReceiver
        };
      } catch (err) {
        Logger.error('⌐ Accept link request error:', err);
        return { success: false, statusCode: 500, message: err.message || 'Failed to accept Link Request' };
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

        return {
          success: true,
          statusCode: 200,
          message: 'Link removed successfully.',
          linkRequest: linkUpdateForUser
        };
      } catch (err) {
        Logger.error('⌐ Remove link error:', err);
        return { success: false, statusCode: 500, message: err.message || 'Failed to remove link' };
      }
    }
  },

  Subscription: {
    linkRequestUpdated: {
      subscribe: (_, { userId }) => pubsub.asyncIterableIterator(linkTopic(userId)),
    }
  }
};