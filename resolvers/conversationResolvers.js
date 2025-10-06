import {
  createAndPublishNotificationSocialActivity,
  NOTIFICATION_UPDATE_TYPES,
  safeNotification
} from '../helpers/notification.helper.js';
import { Conversation as ConversationModel } from '../models/conversationModel.js';
import { Message as MessageModel } from '../models/messageModel.js';
import { User as UserModel } from '../models/userModel.js';
import { Logger } from '../utils/logger.js';
import { pubsub } from '../utils/pubsub.js';
import { requireAuth } from '../utils/requireAuth.js';

const messageTopic = (conversationId) =>
  `MESSAGE_RECEIVED_${String(conversationId)}`;

const conversationTopic = (userId) => `CONVERSATION_${String(userId)}`;

export const conversationResolvers = {
  Query: {
    // Get all conversations for the authenticated user
    myConversations: async (_, __, context) => {
      try {
        const user = await requireAuth(context.req);

        const conversations = await ConversationModel.find({
          participants: user._id,
        })
          .sort({ updatedAt: -1 })
          .populate({
            path: 'participants',
            select: 'username email profilePicture',
          })
          .populate({
            path: 'lastMessage',
            populate: {
              path: 'sender',
              select: 'username email profilePicture',
            },
          });
        const data = conversations.map((c) => ({ ...c.toObject(), id: c._id }));
        return {
          success: true,
          message: 'Conversations fetched successfully',
          statusCode: 200,
          conversations: data,
        };
      } catch (err) {
        Logger.error(`❌ myConversations error: ${err?.message || err}`);
        return {
          success: false,
          message: err?.message || 'Failed to fetch conversations',
          statusCode: 500,
          conversations: [],
        };
      }
    },

    // Get messages for a specific conversation
    getMessages: async (
      _,
      { conversationId, limit, offset },
      context
    ) => {
      try {
        const user = await requireAuth(context.req);

        const conversation = await ConversationModel.findById(conversationId);
        if (!conversation) throw new Error('404:Conversation not found');

        // Check if user is participant
        const isParticipant = conversation.participants
          .map((id) => String(id))
          .includes(String(user._id));
        if (!isParticipant) {
          throw new Error('403:You are not a participant of this conversation');
        }

        const messages = await MessageModel.find({
          conversation: conversationId,
          deletedFor: { $ne: user._id },
        })
          .sort({ createdAt: -1 }) // Keep newest first
          .skip(offset)
          .limit(limit)
          .populate({
            path: 'sender',
            select: 'username email profilePicture',
          });

        // Send newest first (no reverse needed)
        const data = messages.map((m) => ({
          ...m.toObject(),
          id: m._id,
          isSenderYou: String(m.sender._id || m.sender) === String(user._id),
        }));

        return {
          success: true,
          message: 'Messages fetched successfully',
          statusCode: 200,
          messages: data, // Newest first array
        };
      } catch (err) {
        Logger.error(`❌ getMessages error: ${err?.message || err}`);
        return {
          success: false,
          message: err?.message || 'Failed to fetch messages',
          statusCode: 500,
          messages: [],
        };
      }
    },

    // Search conversations by other user's username/email or groupName
    searchConversation: async (
      _,
      { query, limit = 20, offset = 0 },
      context
    ) => {
      try {
        const user = await requireAuth(context.req);

        const q = String(query || '').trim();
        if (!q) {
          return {
            success: true,
            message: 'No query provided; returning empty result',
            statusCode: 200,
            conversations: [],
          };
        }

        // First, find conversations the user participates in
        const conversations = await ConversationModel.find({
          participants: user._id,
        })
          .sort({ updatedAt: -1 })
          .populate({
            path: 'participants',
            select: 'username email profilePicture fullName isVerified',
          })
          .populate({
            path: 'lastMessage',
            populate: {
              path: 'sender',
              select: 'username email profilePicture',
            },
          })
          .lean();

        const userIdStr = String(user._id);
        const regex = new RegExp(q, 'i');

        // Filter PRIVATE conversations by other participant's username or fullName
        const filtered = conversations.filter((c) => {
          if (c.type !== 'PRIVATE') return false;
          const other = (c.participants || []).find(
            (p) => String(p._id) !== userIdStr
          );
          if (!other) return false;
          return (
            regex.test(other.username || '') || regex.test(other.fullName || '')
          );
        });

        const sliced = filtered
          .slice(offset, offset + limit)
          .map((c) => ({ ...c, id: c._id }));

        return {
          success: true,
          message: 'Conversations fetched successfully',
          statusCode: 200,
          conversations: sliced,
        };
      } catch (err) {
        Logger.error(`❌ searchConversation error: ${err?.message || err}`);
        return {
          success: false,
          message: err?.message || 'Failed to search conversations',
          statusCode: 500,
          conversations: [],
        };
      }
    },
  },

  Mutation: {
    // Send a message to a recipient; find or create PRIVATE conversation
    sendMessage: async (_, { recipientId, message, messageType }, context) => {
      try {
        const user = await requireAuth(context.req);

        if (!recipientId) throw new Error('400:recipientId is required');
        if (!messageType) throw new Error('400:messageType is required');

        if (String(user._id) === String(recipientId)) {
          throw new Error('400:Cannot send message to yourself');
        }

        // Ensure recipient exists
        const recipient = await UserModel.findById(recipientId).select('_id username name avatar');
        if (!recipient) throw new Error('404:Recipient not found');

        // Find or create conversation
        let conversation = await ConversationModel.findOne({
          type: 'PRIVATE',
          participants: { $all: [user._id, recipientId], $size: 2 },
        });

        let isNewConversation = false;
        if (!conversation) {
          conversation = await ConversationModel.create({
            type: 'PRIVATE',
            participants: [user._id, recipientId],
            unreadCounts: new Map(),
          });
          // Initialize unread counts
          conversation.unreadCounts.set(String(user._id), 0);
          conversation.unreadCounts.set(String(recipientId), 0);
          await conversation.save();
          isNewConversation = true;

          // 🔔 Notify both users that a new conversation was created
          for (const participantId of conversation.participants) {
            pubsub.publish(conversationTopic(participantId), {
              conversationUpdated: {
                ...conversation.toObject(),
                id: conversation._id,
              },
            });
          }

          // ✅ Create and publish new conversation notification
          await safeNotification(async () => {
            await createAndPublishNotificationSocialActivity(
              recipientId,
              user._id,
              user.username || user.name || 'Someone',
              user.profilePicture || null,
              'New Conversation',
              `${user.username || user.name || 'Someone'} sent you a message!`,
              'View Chat',
              `${conversation._id}`,
              NOTIFICATION_UPDATE_TYPES.NEW
            );
          }, 'New conversation notification');
        }

        // Prepare message document based on messageType
        const normalizedType = String(messageType).toLowerCase();
        const isText = normalizedType === 'text';
        const isAttachmentType = [
          'image',
          'video',
          'audio',
          'file',
          'pdf',
          'other',
        ].includes(normalizedType);

        const messageDoc = {
          conversation: conversation._id,
          sender: user._id,
          text: isText ? message || '' : '',
          attachments: [],
        };

        if (!isText && isAttachmentType) {
          // Treat `message` as a URL for the attachment
          messageDoc.attachments = [
            {
              url: String(message || ''),
              fileType: normalizedType,
              fileName: null,
              size: null,
            },
          ];
        }

        if (!isText && !isAttachmentType) {
          throw new Error('400:Unsupported messageType');
        }

        const created = await MessageModel.create(messageDoc);

        // ✅ Create and publish new message notification (only if not a new conversation)
        if (!isNewConversation) {
          await safeNotification(async () => {
            await createAndPublishNotificationSocialActivity(
              recipientId,
              user._id,
              user.username || user.name || 'Someone',
              user.profilePicture || null,
              'New Message',
              `${user.username || user.name || 'Someone'} sent you a message!`,
              'View Message',
              `${conversation._id}`,
              NOTIFICATION_UPDATE_TYPES.NEW
            );
          }, 'New message notification');
        }

        // Update lastMessage and unreadCounts
        conversation.lastMessage = created._id;
        // Ensure unreadCounts exists as a Map
        if (
          !conversation.unreadCounts ||
          typeof conversation.unreadCounts.get !== 'function'
        ) {
          const asMap = new Map();
          // If it was a plain object, migrate keys
          if (
            conversation.unreadCounts &&
            typeof conversation.unreadCounts === 'object'
          ) {
            for (const key of Object.keys(conversation.unreadCounts)) {
              asMap.set(key, conversation.unreadCounts[key] || 0);
            }
          }
          conversation.unreadCounts = asMap;
        }
        for (const participantId of conversation.participants) {
          const pid = String(participantId);
          if (pid === String(user._id)) {
            conversation.unreadCounts.set(pid, 0);
          } else {
            const current = conversation.unreadCounts.get(pid) || 0;
            conversation.unreadCounts.set(pid, current + 1);
          }
        }
        await conversation.save();
        for (const participantId of conversation.participants) {
          pubsub.publish(conversationTopic(participantId), {
            conversationUpdated: {
              ...conversation.toObject(),
              id: conversation._id,
            },
          });
        }

        // Populate sender for response
        const populated = await MessageModel.findById(created._id).populate({
          path: 'sender',
          select: 'username email profilePicture',
        });

        // Prepare message data with isSenderYou field for response
        const responseMessageData = {
          ...populated.toObject(),
          id: populated._id,
          isSenderYou: true,
        };

        // Emit subscription event for real-time updates
        // Include isSenderYou field for each participant
        const subscriptionMessageData = {
          ...populated.toObject(),
          id: populated._id,
        };

        // Emit to all participants with their respective isSenderYou value
        for (const participantId of conversation.participants) {
          const isSenderYou = String(participantId) === String(user._id);
          pubsub.publish(messageTopic(conversation._id), {
            messageReceived: {
              ...subscriptionMessageData,
              isSenderYou,
            },
          });
        }

        return {
          success: true,
          message: 'Message sent successfully',
          statusCode: 201,
          messageData: responseMessageData,
        };
      } catch (err) {
        Logger.error(`❌ sendMessage error: ${err?.message || err}`);
        return {
          success: false,
          message: err?.message || 'Failed to send message',
          statusCode: 500,
          messageData: null,
        };
      }
    },
    // Mark messages as seen by the current user
    seenMessage: async (_, { conversationId, messageIds }, context) => {
      try {
        const user = await requireAuth(context.req);
        const userId = String(user._id);

        if (!conversationId) throw new Error("400:conversationId is required");

        // Find conversation and check if the user is a participant
        const conversation = await ConversationModel.findById(conversationId);
        if (!conversation) throw new Error("404:Conversation not found");

        const isParticipant = conversation.participants
          .map((id) => String(id))
          .includes(userId);
        if (!isParticipant) {
          throw new Error("403:You are not a participant of this conversation");
        }

        // Build query (specific messages or all unseen in that conversation)
        const filter = {
          conversation: conversationId,
          seenBy: { $ne: userId },
        };
        if (Array.isArray(messageIds) && messageIds.length > 0) {
          filter._id = { $in: messageIds };
        }

        // Update all unseen messages for this user
        const result = await MessageModel.updateMany(filter, {
          $addToSet: { seenBy: userId },
        });

        // Reset unread count for this user in that conversation
        if (
          conversation.unreadCounts &&
          typeof conversation.unreadCounts.get === "function"
        ) {
          conversation.unreadCounts.set(userId, 0);
        } else if (conversation.unreadCounts) {
          conversation.unreadCounts[userId] = 0;
        }
        await conversation.save();

        // 🔔 Publish conversation update (unread count changed)
        pubsub.publish(conversationTopic(userId), {
          conversationUpdated: {
            ...conversation.toObject(),
            id: conversation._id,
          },
        });

        // 🔔 Publish message update to notify participants that messages were seen
        // for (const participantId of conversation.participants) {
        //   const isSenderYou = String(participantId) === userId;
        //   pubsub.publish(messageTopic(conversationId), {
        //     messageReceived: {
        //       seenUpdate: true,
        //       conversationId,
        //       seenBy: userId,
        //       messageIds: messageIds || [],
        //       isSenderYou,
        //     },
        //   });
        // }

        return {
          success: true,
          message: "Messages marked as seen successfully",
          statusCode: 200,
          seenCount: result.modifiedCount,
        };
      } catch (err) {
        Logger.error(`❌ seenMessage error: ${err?.message || err}`);
        return {
          success: false,
          message: err?.message || "Failed to mark messages as seen",
          statusCode: 500,
          seenCount: 0,
        };
      }
    },

  },

  Conversation: {
    id: (root) => root.id || root._id,
    participants: async (root) => {
      if (root.participants?.[0]?.username) {
        return root.participants.map((p) => {
          const obj = p.toObject ? p.toObject() : p;
          if (!obj.id) obj.id = obj._id?.toString?.() || String(obj._id);
          return obj;
        });
      }
      const populated = await UserModel.find({
        _id: { $in: root.participants },
      }).select('username email profilePicture');
      return populated.map((p) => {
        const obj = p.toObject ? p.toObject() : p;
        if (!obj.id) obj.id = obj._id?.toString?.() || String(obj._id);
        return obj;
      });
    },
    lastMessage: async (root) => {
      if (!root.lastMessage) return null;
      if (root.lastMessage?.text !== undefined) return root.lastMessage;
      const msg = await MessageModel.findById(root.lastMessage).populate({
        path: 'sender',
        select: 'username email profilePicture',
      });
      return msg;
    },
    otherUser: async (root, _, context) => {
      // Identify current user and return the non-self participant
      const currentUser = await requireAuth(context.req);
      const currentId = String(currentUser._id);
      const participantIds =
        root.participants?.map((p) => String(p._id || p)) || [];
      const otherId = participantIds.find((id) => id !== currentId);
      if (!otherId) {
        // In case of group or data issue, fallback to first
        const fallbackId = participantIds[0];
        if (!fallbackId) return null;
        const user = await UserModel.findById(fallbackId).select(
          'username email profilePicture'
        );
        const obj = user?.toObject ? user.toObject() : user;
        if (obj && !obj.id) obj.id = obj._id?.toString?.() || String(obj._id);
        return obj;
      }
      const user = await UserModel.findById(otherId).select(
        'username email profilePicture fullName isVerified gender'
      );
      const obj = user?.toObject ? user.toObject() : user;
      if (obj && !obj.id) obj.id = obj._id?.toString?.() || String(obj._id);
      return obj;
    },
    unreadCounts: (root) => {
      if (!root.unreadCounts) return [];
      const list = [];
      // Support Map or plain object
      if (typeof root.unreadCounts.entries === 'function') {
        for (const [key, value] of root.unreadCounts.entries()) {
          list.push({ userId: key, count: value || 0 });
        }
      } else {
        for (const key of Object.keys(root.unreadCounts)) {
          list.push({ userId: key, count: root.unreadCounts[key] || 0 });
        }
      }
      return list;
    },
    myUnreadCount: async (root, _, context) => {
      const currentUser = await requireAuth(context.req);
      const key = String(currentUser._id);
      if (!root.unreadCounts) return 0;
      if (typeof root.unreadCounts.get === 'function') {
        return root.unreadCounts.get(key) || 0;
      }
      return root.unreadCounts[key] || 0;
    },
  },

  Message: {
    id: (root) => root.id || root._id,
    sender: async (root) => {
      if (root.sender?.username) {
        const obj = root.sender.toObject ? root.sender.toObject() : root.sender;
        if (!obj.id) obj.id = obj._id?.toString?.() || String(obj._id);
        return obj;
      }
      const user = await UserModel.findById(root.sender).select(
        'username email profilePicture'
      );
      const obj = user?.toObject ? user.toObject() : user;
      if (obj && !obj.id) obj.id = obj._id?.toString?.() || String(obj._id);
      return obj;
    },
    seenBy: async (root) => {
      if (!root.seenBy || root.seenBy.length === 0) return [];
      if (root.seenBy?.[0]?.username) {
        return root.seenBy.map((u) => {
          const obj = u.toObject ? u.toObject() : u;
          if (!obj.id) obj.id = obj._id?.toString?.() || String(obj._id);
          return obj;
        });
      }
      const users = await UserModel.find({ _id: { $in: root.seenBy } }).select(
        'username email profilePicture'
      );
      return users.map((u) => {
        const obj = u.toObject ? u.toObject() : u;
        if (!obj.id) obj.id = obj._id?.toString?.() || String(obj._id);
        return obj;
      });
    },
    deletedFor: async (root) => {
      if (!root.deletedFor || root.deletedFor.length === 0) return [];
      if (root.deletedFor?.[0]?.username) {
        return root.deletedFor.map((u) => {
          const obj = u.toObject ? u.toObject() : u;
          if (!obj.id) obj.id = obj._id?.toString?.() || String(obj._id);
          return obj;
        });
      }
      const users = await UserModel.find({
        _id: { $in: root.deletedFor },
      }).select('username email profilePicture');
      return users.map((u) => {
        const obj = u.toObject ? u.toObject() : u;
        if (!obj.id) obj.id = obj._id?.toString?.() || String(obj._id);
        return obj;
      });
    },
  },

  Subscription: {
    messageReceived: {
      subscribe: async (_, { conversationId }, context) => {
        // Add authentication check for message subscription too
        if (!context.authenticated || !context.user) {
          throw new Error('401:Authentication required for subscription');
        }
        console.log(`🔔 Message subscription for conversation: ${conversationId}`);
        return pubsub.asyncIterableIterator(messageTopic(conversationId));
      },
    },
    conversationUpdated: {
      subscribe: async (_, { userId }, context) => {
        console.log('🔍 ConversationUpdated subscription context:', {
          authenticated: context.authenticated,
          user: context.user?.username || context.user?._id,
          userId
        });

        // 🔥 CRITICAL: Check authentication in WebSocket context
        if (!context.authenticated || !context.user) {
          console.error('❌ Unauthenticated subscription attempt');
          throw new Error('401:Authentication required for subscription');
        }

        // 🔥 SECURITY: Verify user can only subscribe to their own updates
        const currentUserId = String(context.user._id);
        if (String(userId) !== currentUserId) {
          console.error('❌ User trying to subscribe to other user\'s conversations');
          throw new Error('403:Can only subscribe to your own conversations');
        }

        console.log(`✅ Subscribing to conversation updates for user ${userId}`);
        return pubsub.asyncIterableIterator(conversationTopic(userId));
      },
    },
  },
};