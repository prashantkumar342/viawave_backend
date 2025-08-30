import { gql } from 'apollo-server-express';
import { postResolvers } from '../resolvers/postResolver.js'

export const userPostTypeDefs = gql`
  union Post = ArticlePost | ImagePost | VideoPost

  type ArticlePost {
    id: ID!
    author: User!
    caption: String
    tags: [String!]!
    title: String!
    content: String!
    createdAt: String!
    updatedAt: String!
    likesCount: Int!
    commentsCount: Int!
    totalLikes: Int!
    totalComments: Int!
    type: String!
  }

  type ImagePost {
    id: ID!
    author: User!
    caption: String
    tags: [String!]!
    images: [String!]!
    createdAt: String!
    updatedAt: String!
    likesCount: Int!
    commentsCount: Int!
    totalLikes: Int!
    totalComments: Int!
    type: String!
  }

  type VideoPost {
    id: ID!
    author: User!
    caption: String
    tags: [String!]!
    videoUrl: String!
    thumbnailUrl: String
    createdAt: String!
    updatedAt: String!
    likesCount: Int!
    commentsCount: Int!
    totalLikes: Int!
    totalComments: Int!
    type: String!
  }

  type Comment {
    id: ID!
    user: User!
    text: String!
    createdAt: String!
    updatedAt: String!
    parentComment: ID
    replyCount: Int
    likeCount: Int
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

  type CommentsResponse {
    success: Boolean!
    message: String!
    statusCode: Int!
    comments: [Comment!]!
  }

  type CommentResponse {
    success: Boolean!
    message: String!
    statusCode: Int!
    comment: Comment
  }

  extend type Query {
    getMyPosts(limit: Int, offset: Int): PostsResponse!
    getPostById(postId: ID!): PostResponse!
    getUserPosts(userId: ID!, limit: Int, offset: Int): PostsResponse!
    getHomeFeed(limit: Int, offset: Int): PostsResponse!
    getPostComments(postId: ID!, limit: Int, offset: Int): CommentsResponse!
    getCommentReplies(commentId: ID!, limit: Int, offset: Int): CommentsResponse!
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
      images: [String!]!        # Array of image URLs
      caption: String
      tags: [String]
    ): PostResponse!

    createVideoPost(
      videoUrl: String!
      thumbnailUrl: String
      caption: String
      tags: [String]
    ): PostResponse!

    toggleLike(postId: ID!): PostResponse!
    
    addComment(postId: ID!, text: String!, parentCommentId: ID): PostResponse!
    editComment(commentId: ID!, text: String!): PostResponse!
    deleteComment(commentId: ID!): PostResponse!
    
    toggleCommentLike(commentId: ID!): CommentResponse!
  }
`;

export const userPostResolvers = {
  Query: {
    getMyPosts: postResolvers.Query.getMyPosts,
    getPostById: postResolvers.Query.getPostById,
    getUserPosts: postResolvers.Query.getUserPosts,
    getHomeFeed: postResolvers.Query.getHomeFeed,
    getPostComments: postResolvers.Query.getPostComments,
    getCommentReplies: postResolvers.Query.getCommentReplies,
  },
  Mutation: {
    createArticlePost: postResolvers.Mutation.createArticlePost,
    createImagePost: postResolvers.Mutation.createImagePost,
    createVideoPost: postResolvers.Mutation.createVideoPost,
    toggleLike: postResolvers.Mutation.toggleLike,
    addComment: postResolvers.Mutation.addComment,
    editComment: postResolvers.Mutation.editComment,
    deleteComment: postResolvers.Mutation.deleteComment,
    toggleCommentLike: postResolvers.Mutation.toggleCommentLike,
  },
  Post: {
    __resolveType(obj) {
      if (obj.title && obj.content) return 'ArticlePost';
      if (obj.images) return 'ImagePost';
      if (obj.videoUrl) return 'VideoPost';
      return null;
    },
  },
};