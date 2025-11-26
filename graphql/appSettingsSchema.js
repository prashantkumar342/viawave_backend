import { gql } from 'apollo-server-express';

export const appSettingsTypeDefs = gql`
  type privacySettings {
    publicProfile: Boolean!
    visibleContact: Boolean!
    visibleAddress: Boolean!
  }

  type GetPrivacyAndSecurityValuesResponse {
    success: Boolean!
    message: String!
    statusCode: Int!
    appSettings: AppSettings
  }

  type AppSettings {
    id: ID!
    user: User
    privacySettings: privacySettings
  }

  input privacySettingsInput {
    publicProfile: Boolean
    visibleContact: Boolean
    visibleAddress: Boolean
  }

  type Query {
    getAppSettings: [AppSettings!]!
    getPrivacyAndSecurityValues: GetPrivacyAndSecurityValuesResponse
  }
  type Mutation {
    updatePrivacyAndSecuritySettings(
      input: privacySettingsInput
    ): GetPrivacyAndSecurityValuesResponse!
  }
`;
