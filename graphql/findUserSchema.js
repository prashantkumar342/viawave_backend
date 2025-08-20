import { gql } from 'apollo-server-express';

import { finUserResolvers } from '../resolvers/findUser.js';

export const findUserTypeDefs = gql`
  type User {
    id: ID!
    username: String!
    email: String!
    fullName: String
    dob: String
    gender: String
    bio: String
    is_linked: String
    contactNumber: String
    profilePicture: String
    coverImage: String
    isVerified: Boolean
    email_verified: Boolean
    totalLinks: Int
    sentLinks: [ID!]
    receivedLinks: [ID!]
    links: [ID!]
    role: String
    lastLogin: String
    createdAt: String
    updatedAt: String
  }

  type UserSearchResult {
    success: Boolean!
    totalCount: Int!
    hasMore: Boolean!
    results: [User!]!
  }

  type getUser {
    user: User!
  }

  type LinkStatusUpdate {
    userId: ID!
    status: String! # 'sent', 'pending', 'linked'
  }

  extend type Subscription {
    linkRequestStatusUpdated(receiverId: ID!): LinkStatusUpdate!
  }

  extend type Query {
    searchUsers(
      username: String!
      limit: Int = 10
      offset: Int = 0
    ): UserSearchResult!
    getUser(id: String!): getUser!
  }
`;

export { finUserResolvers as findUserResolvers };
