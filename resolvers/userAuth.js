import { User as userModel } from '../models/userModel.js';
import { Otp as otpModel } from '../models/otpMode.js';
import generateOTP from '../utils/generateOtp.js';
import generateToken from '../utils/generateToken.js';
import { otpMailTemplate } from '../templates/otpMailTemplate.js';
import { sendMail } from '../config/mailConfig.js';

export const sendOTP = async (_, { email }) => {
  const existingUser = await userModel.findOne({ email: email });
  if (existingUser) return { success: false, message: "Username or email already exists", statusCode: 409 }


  const OTP = generateOTP()

  const otpExist = await otpModel.findOne({ email: email })
  if (!otpExist) {
    await otpModel.create({
      otp: OTP,
      email: email
    });
    await sendMail({
      to: email,
      subject: "Your ViaWave OTP Code",
      html: otpMailTemplate(OTP)
    })
    return { OTP: OTP.toString(), success: true, message: "OTP Sent Success" }
  }
  const otpUpdate = await otpModel.findOneAndUpdate(
    { email: email },
    { $set: { otp: OTP } },
    { upsert: true, new: true }
  );
  await sendMail({
    to: email,
    subject: "Your ViaWave OTP Code - secure inside",
    html: otpMailTemplate(otpUpdate.otp)
  })

  return { OTP: OTP.toString(), success: true, message: "OTP Sent Success" }
};

export const register = async (_, { username, email, password, otp }) => {
  try {
    const existingUser = await userModel.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return { success: false, message: "Username or email already exists", statusCode: 409 };
    }

    const verifyOTP = await otpModel.findOne({ email });
    if (!verifyOTP) {
      return { success: false, message: "OTP doesn't exist", statusCode: 404 };
    }

    if (verifyOTP.otp !== otp) {
      return { success: false, message: "Invalid OTP", statusCode: 401 };
    }

    const newUser = new userModel({ username, email, password });
    await newUser.save();
    await otpModel.deleteOne({ email });
    return { user: newUser, success: true, message: "Registration Successful", statusCode: 201 };
  } catch (error) {
    return { success: false, message: `Error: ${error.message}`, statusCode: 500 };
  }
};

export const login = async (_, { email, password }, { res }) => {
  try {
    // Find user by email
    const user = await userModel.findOne({ email });

    if (!user || !(await user.comparePassword(password))) {
      return {
        success: true,
        message: "Invalid credentials",
        statusCode: 401,
        user: null,
      };
    }

    // Generate authentication token
    const token = generateToken(user);

    // Set token in HTTP-only cookie
    res.cookie("waveToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // Cookie expires in 7 days
    });
    await userModel.findOneAndUpdate(
      { email: email },
      { $set: { lastLogin: new Date() } },
      { new: true }
    );

    // Return structured response
    return {
      success: true,
      message: "Login successful",
      statusCode: 200,
      user,
    };
  } catch (error) {
    // Extract error details
    const [statusCode, message] = error.message.split(": ");

    return {
      success: false,
      message: message || "Server error",
      statusCode: Number(statusCode) || 500,
      user: null,
    };
  }
};
