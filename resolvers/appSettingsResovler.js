import { appSettingsServices } from '../services/appSettings.services.js';
import { requireAuth } from '../utils/requireAuth.js';

export const appSettingsResovlers = {
  Query: {
    // ================= Security and Privacy =================
    getPrivacyAndSecurityValues: async (_, {}, context) => {
      try {
        const currentUser = await requireAuth(context.req);
        const settings =
          await appSettingsServices.getPrivacyAndSecuritySettings(
            currentUser.id
          );

        if (!settings) {
          return {
            success: false,
            message: 'Settings not found',
            statusCode: 404,
          };
        }

        return {
          success: true,
          message: 'Privacy and security values retrieved successfully',
          statusCode: 200,
          appSettings: {
            user: {
              id: currentUser._id,
              username: currentUser.username,
              email: currentUser.email,
            },
            id: settings._id,
            privacySettings: settings?.privacySettings,
          },
        };
      } catch (error) {
        console.error(error);
        return {
          success: false,
          message: 'An error occurred',
          statusCode: 500,
        };
      }
    },
  },

  Mutation: {
    updatePrivacyAndSecuritySettings: async (_, { input }, context) => {
      try {
        const currentUser = await requireAuth(context.req);

        const updatedSettings =
          await appSettingsServices.updatePrivacyAndSecuritySettings(
            currentUser.id,
            input
          );

        if (!updatedSettings) {
          return {
            success: false,
            message: 'Settings not found',
            statusCode: 404,
          };
        }

        return {
          success: true,
          message: 'Privacy and security settings updated successfully',
          statusCode: 200,
          appSettings: {
            user: {
              id: currentUser._id,
              username: currentUser.username,
              email: currentUser.email,
            },
            id: updatedSettings._id,
            privacySettings: updatedSettings?.privacySettings,
          },
        };
      } catch (error) {
        console.error(error);
        return {
          success: false,
          message: 'An error occurred',
          statusCode: 500,
        };
      }
    },
  },
};
