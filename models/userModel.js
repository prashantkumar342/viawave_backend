import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: function () {
        // Password is only required if not using OAuth
        return !this.googleId;
      },
      minlength: 6,
    },
    currentProfession: {
      type: [mongoose.Schema.Types.Mixed], // can hold any structure
      default: [],
    },
    fullName: {
      type: String,
      trim: true,
      default: '',
    },
    dob: {
      type: Date,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'Male', 'Female', 'Other'],
    },
    bio: {
      type: String,
      maxlength: 500,
      default: '',
      trim: true,
    },
    contactNumber: {
      type: String,
      default: '',
      trim: true,
    },
    profilePicture: {
      type: String,
      default: '',
    },
    fcmToken: {
      type: String,
    },
    coverImage: {
      type: String,
      default: '',
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    email_verified: {
      type: Boolean,
      default: false,
    },
    // sentLinks has the objectIds of the user's which are used to send the link requests or we can say sent request's users
    sentLinks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // receivedLinks has the objectIds of the user's who sent the linkRequest
    receivedLinks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // links has the user's objectIds that are linked(or friends) with that user or accepted the request
    links: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    role: {
      type: String,
      enum: ['user', 'moderator', 'admin', 'superadmin'],
      default: 'user',
    },
    lastLogin: {
      type: Date,
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true, // allows multiple null values
    },
    provider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
    },

    token: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// Pre-save middleware for password hashing
userSchema.pre('save', async function (next) {
  // Only hash password if it's modified and exists (not OAuth users)
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Method to compare entered password with hashed password in DB
userSchema.methods.comparePassword = async function (enteredPassword) {
  if (!this.password) return false; // OAuth users don't have passwords
  return bcrypt.compare(enteredPassword, this.password);
};

export const User = mongoose.model('User', userSchema);
