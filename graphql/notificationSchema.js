import { gql } from 'apollo-server-express';
import { notificationResolvers } from '../resolvers/notificationResolver.js';

export const notificationTypeDefs = gql`
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

  type NotificationMutationResponse {
    success: Boolean!
    statusCode: Int!
    message: String!
    modifiedCount: Int
    deletedCount: Int
  }

  extend type Query {
    getNotifications(limit: Int, offset: Int, status: NotificationStatus): NotificationResponse!
    getUnreadNotificationCount: NotificationCountResponse!
  }

  extend type Mutation {
    markNotificationsAsRead(notificationIds: [ID!]!): NotificationMutationResponse!
    markAllNotificationsAsRead: NotificationMutationResponse!
    deleteNotification(notificationId: ID!): NotificationMutationResponse!
    deleteAllNotifications: NotificationMutationResponse!
  }
`;

export const notificationsResolvers = {
  Query: {
    getNotifications: notificationResolvers.Query.getNotifications,
    getUnreadNotificationCount: notificationResolvers.Query.getUnreadNotificationCount
  },
  Mutation: {
    markNotificationsAsRead: notificationResolvers.Mutation.markNotificationsAsRead,
    markAllNotificationsAsRead: notificationResolvers.Mutation.markAllNotificationsAsRead,
    deleteNotification: notificationResolvers.Mutation.deleteNotification,
    deleteAllNotifications: notificationResolvers.Mutation.deleteAllNotifications
  }
}