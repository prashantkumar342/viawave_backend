import { gql } from 'apollo-server-express';

import { conversationResolvers } from '../resolvers/conversationResolvers.js';

export const userConversationTypeDefs = gql`
  type Attachment {
    url: String!
    fileType: String!
    fileName: String
    size: Int
  }

  type Message {
    id: ID!
    text: String
    sender: User!
    conversation: ID!
    attachments: [Attachment!]!
    seenBy: [User!]!
    deletedFor: [User!]!
    isSenderYou: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  type Conversation {
    id: ID!
    type: ConversationType!
    participants: [User!]!
    otherUser: User!
    lastMessage: Message
    groupName: String
    groupAvatar: String
    unreadCounts: [UnreadCount!]!
    myUnreadCount: Int!
    createdAt: String!
    updatedAt: String!
  }

  type UnreadCount {
    userId: ID!
    count: Int!
  }

  enum ConversationType {
    PRIVATE
    GROUP
  }

  type MyConversationsResponse {
    success: Boolean!
    message: String!
    statusCode: Int!
    conversations: [Conversation!]!
  }

  type MessagesResponse {
    success: Boolean!
    message: String!
    statusCode: Int!
    messages: [Message!]!
  }

  type SendMessageResponse {
    success: Boolean!
    message: String!
    statusCode: Int!
    messageData: Message
  }

  extend type Query {
    myConversations: MyConversationsResponse!
    getMessages(conversationId: ID!, limit: Int, offset: Int): MessagesResponse!
    searchConversation(
      query: String!
      limit: Int = 20
      offset: Int = 0
    ): MyConversationsResponse!
  }

  extend type Subscription {
    messageReceived(conversationId: ID!): Message!
    conversationUpdated(userId: ID!): Conversation!   # 🔥 New subscription
  }

  extend type Mutation {
    sendMessage(
      recipientId: ID!
      message: String!
      messageType: String!
    ): SendMessageResponse!
  }
`;


// export const userConversationResolvers = {
//   Query: {
//     myConversations: conversationResolvers.Query.myConversations,
//     getMessages: conversationResolvers.Query.getMessages,
//     searchConversation: conversationResolvers.Query.searchConversation,
//   },
//   Mutation: {
//     sendMessage: conversationResolvers.Mutation.sendMessage,
//   },
//   Subscription: {
//     messageReceived: conversationResolvers.Subscription.messageReceived,
//   },
//   Conversation: conversationResolvers.Conversation,
//   Message: conversationResolvers.Message,
// };
export const userConversationResolvers = {
  Query: {
    myConversations: conversationResolvers.Query.myConversations,
    getMessages: conversationResolvers.Query.getMessages,
    searchConversation: conversationResolvers.Query.searchConversation,
  },
  Mutation: {
    sendMessage: conversationResolvers.Mutation.sendMessage,
  },
  Subscription: {
    messageReceived: conversationResolvers.Subscription.messageReceived,
    conversationUpdated: conversationResolvers.Subscription.conversationUpdated, // 🔥 Added
  },
  Conversation: conversationResolvers.Conversation,
  Message: conversationResolvers.Message,
};
