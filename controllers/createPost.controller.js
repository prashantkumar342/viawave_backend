import { Post } from "../models/postModel.js";
import { Logger } from "../utils/logger.js";
import { uploadFile } from "../utils/uploadToS3.js";

export const createPostControllers = {
  // ================= Article post =================
  createArticlePost: async (req, res) => {
    try {
      const { title, caption } = req.body;
      const files = req.files;

      if (!title || !caption) {
        return res.status(400).json({ message: "Title and caption is required", success: false });
      }

      const folder = "posts";

      const mediaArray = await Promise.all(
        files.map(async (file) => {
          const key = await uploadFile(file.buffer, file.originalname, file.mimetype, folder);
          return {
            url: key,
            type: file.mimetype.startsWith("image") ? "image" : "video",
            ...(file.mimetype.startsWith("video") && { thumbnailUrl: "" }),
          };
        })
      );

      const newPost = await Post.create({
        author: req.user._id,
        title,
        caption,
        media: mediaArray,
        type: "Article",
      });

      return res.status(201).json({
        success: true,
        message: "Article post created successfully",
        post: newPost,
      });
    } catch (error) {
      Logger.error("Error creating article post:", error);
      return res.status(500).json({ message: "Internal server error", success: false });
    }
  },

  // ================= Regular media post =================
  createMediaPost: async (req, res) => {
    try {
      const { caption } = req.body;
      const files = req.files;

      if (!files || !caption) {
        return res.status(400).json({ message: "caption is required", success: false });
      }

      const folder = "posts";

      // Upload media files in parallel
      const mediaArray = await Promise.all(
        files.map(async (file) => {
          const key = await uploadFile(file.buffer, file.originalname, file.mimetype, folder);
          return {
            url: key,
            type: file.mimetype.startsWith("image") ? "image" : "video",
            ...(file.mimetype.startsWith("video") && { thumbnailUrl: "" }),
          };
        })
      );

      // Create regular Post
      const newPost = await Post.create({
        author: req.user._id,
        caption,
        media: mediaArray,
      });

      return res.status(201).json({
        success: true,
        message: "Media post created successfully",
        post: newPost,
      });
    } catch (error) {
      Logger.error("Error creating media post:", error);
      return res.status(500).json({ message: "Internal server error", success: false });
    }
  },
};
