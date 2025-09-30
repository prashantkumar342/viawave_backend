import { gql } from 'apollo-server-express';
import { feedResolvers } from '../resolvers/feedResolvers.js';

export const feedTypeDefs = gql`
  type User {
    _id: ID!
    username: String!
    email: String!
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
  # ------------------MEDIA TYPE------------------
  type Media {
  url: String!
  type: MediaType!
  thumbnailUrl: String
}

enum MediaType {
  image
  video
}

# ------------------POST TYPE------------------
  type Post {
  _id: ID!
  author: User!
  caption: String!
  title: String
  media: [Media!]!
  type: String   
  isLiked:Boolean!
  likesCount:Int
  commentsCount:Int
  createdAt: String!
  updatedAt: String!
}

 type PostsResponse {
    success: Boolean!
    message: String!
    statusCode: Int!
    posts: [Post!]!
  } 

  extend type Query {
    getHomeFeed(limit: Int, offset: Int): PostsResponse!
  }
`;

export const feedsResolvers = {
  Query: {
    getHomeFeed: feedResolvers.getHomeFeed,
  }
};