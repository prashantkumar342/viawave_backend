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
    coverImage: String        # New field for article cover images
    createdAt: String!
    updatedAt: String!
    likesCount: Int!
    commentsCount: Int!
    totalLikes: Int!
    totalComments: Int!
    isLiked: Boolean!         # New field - indicates if current user liked this post
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
    isLiked: Boolean!         # New field - indicates if current user liked this post
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
    isLiked: Boolean!         # New field - indicates if current user liked this post
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

  type File {
    filename: String!
    mimetype: String!
    encoding: String!
    url: String!
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

  type DeleteResponse {
    success: Boolean!
    message: String!
    statusCode: Int!
  }

  type PostUpdatePayload {
    postId: ID!
    action: String!        # e.g. LIKE, UNLIKE, COMMENT_ADDED, COMMENT_UPDATED, COMMENT_DELETED
    like: LikePayload      # for like/unlike
    comment: CommentUpdate # for comment events
    totalLikes: Int
    totalComments: Int
    updatedAt: String!
  }

  type LikePayload {
    userId: ID!
  }

  type CommentUpdate {
    id: ID!
    text: String
    parentCommentId: ID
    user: User
    createdAt: String
    updatedAt: String
  }

  extend type Query {
    getMyPosts(limit: Int, offset: Int): PostsResponse!
    getPostById(postId: ID!): PostResponse!
    getUserPosts(userId: ID!, limit: Int, offset: Int): PostsResponse!
    getHomeFeed(limit: Int, offset: Int): PostsResponse!
    getPostComments(postId: ID!, limit: Int, offset: Int): CommentsResponse!
    getCommentReplies(commentId: ID!, limit: Int, offset: Int): CommentsResponse!
  }

  extend type Subscription {
    # Fires when a post is updated (like/comment/edit/delete, etc.)
    postUpdated(postId: ID!): PostUpdatePayload!

    # Optional: Fires whenever a new post is created (global feed updates)
    postCreated: Post!
  }

  extend type Mutation {
    createArticlePost(
      title: String!
      content: String          # Optional text content
      contentFile: String     # Optional base64 image content
      caption: String
      tags: [String]
    ): PostResponse!

    createImagePost(
      images: [String!]!        # Array of uploaded image paths
      caption: String
      tags: [String]
    ): PostResponse!

    createVideoPost(
      videoUrl: String!         # Uploaded video path
      thumbnailUrl: String      # Optional uploaded thumbnail path
      caption: String
      tags: [String]
    ): PostResponse!

    deletePost(postId: ID!): DeleteResponse!

    toggleLike(postId: ID!): PostResponse!
    
    addComment(postId: ID!, text: String!, parentCommentId: ID): PostResponse!
    editComment(commentId: ID!, text: String!): PostResponse!
    deleteComment(commentId: ID!): PostResponse!
    
    toggleCommentLike(commentId: ID!): CommentResponse!
  }
`;

import { pubsub } from '../utils/pubsub.js';

const postTopic = (postId) => `POST_UPDATED_${String(postId)}`;
const POST_CREATED_TOPIC = "POST_CREATED";

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
    createArticlePost: async (_, args, context) => {
      const result = await postResolvers.Mutation.createArticlePost(_, args, context);
      if (result.success && result.post) {
        pubsub.publish(POST_CREATED_TOPIC, { postCreated: result.post });
      }
      return result;
    },
    createImagePost: async (_, args, context) => {
      const result = await postResolvers.Mutation.createImagePost(_, args, context);
      if (result.success && result.post) {
        pubsub.publish(POST_CREATED_TOPIC, { postCreated: result.post });
      }
      return result;
    },
    createVideoPost: async (_, args, context) => {
      const result = await postResolvers.Mutation.createVideoPost(_, args, context);
      if (result.success && result.post) {
        pubsub.publish(POST_CREATED_TOPIC, { postCreated: result.post });
      }
      return result;
    },
    deletePost: postResolvers.Mutation.deletePost,
    toggleLike: postResolvers.Mutation.toggleLike,
    addComment: postResolvers.Mutation.addComment,
    editComment: postResolvers.Mutation.editComment,
    deleteComment: postResolvers.Mutation.deleteComment,
    toggleCommentLike: postResolvers.Mutation.toggleCommentLike,
  },
  Subscription: {
    postUpdated: {
      subscribe: (_, { postId }) => pubsub.asyncIterableIterator(postTopic(postId)),
    },
    postCreated: {
      subscribe: () => pubsub.asyncIterableIterator(POST_CREATED_TOPIC),
    },
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