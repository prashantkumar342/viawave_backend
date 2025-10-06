import gql from "graphql-tag";
import { userUnreadsResolvers } from '../resolvers/userUnreadsResolver.js';


export const userUnreadsTypeDefs = gql`
type UserUnreads {
  notificationsUnreads: Int!
  messagesUnreads: Int!
  totalUnreads: Int!
}

type UnreadsResponse {
  success: Boolean!
  statusCode: Int!
  message: String!
  userId: ID
  notificationsUnreads: Int!
  messagesUnreads: Int!
  totalUnreads: Int!
}

type UnreadsUpdate {
  userId: ID!
  notificationsUnreads: Int!
  messagesUnreads: Int!
}

extend type Query {
  myUnreads: UnreadsResponse!
  getUserUnreads(userId: ID!): UnreadsResponse!
}

extend type Mutation {
  resetNotificationUnreads: UnreadsResponse!
  resetMessageUnreads: UnreadsResponse!
  resetAllUnreads: UnreadsResponse!
}

extend type Subscription {
  unreadsUpdated: UnreadsUpdate!
}`

export const userUnreadsResolver = {
  Query: {
    myUnreads: userUnreadsResolvers.Query.myUnreads,
    getUserUnreads: userUnreadsResolvers.Query.getUserUnreads
  },
  Mutation: {
    resetNotificationUnreads: userUnreadsResolvers.Mutation.resetNotificationUnreads,
    resetMessageUnreads: userUnreadsResolvers.Mutation.resetMessageUnreads,
    resetAllUnreads: userUnreadsResolvers.Mutation.resetAllUnreads,
  },
  Subscription: {
    unreadsUpdated: userUnreadsResolvers.Subscription.unreadsUpdated
  },
};