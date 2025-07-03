import { gql } from 'apollo-server-express';
import {
  register,
  login,
  sendOTP,
  googleAuth
} from '../resolvers/userAuth.js';

export const userTypeDefs = gql`
  type User {
    id: ID!
    username: String!
    email: String!
    firstname: String
    lastname: String
    bio: String
    profilePicture: String
    isVerified: Boolean
    sentLinks:[ID]
    receivedLinks:[ID]
    links:[ID]
    role: String
    provider: String
    googleId: String
    createdAt: String
    updatedAt: String
  }


  type OTPResponse {
    success: Boolean!
    message: String!
    OTP: String
  }

  type registerResponse {
    success: Boolean!
    message: String!
    statusCode: Int!
    user: User
  }

  type loginResponse {
    success: Boolean!
    message: String!
    statusCode: Int!
    token: String
    userData: User
  }
  type AuthResponse {
  success: Boolean!
  message: String!
  statusCode: Int!
  token: String
  userData: User
}


  extend type Query {
    _user: String
  }

  extend type Mutation {
    register(username: String!, email: String!, password: String!, otp: Int!): registerResponse!
    login(email: String!, password: String!): loginResponse!
    googleAuth(idToken: String!): AuthResponse!
    sendOTP(email: String!): OTPResponse
   
  }
`;

export const userResolvers = {
  Mutation: {
    register,
    login,
    sendOTP,
    googleAuth
  },
};