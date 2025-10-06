import { mergeResolvers, mergeTypeDefs } from '@graphql-tools/merge';


import { findUserResolvers, findUserTypeDefs } from './findUserSchema.js';
import { notificationsResolvers, notificationTypeDefs } from './notificationSchema.js';
import { userResolvers, userTypeDefs } from './userAuthSchema.js';
import {
  userConversationResolvers,
  userConversationTypeDefs,
} from './userConversationSchema.js';
import {
  userLinkRequestResolvers,
  userLinkRequestTypeDefs,
} from './userLinksSchema.js';

import { feedsResolvers, feedTypeDefs } from './feedSchema.js';
import { interactionResolvers, interactionTypeDefs } from './interactionSchema.js';
import { postSchemaResolvers, postTypeDefs } from './postSchema.js';
import { userModerationResolvers, userModerationTypeDefs } from './userModerationSchema.js';
import { userUnreadsResolver, userUnreadsTypeDefs } from './userUnreadsSchema.js';

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
  postTypeDefs,
  notificationTypeDefs,
  userModerationTypeDefs,
  feedTypeDefs,
  interactionTypeDefs,
  userUnreadsTypeDefs
]);
export const resolvers = mergeResolvers([
  userResolvers,
  findUserResolvers,
  userConversationResolvers,
  userLinkRequestResolvers,
  postSchemaResolvers,
  notificationsResolvers,
  userModerationResolvers,
  feedsResolvers,
  interactionResolvers,
  userUnreadsResolver
]);
