import { gql } from 'apollo-server-express';
import { register, login, sendOTP } from '../resolvers/userAuth.js';

export const userTypeDefs = gql`
  type User {
    id: ID!
    username: String!
    email: String!
    createdAt: String
  }
   type OTPResponse {
    success: Boolean!
    message: String!
    OTP:String
  }

  type registerResponse {
    success: Boolean!
    message: String!
    statusCode:Int!
    user: User
  }
  type loginResponse {
    success: Boolean!
    message: String!
    statusCode:Int!
    user: User
  }

  extend type Query {
    _user: String
  }

  extend type Mutation {
    register(username: String!, email: String!, password: String!, otp:Int!): registerResponse!
    login(email: String!, password: String!): loginResponse!
    sendOTP(email:String!):OTPResponse
  }
`;

export const userResolvers = {
  Mutation: {
    register,
    login,
    sendOTP
  },
};
