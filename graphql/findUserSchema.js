import { gql } from 'apollo-server-express';

import { finUserResolvers } from '../resolvers/findUser.js';

export const findUserTypeDefs = gql`
  type User {
    id: ID!
    username: String!
    email: String!
    firstname: String
    lastname: String
    bio: String
    profilePicture: String
    isVerified: Boolean
    role: String
    provider: String
    googleId: String
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
