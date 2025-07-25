// userConversationSchema.js
import { gql } from 'apollo-server-express';

import { conversationResolvers } from '../resolvers/userConversation.js';

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
    attachments: [Attachment!]
    seenBy: [User!]
    deletedFor: [User!]
    createdAt: String!
    updatedAt: String!
  }

  type Conversation {
    id: ID!
    participants: [User!]!
    lastMessage: Message
    createdAt: String!
    updatedAt: String!
  }

  extend type Query {
    fetchMessages(conversationId: ID!): [Message!]!
    myConversations: [Conversation!]!
  }

  extend type Mutation {
    fetchConversation(receiverId: ID!): Conversation!
    createConversation(receiverId: ID!): Conversation!
  }
`;

export const userConversationResolvers = {
  Query: {
    fetchMessages: conversationResolvers.Query.fetchMessages,
    myConversations: conversationResolvers.Query.myConversations, // <-- Add this line
  },
  Mutation: {
    fetchConversation: conversationResolvers.Mutation.fetchConversation,
    createConversation: conversationResolvers.Mutation.createConversation,
  },
  Conversation: conversationResolvers.Conversation,
};
