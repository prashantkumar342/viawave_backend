import { gql } from 'apollo-server-express';
import { postResolvers } from '../resolvers/postResolver.js'

export const userPostTypeDefs = gql`
  union Post = ArticlePost | ImagePost | VideoPost

  type ArticlePost {
    id: ID!
    author: User!
    caption: String
    tags: [String!]!
    likes: [User!]!
    comments: [Comment!]!
    title: String!
    content: String!  # This will store either text content or file path
    createdAt: String!
    updatedAt: String!
    contentFile: String  # Optional: if you want to separate file reference
  }

  type ImagePost {
    id: ID!
    author: User!
    caption: String
    tags: [String!]!
    likes: [User!]!
    comments: [Comment!]!
    imageUrl: String!
    createdAt: String!
    updatedAt: String!
  }

  type VideoPost {
    id: ID!
    author: User!
    caption: String
    tags: [String!]!
    likes: [User!]!
    comments: [Comment!]!
    videoUrl: String!
    createdAt: String!
    updatedAt: String!
  }

  type Comment {
    id: ID!
    user: User!
    text: String!
    createdAt: String!
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

  extend type Query {
    getPosts(limit: Int = 20, offset: Int = 0): PostsResponse!
    getPostById(postId: ID!): PostResponse!
  }

  extend type Mutation {
    createArticlePost(
      title: String!
      content: String           # Text content (optional if file provided)
      contentFile: String       # Base64 encoded file (optional if text provided)
      caption: String
      tags: [String]
    ): PostResponse!

    createImagePost(
      imageUrl: String!
      caption: String
      tags: [String]
    ): PostResponse!

    createVideoPost(
      videoUrl: String!
      caption: String
      tags: [String]
    ): PostResponse!
  }
`;

export const userPostResolvers = {
  // Query: {
  // getPosts: postResolvers.Query.getPosts,
  // getPostById: postResolvers.Query.getPostById,
  // },
  Mutation: {
    createArticlePost: postResolvers.Mutation.createArticlePost,
    // createImagePost: postResolvers.Mutation.createImagePost,
    // createVideoPost: postResolvers.Mutation.createVideoPost,
  },
  Post: {
    __resolveType(obj) {
      if (obj.title && (obj.content || obj.contentFile)) return 'ArticlePost';
      if (obj.imageUrl) return 'ImagePost';
      if (obj.videoUrl) return 'VideoPost';
      return null;
    },
  },
};