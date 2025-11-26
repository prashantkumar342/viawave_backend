import { mergeResolvers, mergeTypeDefs } from '@graphql-tools/merge';

import { appSettingsResovlers } from '../resolvers/appSettingsResovler.js';
import { appSettingsTypeDefs } from './appSettingsSchema.js';
import { feedTypeDefs, feedsResolvers } from './feedSchema.js';
import { findUserResolvers, findUserTypeDefs } from './findUserSchema.js';
import {
  interactionResolvers,
  interactionTypeDefs,
} from './interactionSchema.js';
import {
  notificationTypeDefs,
  notificationsResolvers,
} from './notificationSchema.js';
import { postSchemaResolvers, postTypeDefs } from './postSchema.js';
import { userResolvers, userTypeDefs } from './userAuthSchema.js';
import {
  userConversationResolvers,
  userConversationTypeDefs,
} from './userConversationSchema.js';
import {
  userLinkRequestResolvers,
  userLinkRequestTypeDefs,
} from './userLinksSchema.js';
import {
  userModerationResolvers,
  userModerationTypeDefs,
} from './userModerationSchema.js';
import {
  userUnreadsResolver,
  userUnreadsTypeDefs,
} from './userUnreadsSchema.js';

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
  userUnreadsTypeDefs,
  appSettingsTypeDefs,
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
  userUnreadsResolver,
  appSettingsResovlers,
]);
