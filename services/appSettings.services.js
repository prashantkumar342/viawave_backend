import { UserPrivacySecurityModel } from '../models/userPrivacySecurityModel.js';

export const appSettingsServices = {
  getPrivacyAndSecuritySettings: async (userId) => {
    try {
      const settings = await UserPrivacySecurityModel.findOne({
        userId: userId,
      });
      return settings;
    } catch (error) {
      console.error('Error fetching privacy and security settings:', error);
      return null;
    }
  },
  updatePrivacyAndSecuritySettings: async (userId, data) => {
    try {
      const update = {};

      Object.entries(data).forEach(([key, value]) => {
        if (typeof value !== 'undefined') {
          update[`privacySettings.${key}`] = value;
        }
      });

      const settings = await UserPrivacySecurityModel.findOneAndUpdate(
        { userId },
        { $set: update },
        { new: true, upsert: true } // upsert creates if missing
      );

      return settings;
    } catch (error) {
      console.error('Error updating privacy and security settings:', error);
      return null;
    }
  },
};
