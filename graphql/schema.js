import { mergeResolvers, mergeTypeDefs } from '@graphql-tools/merge';

import { findUserResolvers, findUserTypeDefs } from './findUserSchema.js';
import { userResolvers, userTypeDefs } from './userAuthSchema.js';
import {
  userConversationResolvers,
  userConversationTypeDefs,
} from './userConversationSchema.js';
import {
  userLinkRequestResolvers,
  userLinkRequestTypeDefs,
} from './userLinksSchema.js';

import { userPostResolvers, userPostTypeDefs } from './postSchema.js';

const rootTypeDefs = `#graphql
type Query {
  _empty:String
}

type Mutation{
  _empty:String
}

type Subscription {
  _empty: String
}

`;

export const typeDefs = mergeTypeDefs([
  rootTypeDefs,
  userTypeDefs,
  findUserTypeDefs,
  userConversationTypeDefs,
  userLinkRequestTypeDefs,
  userPostTypeDefs
]);
export const resolvers = mergeResolvers([
  userResolvers,
  findUserResolvers,
  userConversationResolvers,
  userLinkRequestResolvers,
  userPostResolvers
]);
