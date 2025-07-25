import { mergeTypeDefs, mergeResolvers } from '@graphql-tools/merge';
import { userTypeDefs, userResolvers } from './userAuthSchema.js';
import { findUserResolvers, findUserTypeDefs } from './findUserSchema.js';
import { userConversationResolvers, userConversationTypeDefs } from './userConversationSchema.js';

const rootTypeDefs = `#graphql
type Query {
  _empty:String
}

type Mutation{
  _empty:String
}
`;

export const typeDefs = mergeTypeDefs([
  rootTypeDefs,
  userTypeDefs,
  findUserTypeDefs,
  userConversationTypeDefs
]);
export const resolvers = mergeResolvers([
  userResolvers,
  findUserResolvers,
  userConversationResolvers
])