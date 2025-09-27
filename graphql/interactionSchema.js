import gql from "graphql-tag";
import { interactionResolvers as iR } from "../resolvers/interactionResolver.js";

export const interactionTypeDefs = gql`
  # ------------------ TYPES ------------------
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

  type MutationResponse {
    success: Boolean!
    message: String!
    statusCode: Int!
  }

  type PostUpdatePayload {
    post: Post
    action: String!        # e.g. LIKE, UNLIKE, COMMENT_ADDED, COMMENT_UPDATED, COMMENT_DELETED
    like: LikePayload
    comment: CommentUpdate
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

  # ------------------ QUERIES ------------------
  extend type Query {
    getPostComments(postId: ID!, limit: Int, offset: Int): CommentsResponse!
    getCommentReplies(commentId: ID!, limit: Int, offset: Int): CommentsResponse!
  }

  # ------------------ MUTATIONS ------------------
  extend type Mutation {
    toggleLike(postId: ID!): PostResponse!
    addComment(postId: ID!, text: String!, parentCommentId: ID): PostResponse!
    editComment(commentId: ID!, text: String!): PostResponse!
    deleteComment(commentId: ID!): PostResponse!
    toggleCommentLike(commentId: ID!): CommentResponse!
  }

  # ------------------ SUBSCRIPTIONS ------------------
  extend type Subscription {
    postUpdated(postId: ID!): PostUpdatePayload!
  }
`;

export const interactionResolvers = {
  Mutation: {
    toggleLike: iR.Mutation.toggleLike,
    addComment: iR.Mutation.addComment,
    editComment: iR.Mutation.editComment,
    deleteComment: iR.Mutation.deleteComment,
    toggleCommentLike: iR.Mutation.toggleCommentLike,
  },
  Query: {
    getPostComments: iR.Query.getPostComments,
    getCommentReplies: iR.Query.getCommentReplies,
  },
  Subscription: {
    postUpdated : iR.Subscription.postUpdated
  },
}
