import { Post } from "../models/postModel.js";
import { Logger } from "../utils/logger.js";
import { requireAuth } from "../utils/requireAuth.js";

export const feedResolvers = {
  getHomeFeed: async (_, { offset = 0, limit = 10 }, context) => {
    try {
      // Get current user for isLiked field (if authenticated)
      let currentUser = null;
      try {
        currentUser = await requireAuth(context.req);
      } catch (error) {
        return {
          success: false,
          message: error,
          statusCode: 500,
          posts: [],
        };
      }

      const postsWithExtras = await Post.aggregate([
        { $sort: { createdAt: -1 } },
        { $skip: offset },
        { $limit: limit },
        // Populate author
        {
          $lookup: {
            from: "users", // name of the User collection
            localField: "author",
            foreignField: "_id",
            as: "author"
          }
        },
        { $unwind: "$author" }, // Convert author array to object
        // Lookup in Likes collection to check if the current user liked the post
        {
          $lookup: {
            from: "likes", // the name of your Like collection in MongoDB
            let: { postId: "$_id" },
            pipeline: [
              { $match: { $expr: { $and: [{ $eq: ["$post", "$$postId"] }, { $eq: ["$user", currentUser?._id] }] } } },
              { $project: { _id: 1 } }
            ],
            as: "likedByUser"
          }
        },

        // Add the isLiked field based on whether likedByUser array is empty
        {
          $addFields: {
            isLiked: { $gt: [{ $size: "$likedByUser" }, 0] }
          }
        },

        // Optional: remove the temporary likedByUser array
        { $project: { likedByUser: 0 } }
      ]);




      return {
        success: true,
        message: "Home feed fetched successfully",
        statusCode: 200,
        posts: postsWithExtras,
      };
    } catch (error) {
      Logger.error("Get home feed error:", error);
      return {
        success: false,
        message: "Failed to fetch home feed",
        statusCode: 500,
        posts: [],
      };
    }
  },
}