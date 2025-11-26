import { gql } from "apollo-server-express";
import { postResolvers } from "../resolvers/postResolver.js";

export const postTypeDefs = gql`
  type User {
    _id: ID!
    username: String!
    email: String
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
    caption: String
    title: String
    media: [Media!]!
    type: String
    isLiked: Boolean!
    likesCount: Int
    commentsCount: Int
    createdAt: String!
    updatedAt: String!
  }

  type PostResponse {
    success: Boolean!
    message: String!
    statusCode: Int!
    post: Post
  }

  type PostsResponse {
    success: Boolean!
    message: String!
    statusCode: Int!
    posts: [Post!]!
  }

  type DeleteResponse {
    success: Boolean!
    message: String!
    statusCode: Int!
  }

  extend type Query {
    getMyPosts(limit: Int, offset: Int): PostsResponse!
    getUserPosts(userId: ID!, limit: Int, offset: Int): PostsResponse!
    getPostById(postId: ID!): PostResponse!
  }

  extend type Mutation {
    deletePost(postId: ID!): DeleteResponse!
  }
`;

export const postSchemaResolvers = {
  Query: {
    getMyPosts: postResolvers.Query.getMyPosts,
    getUserPosts: postResolvers.Query.getUserPosts,
    getPostById: postResolvers.Query.getPostById,
  },
  Mutation: {
    deletePost: postResolvers.Mutation.deletePost,
  },
};
