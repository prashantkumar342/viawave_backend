import { mergeTypeDefs, mergeResolvers } from '@graphql-tools/merge';
import { userTypeDefs, userResolvers } from './userAuthSchema.js';

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
]);
export const resolvers = mergeResolvers([
  userResolvers,
])