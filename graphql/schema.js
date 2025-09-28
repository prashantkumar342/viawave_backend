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

// import { userPostResolvers, userPostTypeDefs } from './postSchema.js';
import { userModerationResolvers, userModerationTypeDefs } from './userModerationSchema.js';
import { feedsResolvers, feedTypeDefs } from './feedSchema.js'; 
import { interactionResolvers, interactionTypeDefs } from './interactionSchema.js';

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
  // userPostTypeDefs,
  notificationTypeDefs,
  userModerationTypeDefs,
  feedTypeDefs,
  interactionTypeDefs
]);
export const resolvers = mergeResolvers([
  userResolvers,
  findUserResolvers,
  userConversationResolvers,
  userLinkRequestResolvers,
  // userPostResolvers,
  notificationsResolvers,
  userModerationResolvers,
  feedsResolvers,
  interactionResolvers
]);
