import { gql } from 'apollo-server-express';

import { userLinkResolvers } from '../resolvers/userLinks.js';

export const userLinkRequestTypeDefs = gql`
  # Response type for link request mutations
  type LinkRequestResponse {
    success: Boolean!
    statusCode: Int!
    message: String!
    linkRequest: UserLinkRequest
  }

  # Represents a link request between users
  type UserLinkRequest {
    id: ID!
    sender: UserSummary!
    receiver: UserSummary!
    status: String!
    createdAt: String!
    updatedAt: String!
  }

  # Minimal user info for link request
  type UserSummary {
    id: ID!
    name: String
    avatar: String
  }

  extend type Subscription {
    linkRequestUpdated(userId: ID!): UserLinkRequest!
  }

  extend type Mutation {
    handleLinkRequest(receiverId: ID!): LinkRequestResponse!
    handleWithdrawRequest(receiverId: ID!): LinkRequestResponse!
  }
`;

export const userLinkRequestResolvers = {
  Mutation: {
    handleLinkRequest: userLinkResolvers.Mutation.handleLinkRequest,
    handleWithdrawRequest: userLinkResolvers.Mutation.handleWithdrawRequest,
  },
  Subscription: {
    linkRequestUpdated: userLinkResolvers.Subscription.linkRequestUpdated,
  },
};
