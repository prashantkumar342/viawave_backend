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
    avatar: String,
    totalLinks: Int
  }

  type NotificationSource {
    id: ID
    name: String
    avatarUrl: String
  }

  type NotificationAction {
    label: String
    url: String
  }

  type Notification {
    id: ID!
    userId: ID!
    type: NotificationType!
    source: NotificationSource
    title: String!
    description: String
    imageUrl: String
    action: NotificationAction
    status: NotificationStatus!
    createdAt: String!
    notificationUpdate: NotificationUpdate!
  }
  enum NotificationUpdate {
    NEW,
DELETED,
READ,
UPDATED,
BATCH_DELETE
  }
  enum NotificationType {
    PROMOTIONAL
    JOB_OPPORTUNITY
    CONTENT_RECOMMENDATION
    SOCIAL_ACTIVITY
    PERSONALIZED_SUGGESTION
    PROFILE_ACTIVITY
  }

  enum NotificationStatus {
    UNREAD
    READ
  }

  type NotificationResponse {
    success: Boolean!
    statusCode: Int!
    message: String!
    notifications: [Notification!]
  }

  type NotificationCountResponse {
    success: Boolean!
    statusCode: Int!
    message: String!
    count: Int!
  }

  extend type Subscription {
    linkRequestUpdated(userId: ID!): UserLinkRequest!
    notificationUpdateListen(userId: ID!): Notification!
  }

  extend type Mutation {
    handleLinkRequest(receiverId: ID!): LinkRequestResponse!
    handleWithdrawRequest(receiverId: ID!): LinkRequestResponse!
    handleAcceptRequest(senderId: ID!): LinkRequestResponse!
    handleRemoveLink(linkedUserId: ID!): LinkRequestResponse!
  }
`;

export const userLinkRequestResolvers = {
  Mutation: {
    handleLinkRequest: userLinkResolvers.Mutation.handleLinkRequest,
    handleWithdrawRequest: userLinkResolvers.Mutation.handleWithdrawRequest,
    handleAcceptRequest: userLinkResolvers.Mutation.handleAcceptRequest,
    handleRemoveLink: userLinkResolvers.Mutation.handleRemoveLink,
  },
  Subscription: {
    linkRequestUpdated: userLinkResolvers.Subscription.linkRequestUpdated,
    notificationUpdateListen: userLinkResolvers.Subscription.notificationUpdateListen,
  },
};