// resolvers/conversationResolvers.js
import { Conversation } from '../models/conversationModel.js';
import { Message } from '../models/messageModel.js';
import { requireAuth } from '../utils/requireAuth.js';

export const conversationResolvers = {
  Conversation: {
    participants: async (parent, args, context) => {
      try {
        const user = await requireAuth(context.req);
        const conversation = await Conversation.findById(parent.id).populate(
          'participants',
          'id username email firstname lastname bio profilePicture isVerified sentLinks receivedLinks links role provider googleId createdAt updatedAt'
        );
        // Filter out the current user
        return conversation.participants.filter(
          (participant) => participant.id.toString() !== user.id.toString()
        );
      } catch (err) {
        console.error('❌ Error fetching participants:', err.message);
        throw new Error('Failed to fetch participants');
      }
    },
  },

  Query: {
    fetchMessages: async (_, { conversationId }, context) => {
      try {
        const user = await requireAuth(context.req);

        // Validate the conversation belongs to the user
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !conversation.participants.includes(user.id)) {
          throw new Error('403:Unauthorized access to this conversation');
        }

        // Fixed: Use 'conversation' field instead of 'conversationId'
        const messages = await Message.find({ conversation: conversationId })
          .populate('sender', 'id username profilePicture')
          .populate('seenBy', 'id username profilePicture')
          .populate('deletedFor', 'id username profilePicture')
          .sort({ createdAt: 1 });

        return messages;
      } catch (err) {
        console.error('❌ Error fetching messages:', err.message);
        throw new Error('500:Failed to fetch messages');
      }
    },
    myConversations: async (_, __, context) => {
      try {
        const user = await requireAuth(context.req);
        // Find all conversations where user is a participant
        const conversations = await Conversation.find({
          participants: user.id,
        })
          .populate('participants', 'id username profilePicture')
          .populate('lastMessage')
          .sort({ updatedAt: -1 });
        return conversations;
      } catch (err) {
        console.error('❌ Error fetching conversations:', err.message);
        throw new Error('500:Failed to fetch conversations');
      }
    },
  },

  Mutation: {
    fetchConversation: async (_, { receiverId }, context) => {
      try {
        const user = await requireAuth(context.req);
        let conversation = await Conversation.findOne({
          participants: { $all: [user.id, receiverId] },
        });

        if (!conversation) {
          conversation = await Conversation.create({
            participants: [user.id, receiverId],
          });
        }

        return conversation;
      } catch (err) {
        console.error('❌ Error fetching/creating conversation:', err.message);
        throw new Error('500:Failed to fetch conversation');
      }
    },

    createConversation: async (_, { receiverId }, context) => {
      try {
        const user = await requireAuth(context.req);

        const existing = await Conversation.findOne({
          participants: { $all: [user.id, receiverId] },
        });

        if (existing) return existing;

        const newConversation = await Conversation.create({
          participants: [user.id, receiverId],
        });

        return newConversation;
      } catch (err) {
        console.error('❌ Error creating conversation:', err.message);
        throw new Error('500:Failed to create conversation');
      }
    },
  },
};
