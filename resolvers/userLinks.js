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

        // Validation checks...

        const linkRequest = {
          id: `${userIdStr}_${receiverIdStr}_${Date.now()}`,
          sender: { id: userIdStr, name: user.name || null, avatar: user.avatar || null },
          receiver: { id: receiverIdStr, name: receiver.name || null, avatar: receiver.avatar || null },
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        user.sentLinks.push(receiver._id);
        receiver.receivedLinks.push(user._id);
        await Promise.all([user.save(), receiver.save()]);

        // Publish to sender & receiver
        pubsub.publish(linkTopic(userIdStr), { linkRequestUpdated: linkRequest });
        pubsub.publish(linkTopic(receiverIdStr), { linkRequestUpdated: linkRequest });

        return { success: true, statusCode: 200, message: 'Link request sent successfully.', linkRequest };
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
        Logger.error('❌ Withdraw link request error:', err);
        return { success: false, statusCode: 500, message: err.message || 'Failed withdrawing Link Request' };
      }
    }
  },

  Subscription: {
    linkRequestUpdated: {
      subscribe: (_, { userId }) => pubsub.asyncIterableIterator(linkTopic(userId)),
    }
  }
};
