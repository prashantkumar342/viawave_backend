import { gql } from 'apollo-server-express';
import { feedResolvers } from '../resolvers/feedResolvers.js';

export const feedTypeDefs = gql`
union Post = ArticlePost | ImagePost | VideoPost

type ArticlePost {
    id: ID!
    author: User!
    caption: String
    tags: [String!]!
    title: String!
    image: String!
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
  # Post type for feed
 

 type PostResponse {
    success: Boolean!
    message: String!
    statusCode: Int!
    post: Post
  } 

  extend type Query {
    getHomeFeed(limit: Int, offset: Int): PostsResponse!
  }
`;

export const feedsResolvers = {
  Query: {
    getHomeFeed: feedResolvers.getHomeFeed,
  },
  Post: {
    __resolveType(obj) {
      if (obj.type === 'ArticlePost') {
        return 'ArticlePost';
      }
      if (obj.type === 'ImagePost') {
        return 'ImagePost';
      }
      if (obj.type === 'VideoPost') {
        return 'VideoPost';
      }
      return null; // fallback
    },
  },
};