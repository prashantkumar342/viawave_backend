import mongoose from 'mongoose';

const UserPrivacySecuritySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  privacySettings: {
    type: Object,
    default: {
      publicProfile: true,
      visibleContact: true,
      visibleAddress: true,
    },
  },
});

export const UserPrivacySecurityModel = mongoose.model(
  'UserPrivacySecurity',
  UserPrivacySecuritySchema
);
