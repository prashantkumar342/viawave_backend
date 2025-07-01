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
        .populate("additionalDetails")
        .populate({
          path: "courses",
          populate: {
            path: "instructor",
            model: "user",
            select: "firstName lastName _id",
          },
        })
        .populate({
          path: "courses",
          populate: {
            path: "category",
            model: "Category",
            select: "name _id",
          },
        })
        .populate({
          path: "materials",
          populate: [
            {
              path: "author",
            }
          ],
        });

      if (!userDoc) {
        console.log("User not found in database");
        return res.status(401).json({ success: false, message: "User not found" });
      }



      // Check if current session is valid
      if (!userDoc.currentSession ||
        !userDoc.currentSession.isActive ||
        userDoc.currentSession.token !== token) {

        console.log("Session validation failed - Details:", {
          hasSession: !!userDoc.currentSession,
          isActive: userDoc.currentSession?.isActive,
          tokenMatch: userDoc.currentSession?.token === token,
          dbToken: userDoc.currentSession?.token?.substring(0, 20) + "...",
          reqToken: token?.substring(0, 20) + "..."
        });

        // Clear invalid cookie
        res.clearCookie("token");

        return res.status(401).json({
          success: false,
          message: "Session expired. Please login again.",
          sessionInvalid: true
        });
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

