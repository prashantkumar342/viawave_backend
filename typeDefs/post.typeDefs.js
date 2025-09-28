import gql from "graphql-tag";

export const postTypeDefs = gql`{
  # ------------------MEDIA TYPE------------------
  type Media {
  url: String!
  type: MediaType!       # "image" or "video"
  thumbnailUrl: String   # optional, for videos
}

enum MediaType {
  image
  video
}

# ------------------POST TYPE------------------
  type Post {
  _id: ID!
  author: ID!            # reference to User ID
  caption: String!
  media: [Media!]!
  type: String!          # e.g., "Post" or "Article"
  createdAt: String!
  updatedAt: String!
}

# ------------------INPUTS ------------------
  input MediaInput {
  url: String!
  type: MediaType!
  thumbnailUrl: String
}

input CreatePostInput {
  caption: String!
  media: [MediaInput!]!
}

# ------------------QUERIES ------------------
  type Query {
  getPost(id: ID!): Post
  getPosts(offset: Int, limit: Int): [Post!]!
}

# ------------------MUTATIONS ------------------
  type Mutation {
  createPost(input: CreatePostInput!): Post!
}

}`