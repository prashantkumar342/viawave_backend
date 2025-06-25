import mongoose from "mongoose";
import bcrypt from "bcryptjs";



const userSchema = new mongoose.Schema({
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
    required: true,
    minlength: 6,
  },
  firstname: {
    type: String,
    // required: true,
    trim: true,
  },
  lastname: {
    type: String,
    // required: true,
    trim: true,
  },
  dob: {
    type: Date,
    // required: true,
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    // required: true,
  },
  bio: {
    type: String,
    maxlength: 500,
    default: '',
    trim: true,
  },
  profilePicture: {
    type: String, // store URL or file path
    default: '',
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  role: {
    type: String,
    enum: ['user', 'moderator', 'admin', 'superadmin'],
    default: 'user',
  },
  lastLogin: {
    type: Date,
  }
}, { timestamps: true });




userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Method to compare entered password with hashed password in DB
userSchema.methods.comparePassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

// Create the model from the schema
export const User = mongoose.model("User", userSchema);
