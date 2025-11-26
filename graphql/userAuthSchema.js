import { gql } from 'apollo-server-express';

import {
  editProfile,
  googleAuth,
  login,
  register,
  sendOTP,
  validateUserSession,
} from '../resolvers/userAuth.js';

export const userTypeDefs = gql`
  type UserUnreads {
    notificationsUnreads: Int
    messagesUnreads: Int
  }

  type User {
    id: ID!
    username: String!
    email: String
    firstname: String
    lastname: String
    bio: String
    profilePicture: String
    isVerified: Boolean
    sentLinks: [ID]
    receivedLinks: [ID]
    links: [ID]
    role: String
    provider: String
    googleId: String
    createdAt: String
    updatedAt: String

    # 🔹 New field for badge counts
    userUnreads: UserUnreads
  }

  input EditProfileInput {
    username: String
    fullName: String
    dob: String
    gender: String
    bio: String
    profilePictureFile: String
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

  type editProfileResponse {
    success: Boolean!
    message: String!
    statusCode: Int!
    user: User
  }

  extend type Query {
    _user: String
    validateUserSession: loginResponse!
  }

  extend type Mutation {
    register(
      username: String!
      email: String!
      password: String!
      otp: Int!
    ): registerResponse!

    login(email: String!, password: String!, fcmToken: String!): loginResponse!

    googleAuth(idToken: String!): AuthResponse!

    sendOTP(email: String!): OTPResponse

    editProfile(
      username: String
      fullName: String
      dob: String
      gender: String
      bio: String
      profilePicture: String
    ): editProfileResponse!
  }
`;

export const userResolvers = {
  Mutation: {
    register,
    login,
    sendOTP,
    googleAuth,
    editProfile,
  },
  Query: {
    _user: () => 'User Query Works!',
    validateUserSession: validateUserSession,
  },
};
