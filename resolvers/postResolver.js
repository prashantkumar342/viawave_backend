import mongoose from "mongoose";
import { deleteFile } from "../middlewares/upload.js";
import { CommentLike } from "../models/commentLikeModel.js";
import { Comment } from "../models/commentModel.js";
import { Like } from "../models/likeModel.js";
import { Post } from "../models/postModel.js";
import { Logger } from "../utils/logger.js";
import { requireAuth } from "../utils/requireAuth.js";

export const postResolvers = {
  Query: {
    // ------------------GET MY POSTS------------------
    getMyPosts: async (_, { offset = 0, limit = 10 }, context) => {
      try {
        const user = await requireAuth(context.req);

        const posts = await Post.aggregate([
          { $match: { author: user._id } },
          { $sort: { createdAt: -1 } },
          { $skip: offset },
          { $limit: limit },

          // Populate author
          {
            $lookup: {
              from: "users",
              localField: "author",
              foreignField: "_id",
              as: "author",
            },
          },
          { $unwind: "$author" },

          // Lookup if current user liked each post
          {
            $lookup: {
              from: "likes",
              let: { postId: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$post", "$$postId"] },
                        { $eq: ["$user", user._id] },
                      ],
                    },
                  },
                },
              ],
              as: "likedByUser",
            },
          },

          { $addFields: { isLiked: { $gt: [{ $size: "$likedByUser" }, 0] } } },
          { $project: { likedByUser: 0 } },
        ]);

        return {
          success: true,
          message: "My posts fetched successfully",
          statusCode: 200,
          posts,
        };
      } catch (error) {
        Logger.error("Get my posts error:", error);
        return {
          success: false,
          message: "Failed to fetch your posts",
          statusCode: 500,
          posts: [],
        };
      }
    },

    // ------------------GET USER POSTS------------------
    getUserPosts: async (_, { userId, offset = 0, limit = 10 }, context) => {
      try {
        const currentUser = await requireAuth(context.req);

        // If userId is not provided, default to currentUser
        const targetUserId = userId || currentUser._id;

        const posts = await Post.aggregate([
          {
            $match: { author: new mongoose.Types.ObjectId(targetUserId) },
          },
          { $sort: { createdAt: -1 } },
          { $skip: offset },
          { $limit: limit },

          // Populate author
          {
            $lookup: {
              from: "users",
              localField: "author",
              foreignField: "_id",
              as: "author",
            },
          },
          { $unwind: "$author" },

          // Check if the logged-in user liked this post
          {
            $lookup: {
              from: "likes",
              let: { postId: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$post", "$$postId"] },
                        { $eq: ["$user", currentUser._id] },
                      ],
                    },
                  },
                },
              ],
              as: "likedByUser",
            },
          },

          // Add `isLiked` field
          {
            $addFields: {
              isLiked: { $gt: [{ $size: "$likedByUser" }, 0] },
            },
          },

          // Clean up fields
          {
            $project: {
              likedByUser: 0,
            },
          },
        ]);

        return {
          success: true,
          message: "User posts fetched successfully",
          statusCode: 200,
          posts,
        };
      } catch (error) {
        Logger.error("Get user posts error:", error);
        return {
          success: false,
          message: "Failed to fetch user posts",
          statusCode: 500,
          posts: [],
        };
      }
    },

    // ------------------GET POST BY ID------------------
    getPostById: async (_, { postId }, context) => {
      try {
        const user = await requireAuth(context.req);

        const posts = await Post.aggregate([
          { $match: { _id: new mongoose.Types.ObjectId(postId) } },

          // Populate author
          {
            $lookup: {
              from: "users",
              localField: "author",
              foreignField: "_id",
              as: "author",
            },
          },
          { $unwind: "$author" },

          // Lookup if current user liked
          {
            $lookup: {
              from: "likes",
              let: { postId: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$post", "$$postId"] },
                        { $eq: ["$user", user._id] },
                      ],
                    },
                  },
                },
              ],
              as: "likedByUser",
            },
          },

          { $addFields: { isLiked: { $gt: [{ $size: "$likedByUser" }, 0] } } },
          { $project: { likedByUser: 0 } },
        ]);

        if (!posts.length) {
          return {
            success: false,
            message: "Post not found",
            statusCode: 404,
            post: null,
          };
        }

        return {
          success: true,
          message: "Post fetched successfully",
          statusCode: 200,
          post: posts[0],
        };
      } catch (error) {
        Logger.error("Get post by ID error:", error);
        return {
          success: false,
          message: "Failed to fetch post",
          statusCode: 500,
          post: null,
        };
      }
    },
  },

  Mutation: {
    // ------------------DELETE POST------------------
    deletePost: async (_, { postId }, context) => {
      try {
        const user = await requireAuth(context.req);
        const post = await Post.findById(postId);

        if (!post) {
          return {
            success: false,
            message: "Post not found",
            statusCode: 404,
          };
        }

        if (post.author.toString() !== user._id.toString()) {
          return {
            success: false,
            message: "Unauthorized to delete this post",
            statusCode: 403,
          };
        }

        // Delete media files if exist
        try {
          if (post.media?.length) {
            for (const item of post.media) {
              await deleteFile(item.url);
              if (item.thumbnailUrl) await deleteFile(item.thumbnailUrl);
            }
          }
        } catch (fileError) {
          Logger.warn("Could not delete post files:", fileError);
        }

        await Promise.all([
          Like.deleteMany({ post: postId }),
          Comment.deleteMany({ post: postId }),
          CommentLike.deleteMany({ post: postId }),
          Post.deleteOne({ _id: postId }),
        ]);

        return {
          success: true,
          message: "Post deleted successfully",
          statusCode: 200,
        };
      } catch (error) {
        Logger.error("Delete post error:", error);
        return {
          success: false,
          message: "Failed to delete post",
          statusCode: 500,
        };
      }
    },
  },
};
