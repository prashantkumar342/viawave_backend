// postUpload.js - New route file for post file uploads

import { auth } from "../middlewares/auth.js";
import { uploadSingleFile, uploadMultipleFiles, handleUploadError, deleteFile } from '../middlewares/upload.js';
import express from "express";
import { Logger } from "../utils/logger.js";

const router = express.Router();

// Upload images for image posts
router.post('/images',
  auth,
  // Middleware to set folder name for post images
  (req, res, next) => {
    req.folderName = 'posts/images';
    next();
  },
  uploadMultipleFiles(10), // Allow up to 10 images
  handleUploadError,
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No images uploaded',
          statusCode: 400,
        });
      }

      // Create file paths array
      const imagePaths = req.files.map(file => `/uploads/posts/images/${file.filename}`);

      res.status(200).json({
        success: true,
        message: 'Images uploaded successfully',
        statusCode: 200,
        data: {
          images: imagePaths,
          files: req.files.map(file => ({
            filename: file.filename,
            originalName: file.originalname,
            path: `/uploads/posts/images/${file.filename}`,
            size: file.size,
            mimetype: file.mimetype,
          }))
        },
      });
    } catch (error) {
      Logger.error('Post images upload error:', error);
      res.status(500).json({
        success: false,
        message: 'Images upload failed',
        statusCode: 500,
      });
    }
  }
);

// Upload video for video posts
router.post('/video',
  auth,
  // Middleware to set folder name for post videos
  (req, res, next) => {
    req.folderName = 'posts/videos';
    next();
  },
  uploadSingleFile(),
  handleUploadError,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No video uploaded',
          statusCode: 400,
        });
      }

      const videoPath = `/uploads/posts/videos/${req.file.filename}`;

      res.status(200).json({
        success: true,
        message: 'Video uploaded successfully',
        statusCode: 200,
        data: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          videoUrl: videoPath,
          size: req.file.size,
          mimetype: req.file.mimetype,
        },
      });
    } catch (error) {
      Logger.error('Post video upload error:', error);
      res.status(500).json({
        success: false,
        message: 'Video upload failed',
        statusCode: 500,
      });
    }
  }
);

// Upload thumbnail for video posts (optional)
router.post('/thumbnail',
  auth,
  // Middleware to set folder name for thumbnails
  (req, res, next) => {
    req.folderName = 'posts/thumbnails';
    next();
  },
  uploadSingleFile(),
  handleUploadError,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No thumbnail uploaded',
          statusCode: 400,
        });
      }

      const thumbnailPath = `/uploads/posts/thumbnails/${req.file.filename}`;

      res.status(200).json({
        success: true,
        message: 'Thumbnail uploaded successfully',
        statusCode: 200,
        data: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          thumbnailUrl: thumbnailPath,
          size: req.file.size,
          mimetype: req.file.mimetype,
        },
      });
    } catch (error) {
      Logger.error('Post thumbnail upload error:', error);
      res.status(500).json({
        success: false,
        message: 'Thumbnail upload failed',
        statusCode: 500,
      });
    }
  }
);

export default router;

// Updated postResolver.js - Modified to work with file uploads AND base64 content

import { ArticlePost, ImagePost, VideoPost } from '../models/postModel.js';
import { requireAuth } from '../utils/requireAuth.js';
import { Logger } from '../utils/logger.js';
import { User } from '../models/userModel.js';
import { Like } from '../models/likeModel.js';
import { Comment } from '../models/commentModel.js';
import { CommentLike } from '../models/commentLikeModel.js';
import { deleteFile } from '../middlewares/upload.js';
import fs from 'fs';
import path from 'path';

// Helper function to save base64 image as file
const saveBase64AsFile = async (base64Data, username) => {
  try {
    // Extract base64 data and determine file extension
    const matches = base64Data.match(/^data:image\/([a-zA-Z]*);base64,(.+)$/);
    if (!matches) {
      throw new Error('Invalid base64 image format');
    }

    const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const data = matches[2];

    // Create filename with username
    const filename = `${username}_${Date.now()}.${extension}`;

    // Ensure directory exists
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'posts', 'images');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Save file
    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, data, 'base64');

    return `/uploads/posts/images/${filename}`;
  } catch (error) {
    Logger.error('Error saving base64 image:', error);
    throw new Error('Failed to save image');
  }
};

export const postResolvers = {
  Mutation: {
    // Create a new Article Post - Now supports both content text and contentFile (base64)
    createArticlePost: async (_, { title, content, contentFile, caption, tags }, context) => {
      try {
        const user = await requireAuth(context.req);

        if (!title) {
          throw new Error("400: Title is required for an Article post");
        }

        if (!content && !contentFile) {
          throw new Error("400: Either content text or content image is required for an Article post");
        }

        let finalContent = content || "";
        let coverImage = null;

        // Handle contentFile (base64 image)
        if (contentFile) {
          try {
            const username = user.username || user.name || 'user';
            coverImage = await saveBase64AsFile(contentFile, username);
          } catch (imageError) {
            Logger.error('Failed to save content image:', imageError);
            throw new Error("400: Invalid image format");
          }
        }

        const article = await ArticlePost.create({
          author: user._id,
          title,
          content: finalContent,
          coverImage, // Add this field to your ArticlePost model
          caption: caption || "",
          tags: tags || [],
        });

        const populatedArticle = await ArticlePost.findById(article._id)
          .populate('author');

        return {
          success: true,
          message: "Article post created successfully",
          statusCode: 201,
          post: {
            ...populatedArticle.toObject(),
            id: populatedArticle._id.toString(),
            author: {
              ...populatedArticle.author.toObject(),
              id: populatedArticle.author._id.toString(),
            },
            totalLikes: populatedArticle.likesCount || 0,
            totalComments: populatedArticle.commentsCount || 0,
            type: 'ArticlePost',
          },
        };

      } catch (error) {
        console.error('Create article error:', error);

        if (error.message.startsWith('400:')) {
          return {
            success: false,
            message: error.message.substring(4),
            statusCode: 400,
          };
        }

        return {
          success: false,
          message: 'Failed to create article post',
          statusCode: 500,
        };
      }
    },
    try {
      const user = await requireAuth(context.req);

      if(!title) {
        throw new Error("400: Title is required for an Article post");
      }

        if(!content) {
        throw new Error("400: Content is required for an Article post");
      }

        const article = await ArticlePost.create({
        author: user._id,
        title,
        content,
        caption: caption || "",
        tags: tags || [],
      });

      const populatedArticle = await ArticlePost.findById(article._id)
        .populate('author');

      return {
        success: true,
        message: "Article post created successfully",
        statusCode: 201,
        post: {
          ...populatedArticle.toObject(),
          id: populatedArticle._id.toString(),
          author: {
            ...populatedArticle.author.toObject(),
            id: populatedArticle.author._id.toString(),
          },
          totalLikes: populatedArticle.likesCount || 0,
          totalComments: populatedArticle.commentsCount || 0,
          type: 'ArticlePost',
        },
      };

    } catch(error) {
      console.error('Create article error:', error);

      if (error.message.startsWith('400:')) {
        return {
          success: false,
          message: error.message.substring(4),
          statusCode: 400,
        };
      }

      return {
        success: false,
        message: 'Failed to create article post',
        statusCode: 500,
      };
    }
  },

  // Create a new Image Post - Now expects uploaded image paths
  createImagePost: async (_, { images, caption, tags }, context) => {
    try {
      const user = await requireAuth(context.req);

      if (!images || images.length === 0) {
        throw new Error("400: At least one image path is required for an Image post");
      }

      // Validate that all image paths are properly formatted
      const validImagePaths = images.filter(img =>
        img && img.startsWith('/uploads/posts/images/')
      );

      if (validImagePaths.length === 0) {
        throw new Error("400: Invalid image paths. Please upload images first using /upload/posts/images endpoint");
      }

      const imagePost = await ImagePost.create({
        author: user._id,
        images: validImagePaths,
        caption: caption || "",
        tags: tags || [],
      });

      const populatedImagePost = await ImagePost.findById(imagePost._id)
        .populate('author');

      return {
        success: true,
        message: "Image post created successfully",
        statusCode: 201,
        post: {
          ...populatedImagePost.toObject(),
          id: populatedImagePost._id.toString(),
          author: {
            ...populatedImagePost.author.toObject(),
            id: populatedImagePost.author._id.toString(),
          },
          totalLikes: populatedImagePost.likesCount || 0,
          totalComments: populatedImagePost.commentsCount || 0,
          type: 'ImagePost',
        },
      };

    } catch (error) {
      console.error('Create image post error:', error);

      if (error.message.startsWith('400:')) {
        return {
          success: false,
          message: error.message.substring(4),
          statusCode: 400,
        };
      }

      return {
        success: false,
        message: 'Failed to create image post',
        statusCode: 500,
      };
    }
  },

  // Create a new Video Post - Now expects uploaded video path
  createVideoPost: async (_, { videoUrl, thumbnailUrl, caption, tags }, context) => {
    try {
      const user = await requireAuth(context.req);

      if (!videoUrl) {
        throw new Error("400: Video URL is required for a Video post");
      }

      // Validate video path format
      if (!videoUrl.startsWith('/uploads/posts/videos/')) {
        throw new Error("400: Invalid video path. Please upload video first using /upload/posts/video endpoint");
      }

      // Validate thumbnail path if provided
      if (thumbnailUrl && !thumbnailUrl.startsWith('/uploads/posts/thumbnails/')) {
        throw new Error("400: Invalid thumbnail path. Please upload thumbnail using /upload/posts/thumbnail endpoint");
      }

      const videoPost = await VideoPost.create({
        author: user._id,
        videoUrl,
        thumbnailUrl: thumbnailUrl || "",
        caption: caption || "",
        tags: tags || [],
      });

      const populatedVideoPost = await VideoPost.findById(videoPost._id)
        .populate('author');

      return {
        success: true,
        message: "Video post created successfully",
        statusCode: 201,
        post: {
          ...populatedVideoPost.toObject(),
          id: populatedVideoPost._id.toString(),
          author: {
            ...populatedVideoPost.author.toObject(),
            id: populatedVideoPost.author._id.toString(),
          },
          totalLikes: populatedVideoPost.likesCount || 0,
          totalComments: populatedVideoPost.commentsCount || 0,
          type: 'VideoPost',
        },
      };

    } catch (error) {
      console.error('Create video post error:', error);

      if (error.message.startsWith('400:')) {
        return {
          success: false,
          message: error.message.substring(4),
          statusCode: 400,
        };
      }

      return {
        success: false,
        message: 'Failed to create video post',
        statusCode: 500,
      };
    }
  },

  // Delete post and associated files
  deletePost: async (_, { postId }, context) => {
    try {
      const user = await requireAuth(context.req);

      // Find the post in any collection
      let post = await ArticlePost.findById(postId) ||
        await ImagePost.findById(postId) ||
        await VideoPost.findById(postId);

      if (!post) {
        return {
          success: false,
          message: 'Post not found',
          statusCode: 404,
        };
      }

      // Check if user owns the post
      if (post.author.toString() !== user._id.toString()) {
        return {
          success: false,
          message: 'Unauthorized to delete this post',
          statusCode: 403,
        };
      }

      // Delete associated files
      try {
        if (post.images) {
          // Image post - delete all images
          for (const imagePath of post.images) {
            await deleteFile(imagePath);
          }
        } else if (post.videoUrl) {
          // Video post - delete video and thumbnail
          await deleteFile(post.videoUrl);
          if (post.thumbnailUrl) {
            await deleteFile(post.thumbnailUrl);
          }
        }
      } catch (fileError) {
        Logger.warn('Could not delete post files:', fileError);
      }

      // Delete the post from appropriate collection
      if (post.title && post.content) {
        await ArticlePost.deleteOne({ _id: postId });
      } else if (post.images) {
        await ImagePost.deleteOne({ _id: postId });
      } else if (post.videoUrl) {
        await VideoPost.deleteOne({ _id: postId });
      }

      // Delete associated likes and comments
      await Promise.all([
        Like.deleteMany({ post: postId }),
        Comment.deleteMany({ post: postId }),
        CommentLike.deleteMany({ post: postId })
      ]);

      return {
        success: true,
        message: 'Post deleted successfully',
        statusCode: 200,
      };

    } catch (error) {
      Logger.error('Delete post error:', error);
      return {
        success: false,
        message: 'Failed to delete post',
        statusCode: 500,
      };
    }
  },

  // Rest of your existing mutations...
  toggleLike: async (_, { postId }, context) => {
    try {
      const user = await requireAuth(context.req);

      const existingLike = await Like.findOne({ post: postId, user: user._id });

      let message = "";
      if (existingLike) {
        await existingLike.deleteOne();
        await Promise.all([
          ArticlePost.updateOne({ _id: postId }, { $inc: { likesCount: -1 } }),
          ImagePost.updateOne({ _id: postId }, { $inc: { likesCount: -1 } }),
          VideoPost.updateOne({ _id: postId }, { $inc: { likesCount: -1 } })
        ]);
        message = "Like removed";
      } else {
        await Like.create({ post: postId, user: user._id });
        await Promise.all([
          ArticlePost.updateOne({ _id: postId }, { $inc: { likesCount: 1 } }),
          ImagePost.updateOne({ _id: postId }, { $inc: { likesCount: 1 } }),
          VideoPost.updateOne({ _id: postId }, { $inc: { likesCount: 1 } })
        ]);
        message = "Post liked";
      }

      const post = await ArticlePost.findById(postId).populate("author") ||
        await ImagePost.findById(postId).populate("author") ||
        await VideoPost.findById(postId).populate("author");

      if (!post) {
        return {
          success: false,
          message: "Post not found",
          statusCode: 404,
          post: null
        };
      }

      return {
        success: true,
        message,
        statusCode: 200,
        post: {
          ...post.toObject(),
          id: post._id.toString(),
          author: {
            ...post.author.toObject(),
            id: post.author._id.toString(),
          },
          totalLikes: post.likesCount || 0,
          totalComments: post.commentsCount || 0,
          type: post.title ? 'ArticlePost' : post.images ? 'ImagePost' : 'VideoPost',
        },
      };
    } catch (error) {
      Logger.error("Toggle like error:", error);
      return { success: false, message: "Failed to toggle like", statusCode: 500, post: null };
    }
  },

  addComment: async (_, { postId, text, parentCommentId }, context) => {
    try {
      const user = await requireAuth(context.req);

      await Comment.create({
        post: postId,
        user: user._id,
        text,
        parentComment: parentCommentId || null,
      });

      await Promise.all([
        ArticlePost.updateOne({ _id: postId }, { $inc: { commentsCount: 1 } }),
        ImagePost.updateOne({ _id: postId }, { $inc: { commentsCount: 1 } }),
        VideoPost.updateOne({ _id: postId }, { $inc: { commentsCount: 1 } })
      ]);

      const post = await ArticlePost.findById(postId).populate("author") ||
        await ImagePost.findById(postId).populate("author") ||
        await VideoPost.findById(postId).populate("author");

      if (!post) {
        return {
          success: false,
          message: "Post not found",
          statusCode: 404,
          post: null
        };
      }

      return {
        success: true,
        message: "Comment added",
        statusCode: 201,
        post: {
          ...post.toObject(),
          id: post._id.toString(),
          author: {
            ...post.author.toObject(),
            id: post.author._id.toString(),
          },
          totalLikes: post.likesCount || 0,
          totalComments: post.commentsCount || 0,
          type: post.title ? 'ArticlePost' : post.images ? 'ImagePost' : 'VideoPost',
        },
      };
    } catch (error) {
      Logger.error("Add comment error:", error);
      return { success: false, message: "Failed to add comment", statusCode: 500, post: null };
    }
  },

  editComment: async (_, { commentId, text }, context) => {
    try {
      const user = await requireAuth(context.req);

      const comment = await Comment.findOne({ _id: commentId, user: user._id });
      if (!comment) {
        return { success: false, message: "Comment not found or unauthorized", statusCode: 404, post: null };
      }

      comment.text = text;
      await comment.save();

      const post = await ArticlePost.findById(comment.post).populate("author") ||
        await ImagePost.findById(comment.post).populate("author") ||
        await VideoPost.findById(comment.post).populate("author");

      if (!post) {
        return {
          success: false,
          message: "Post not found",
          statusCode: 404,
          post: null
        };
      }

      return {
        success: true,
        message: "Comment updated",
        statusCode: 200,
        post: {
          ...post.toObject(),
          id: post._id.toString(),
          author: {
            ...post.author.toObject(),
            id: post.author._id.toString(),
          },
          totalLikes: post.likesCount || 0,
          totalComments: post.commentsCount || 0,
          type: post.title ? 'ArticlePost' : post.images ? 'ImagePost' : 'VideoPost',
        },
      };
    } catch (error) {
      Logger.error("Edit comment error:", error);
      return { success: false, message: "Failed to edit comment", statusCode: 500, post: null };
    }
  },

  deleteComment: async (_, { commentId }, context) => {
    try {
      const user = await requireAuth(context.req);

      const comment = await Comment.findOne({ _id: commentId, user: user._id });
      if (!comment) {
        return { success: false, message: "Comment not found or unauthorized", statusCode: 404, post: null };
      }

      await Comment.deleteOne({ _id: commentId });

      await Promise.all([
        ArticlePost.updateOne({ _id: comment.post }, { $inc: { commentsCount: -1 } }),
        ImagePost.updateOne({ _id: comment.post }, { $inc: { commentsCount: -1 } }),
        VideoPost.updateOne({ _id: comment.post }, { $inc: { commentsCount: -1 } })
      ]);

      const post = await ArticlePost.findById(comment.post).populate("author") ||
        await ImagePost.findById(comment.post).populate("author") ||
        await VideoPost.findById(comment.post).populate("author");

      if (!post) {
        return {
          success: false,
          message: "Post not found",
          statusCode: 404,
          post: null
        };
      }

      return {
        success: true,
        message: "Comment deleted",
        statusCode: 200,
        post: {
          ...post.toObject(),
          id: post._id.toString(),
          author: {
            ...post.author.toObject(),
            id: post.author._id.toString(),
          },
          totalLikes: post.likesCount || 0,
          totalComments: post.commentsCount || 0,
          type: post.title ? 'ArticlePost' : post.images ? 'ImagePost' : 'VideoPost',
        },
      };
    } catch (error) {
      Logger.error("Delete comment error:", error);
      return { success: false, message: "Failed to delete comment", statusCode: 500, post: null };
    }
  },

  toggleCommentLike: async (_, { commentId }, context) => {
    try {
      const user = await requireAuth(context.req);

      const existingLike = await CommentLike.findOne({ comment: commentId, user: user._id });

      let message = "";
      if (existingLike) {
        await existingLike.deleteOne();
        message = "Comment like removed";
      } else {
        await CommentLike.create({ comment: commentId, user: user._id });
        message = "Comment liked";
      }

      const comment = await Comment.findById(commentId).populate('user');
      if (!comment) {
        return {
          success: false,
          message: "Comment not found",
          statusCode: 404,
        };
      }

      return {
        success: true,
        message,
        statusCode: 200,
      };
    } catch (error) {
      Logger.error("Toggle comment like error:", error);
      return {
        success: false,
        message: "Failed to toggle comment like",
        statusCode: 500
      };
    }
  }
},

  Query: {
    getMyPosts: async (_, { offset = 0, limit = 10 }, context) => {
      try {
  const user = await requireAuth(context.req);

  const [articles, images, videos] = await Promise.all([
    ArticlePost.find({ author: user._id })
      .populate('author')
      .sort({ createdAt: -1 }),
    ImagePost.find({ author: user._id })
      .populate('author')
      .sort({ createdAt: -1 }),
    VideoPost.find({ author: user._id })
      .populate('author')
      .sort({ createdAt: -1 }),
  ]);

  let posts = [...articles, ...images, ...videos]
    .map(post => {
      const obj = post.toObject();
      return {
        ...obj,
        id: post._id.toString(),
        author: obj.author
          ? {
            ...obj.author,
            id: obj.author._id.toString(),
          }
          : null,
        totalLikes: obj.likesCount || 0,
        totalComments: obj.commentsCount || 0,
        type: obj.title ? 'ArticlePost' : obj.images ? 'ImagePost' : 'VideoPost',
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  posts = posts.slice(offset, offset + limit);

  return {
    success: true,
    message: 'Posts fetched successfully',
    statusCode: 200,
    posts,
  };
} catch (error) {
  Logger.error('Get posts error:', error);
  return {
    success: false,
    message: 'Failed to fetch posts',
    statusCode: 500,
    posts: [],
  };
}
    },

getPostById: async (_, { postId }, context) => {
  try {
    await requireAuth(context.req);

    const post = await ArticlePost.findById(postId).populate('author') ||
      await ImagePost.findById(postId).populate('author') ||
      await VideoPost.findById(postId).populate('author');

    if (!post) {
      return {
        success: false,
        message: 'Post not found',
        statusCode: 404,
        post: null,
      };
    }

    const obj = post.toObject();

    return {
      success: true,
      message: 'Post fetched successfully',
      statusCode: 200,
      post: {
        ...obj,
        id: post._id.toString(),
        author: obj.author
          ? {
            ...obj.author,
            id: obj.author._id.toString(),
          }
          : null,
        totalLikes: obj.likesCount || 0,
        totalComments: obj.commentsCount || 0,
        type: obj.title ? 'ArticlePost' : obj.images ? 'ImagePost' : 'VideoPost',
      },
    };

  } catch (error) {
    Logger.error('Get post by ID error:', error);
    return {
      success: false,
      message: 'Failed to fetch post',
      statusCode: 500,
      post: null,
    };
  }
},

  getUserPosts: async (_, { offset = 0, limit = 10, userId }) => {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return {
          success: false,
          message: 'User not found',
          statusCode: 404,
          posts: [],
        };
      }

      const [articles, images, videos] = await Promise.all([
        ArticlePost.find({ author: user._id })
          .populate('author')
          .sort({ createdAt: -1 }),
        ImagePost.find({ author: user._id })
          .populate('author')
          .sort({ createdAt: -1 }),
        VideoPost.find({ author: user._id })
          .populate('author')
          .sort({ createdAt: -1 }),
      ]);

      let posts = [...articles, ...images, ...videos]
        .map(post => {
          const obj = post.toObject();
          return {
            ...obj,
            id: post._id.toString(),
            author: obj.author
              ? {
                ...obj.author,
                id: obj.author._id.toString(),
              }
              : null,
            totalLikes: obj.likesCount || 0,
            totalComments: obj.commentsCount || 0,
            type: obj.title ? 'ArticlePost' : obj.images ? 'ImagePost' : 'VideoPost',
          };
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      posts = posts.slice(offset, offset + limit);

      return {
        success: true,
        message: 'Posts fetched successfully',
        statusCode: 200,
        posts,
      };
    } catch (error) {
      Logger.error('Get user posts error:', error);
      return {
        success: false,
        message: 'Failed to fetch posts',
        statusCode: 500,
        posts: [],
      };
    }
  },

    getHomeFeed: async (_, { offset = 0, limit = 10 }) => {
      try {
        const [articles, images, videos] = await Promise.all([
          ArticlePost.find({})
            .populate('author')
            .sort({ createdAt: -1 }),
          ImagePost.find({})
            .populate('author')
            .sort({ createdAt: -1 }),
          VideoPost.find({})
            .populate('author')
            .sort({ createdAt: -1 }),
        ]);

        let posts = [...articles, ...images, ...videos]
          .map(post => {
            const obj = post.toObject();
            return {
              ...obj,
              id: post._id.toString(),
              author: obj.author
                ? {
                  ...obj.author,
                  id: obj.author._id.toString(),
                }
                : null,
              totalLikes: obj.likesCount || 0,
              totalComments: obj.commentsCount || 0,
              type: obj.title ? 'ArticlePost' : obj.images ? 'ImagePost' : 'VideoPost',
            };
          })
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        posts = posts.slice(offset, offset + limit);

        return {
          success: true,
          message: 'Home feed fetched successfully',
          statusCode: 200,
          posts,
        };
      } catch (error) {
        Logger.error('Get home feed error:', error);
        return {
          success: false,
          message: 'Failed to fetch home feed',
          statusCode: 500,
          posts: [],
        };
      }
    },

      getPostComments: async (_, { postId, offset = 0, limit = 10 }) => {
        try {
          const comments = await Comment.find({ post: postId, parentComment: null })
            .populate('user')
            .sort({ createdAt: -1 })
            .skip(offset)
            .limit(limit);

          const commentsWithReplies = await Promise.all(
            comments.map(async (comment) => {
              const replyCount = await Comment.countDocuments({ parentComment: comment._id });
              const likeCount = await CommentLike.countDocuments({ comment: comment._id });

              return {
                ...comment.toObject(),
                id: comment._id.toString(),
                user: {
                  ...comment.user.toObject(),
                  id: comment.user._id.toString(),
                },
                replyCount,
                likeCount,
              };
            })
          );

          return {
            success: true,
            message: 'Comments fetched successfully',
            statusCode: 200,
            comments: commentsWithReplies,
          };
        } catch (error) {
          Logger.error('Get post comments error:', error);
          return {
            success: false,
            message: 'Failed to fetch comments',
            statusCode: 500,
            comments: [],
          };
        }
      },

        getCommentReplies: async (_, { commentId, offset = 0, limit = 10 }) => {
          try {
            const replies = await Comment.find({ parentComment: commentId })
              .populate('user')
              .sort({ createdAt: 1 })
              .skip(offset)
              .limit(limit);

            const repliesWithLikes = await Promise.all(
              replies.map(async (reply) => {
                const likeCount = await CommentLike.countDocuments({ comment: reply._id });

                return {
                  ...reply.toObject(),
                  id: reply._id.toString(),
                  user: {
                    ...reply.user.toObject(),
                    id: reply.user._id.toString(),
                  },
                  likeCount,
                };
              })
            );

            return {
              success: true,
              message: 'Replies fetched successfully',
              statusCode: 200,
              comments: repliesWithLikes,
            };
          } catch (error) {
            Logger.error('Get comment replies error:', error);
            return {
              success: false,
              message: 'Failed to fetch replies',
              statusCode: 500,
              comments: [],
            };
          }
        }
  }
};

// Updated postSchema.js - Add deletePost mutation and file upload support

import { gql } from 'apollo-server-express';
import { postResolvers } from '../resolvers/postResolver.js'

export const userPostTypeDefs = gql`
  union Post = ArticlePost | ImagePost | VideoPost

  type ArticlePost {
    id: ID!
    author: User!
    caption: String
    tags: [String!]!
    title: String!
    content: String!
    createdAt: String!
    updatedAt: String!
    likesCount: Int!
    commentsCount: Int!
    totalLikes: Int!
    totalComments: Int!
    type: String!
  }

  type ImagePost {
    id: ID!
    author: User!
    caption: String
    tags: [String!]!
    images: [String!]!
    createdAt: String!
    updatedAt: String!
    likesCount: Int!
    commentsCount: Int!
    totalLikes: Int!
    totalComments: Int!
    type: String!
  }

  type VideoPost {
    id: ID!
    author: User!
    caption: String
    tags: [String!]!
    videoUrl: String!
    thumbnailUrl: String
    createdAt: String!
    updatedAt: String!
    likesCount: Int!
    commentsCount: Int!
    totalLikes: Int!
    totalComments: Int!
    type: String!
  }

  type Comment {
    id: ID!
    user: User!
    text: String!
    createdAt: String!
    updatedAt: String!
    parentComment: ID
    replyCount: Int
    likeCount: Int
  }

  type File {
    filename: String!
    mimetype: String!
    encoding: String!
    url: String!
  }

  type PostResponse {
    success: Boolean!
    message: String!
    statusCode: Int!
    post: Post
  }

  type PostsResponse {
    success: Boolean!
    message: String!
    statusCode: Int!
    posts: [Post!]!
  }

  type CommentsResponse {
    success: Boolean!
    message: String!
    statusCode: Int!
    comments: [Comment!]!
  }

  type CommentResponse {
    success: Boolean!
    message: String!
    statusCode: Int!
    comment: Comment
  }

  type DeleteResponse {
    success: Boolean!
    message: String!
    statusCode: Int!
  }

  extend type Query {
    getMyPosts(limit: Int, offset: Int): PostsResponse!
    getPostById(postId: ID!): PostResponse!
    getUserPosts(userId: ID!, limit: Int, offset: Int): PostsResponse!
    getHomeFeed(limit: Int, offset: Int): PostsResponse!
    getPostComments(postId: ID!, limit: Int, offset: Int): CommentsResponse!
    getCommentReplies(commentId: ID!, limit: Int, offset: Int): CommentsResponse!
  }

  extend type Mutation {
    createArticlePost(
      title: String!
      content: String!
      caption: String
      tags: [String]
    ): PostResponse!

    createImagePost(
      images: [String!]!        # Array of uploaded image paths
      caption: String
      tags: [String]
    ): PostResponse!

    createVideoPost(
      videoUrl: String!         # Uploaded video path
      thumbnailUrl: String      # Optional uploaded thumbnail path
      caption: String
      tags: [String]
    ): PostResponse!

    deletePost(postId: ID!): DeleteResponse!

    toggleLike(postId: ID!): PostResponse!
    
    addComment(postId: ID!, text: String!, parentCommentId: ID): PostResponse!
    editComment(commentId: ID!, text: String!): PostResponse!
    deleteComment(commentId: ID!): PostResponse!
    
    toggleCommentLike(commentId: ID!): CommentResponse!
  }
`;

export const userPostResolvers = {
  Query: {
    getMyPosts: postResolvers.Query.getMyPosts,
    getPostById: postResolvers.Query.getPostById,
    getUserPosts: postResolvers.Query.getUserPosts,
    getHomeFeed: postResolvers.Query.getHomeFeed,
    getPostComments: postResolvers.Query.getPostComments,
    getCommentReplies: postResolvers.Query.getCommentReplies,
  },
  Mutation: {
    createArticlePost: postResolvers.Mutation.createArticlePost,
    createImagePost: postResolvers.Mutation.createImagePost,
    createVideoPost: postResolvers.Mutation.createVideoPost,
    deletePost: postResolvers.Mutation.deletePost,
    toggleLike: postResolvers.Mutation.toggleLike,
    addComment: postResolvers.Mutation.addComment,
    editComment: postResolvers.Mutation.editComment,
    deleteComment: postResolvers.Mutation.deleteComment,
    toggleCommentLike: postResolvers.Mutation.toggleCommentLike,
  },
  Post: {
    __resolveType(obj) {
      if (obj.title && obj.content) return 'ArticlePost';
      if (obj.images) return 'ImagePost';
      if (obj.videoUrl) return 'VideoPost';
      return null;
    },
  },
};

// Usage Instructions and Workflow:

/*
WORKFLOW FOR CREATING POSTS WITH FILE UPLOADS:

1. For Image Posts:
   - First upload images: POST /upload/posts/images (with files in FormData)
   - Get image paths from response
   - Then create post: GraphQL mutation createImagePost with image paths

2. For Video Posts:
   - First upload video: POST /upload/posts/video (with file in FormData)
   - Optionally upload thumbnail: POST /upload/posts/thumbnail
   - Get paths from responses
   - Then create post: GraphQL mutation createVideoPost with video/thumbnail paths

3. For Article Posts:
   - No file upload needed, create directly with GraphQL mutation

EXAMPLE FRONTEND WORKFLOW:

// 1. Upload images
const formData = new FormData();
formData.append('files', imageFile1);
formData.append('files', imageFile2);

const uploadResponse = await fetch('/upload/posts/images', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData
});

const { data: { images } } = await uploadResponse.json();

// 2. Create image post with uploaded paths
const CREATE_IMAGE_POST = gql`
  mutation CreateImagePost($images: [String!]!, $caption: String, $tags: [String]) {
    createImagePost(images: $images, caption: $caption, tags: $tags) {
      success
      message
      statusCode
      post {
        id
        images
        caption
        author {
          id
          username
        }
      }
    }
  }
`;

const result = await apolloClient.mutate({
  mutation: CREATE_IMAGE_POST,
  variables: {
    images: images, // Use paths from upload response
    caption: "My new post",
    tags: ["nature", "photography"]
  }
});

FOLDER STRUCTURE:
public/
  uploads/
    profiles/           # Profile pictures
    posts/
      images/          # Post images
      videos/          # Post videos  
      thumbnails/      # Video thumbnails

FILE NAMING:
All files will be named: {username}_{timestamp}.{extension}
Example: john_doe_1693123456789.jpg
*/