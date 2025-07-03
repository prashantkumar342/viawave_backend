import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import User from "../models/userModel.js";
dotenv.config();

export async function auth(req, res, next) {
  try {
    const token =
      req.cookies.token ||
      req.body.token ||
      req.header("Authorization")?.replace("Bearer ", "");


    if (!token) {
      return res.status(401).json({ success: false, message: "Token Missing" });
    }

    try {
      const decode = await jwt.verify(token, process.env.JWT_SECRET);

      const userDoc = await User.findById(decode.id)

      if (!userDoc) {
        console.log("User not found in database");
        return res.status(401).json({ success: false, message: "User not found" });
      }




      req.user = userDoc;
      console.log("Auth middleware successful");
      next();
    } catch (error) {
      console.log("JWT verification failed:", error.message);
      res.clearCookie("token");
      return res.status(401).json({ success: false, message: "Token is invalid" });
    }
  } catch (error) {
    console.log("Auth middleware error:", error);
    return res.status(401).json({
      success: false,
      message: "Something went wrong while validating the token",
    });
  }
}

