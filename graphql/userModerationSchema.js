

import gql from "graphql-tag"
import { userModerationResolver } from "../resolvers/userModerationResolver.js"

export const userModerationTypeDefs = gql`
  type User {
      id: ID!
      username: String!
      email: String
      firstname: String
      lastname: String
      bio: String
      profilePicture: String
      isVerified: Boolean
      sentLinks: [ID]
      receivedLinks: [ID]
      links: [ID]
      role: String
      provider: String
      googleId: String
      createdAt: String
      updatedAt: String
    }

    type ToggleBlockResponse {
  success: Boolean!
  statusCode: Int!
  message: String!
  userData: User
}

    extend type Mutation {
    toggleBlock(userId: ID!): ToggleBlockResponse!
    }
`
export const userModerationResolvers = {
  Mutation: {
    toggleBlock: userModerationResolver.mutation.toggleBlock
  }
}