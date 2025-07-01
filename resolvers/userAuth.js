// backend/resolvers/userAuth.js
import { User as userModel } from '../models/userModel.js';
import { Otp as otpModel } from '../models/otpMode.js';
import generateOTP from '../utils/generateOtp.js';
import generateToken from '../utils/generateToken.js';
import { otpMailTemplate } from '../templates/otpMailTemplate.js';
import { sendMail } from '../config/mailConfig.js';
import { OAuth2Client } from "google-auth-library";
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID_WEB);


export const googleAuth = async (_, { idToken }, { res }) => {
  try {
    console.log("google Auth")
    // 1. Verify token
    const audiences = [
      process.env.GOOGLE_CLIENT_ID_WEB,
      process.env.GOOGLE_CLIENT_ID_ANDROID,
      process.env.GOOGLE_CLIENT_ID_IOS,
    ].filter(Boolean);

    const ticket = await client.verifyIdToken({
      idToken,
      audience: audiences, // Accept multiple client IDs
    });

    const payload = ticket.getPayload();

    // 2. Extract info
    const { sub: googleId, email, given_name, family_name, picture } = payload;

    // 3. Try finding user by googleId or email
    let user = await userModel.findOne({
      $or: [{ googleId }, { email }],
    });

    if (!user) {
      // 4. Create new user
      const username = email.split('@')[0] + '_' + googleId.slice(-4); // fallback username
      user = await userModel.create({
        username,
        email,
        googleId,
        profilePicture: picture,
        provider: 'google',
        email_verified: true,
        firstname: given_name,
        lastname: family_name
      });
    } else if (!user.googleId) {
      // 5. Link Google to existing email-based user (optional)
      user.googleId = googleId;
      user.provider = 'google';
      user.email_verified = true;
      await user.save();
    }

    // 6. Generate token and update last login
    const token = generateToken(user);
    user.token = token;
    user.lastLogin = new Date();
    await user.save();

    // 7. Set cookie for web users
    if (res) {
      res.cookie("waveToken", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }
    return {
      success: true,
      message: "Google login successful",
      statusCode: 200,
      token,
      userData: user,
    };
  } catch (error) {
    console.error("Google OAuth Error:", error);
    return {
      success: false,
      message: "Google login failed",
      statusCode: 500,
    };
  }
};

export const sendOTP = async (_, { email }) => {
  try {
    const existingUser = await userModel.findOne({ email: email });
    if (existingUser) {
      return { success: false, message: "Email already exists", statusCode: 409 };
    }

    const OTP = generateOTP();

    await otpModel.findOneAndUpdate(
      { email: email },
      { $set: { otp: OTP } },
      { upsert: true, new: true }
    );

    await sendMail({
      to: email,
      subject: "Your ViaWave OTP Code",
      html: otpMailTemplate(OTP)
    });

    return {
      OTP: OTP.toString(),
      success: true,
      message: "OTP sent successfully"
    };
  } catch (error) {
    console.error('Send OTP Error:', error);
    return {
      success: false,
      message: "Failed to send OTP",
      statusCode: 500
    };
  }
};

export const register = async (_, { username, email, password, otp }) => {
  try {
    const existingUser = await userModel.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return {
        success: false,
        message: "Username or email already exists",
        statusCode: 409
      };
    }

    const verifyOTP = await otpModel.findOne({ email });
    if (!verifyOTP) {
      return {
        success: false,
        message: "OTP not found",
        statusCode: 404
      };
    }

    if (verifyOTP.otp !== otp) {
      return {
        success: false,
        message: "Invalid OTP",
        statusCode: 401
      };
    }

    const newUser = new userModel({
      username,
      email,
      password,
      provider: 'local',
      email_verified: true
    });

    await newUser.save();
    await otpModel.deleteOne({ email });

    return {
      user: newUser,
      success: true,
      message: "Registration successful",
      statusCode: 201
    };
  } catch (error) {
    console.error('Registration Error:', error);
    return {
      success: false,
      message: `Registration failed: ${error.message}`,
      statusCode: 500
    };
  }
};

export const login = async (_, { email, password }, { res }) => {
  try {
    const user = await userModel.findOne({ email });

    if (!user || !(await user.comparePassword(password))) {
      return {
        success: false,
        message: "Invalid credentials",
        statusCode: 401,
      };
    }

    const token = generateToken(user);

    // Set cookie for web clients
    if (res) {
      res.cookie("waveToken", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }

    // Update last login
    await userModel.findByIdAndUpdate(user._id, {
      lastLogin: new Date(),
      token: token
    });

    return {
      success: true,
      message: "Login successful",
      statusCode: 200,
      token: token,
      userData: user,
    };
  } catch (error) {
    console.error('Login Error:', error);
    return {
      success: false,
      message: "Login failed",
      statusCode: 500,
    };
  }
};