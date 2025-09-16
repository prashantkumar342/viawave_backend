// Updated postResolver.js - Modified to include isLiked field
import { pubsub } from '../utils/pubsub.js';
import { ArticlePost, ImagePost, VideoPost } from '../models/postModel.js';
import { requireAuth } from '../utils/requireAuth.js';
import { Logger } from '../utils/logger.js';
import { User } from '../models/userModel.js';
import { Like } from '../models/likeModel.js';
import { Comment } from '../models/commentModel.js';
import { CommentLike } from '../models/commentLikeModel.js';
import { deleteFile } from '../middlewares/upload.js';
import path from 'path';
import fs from 'fs';
const postTopic = (postId) => `POST_UPDATED_${String(postId)}`;

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

// Helper function to add isLiked field to a single post
const addIsLikedToPost = async (post, userId) => {
  if (!userId) {
    return {
      ...post,
      isLiked: false,
    };
  }

  const isLiked = await Like.exists({ post: post.id, user: userId });
  return {
    ...post,
    isLiked: !!isLiked,
  };
};

// Helper function to add isLiked field to multiple posts
const addIsLikedToPosts = async (posts, userId) => {
  if (!userId || posts.length === 0) {
    return posts.map(post => ({
      ...post,
      isLiked: false,
    }));
  }

  // Get all post IDs
  const postIds = posts.map(post => post.id);

  // Get all likes for these posts by the current user
  const userLikes = await Like.find({
    post: { $in: postIds },
    user: userId
  }).select('post');

  // Create a Set of liked post IDs for quick lookup
  const likedPostIds = new Set(userLikes.map(like => like.post.toString()));

  // Add isLiked field to each post
  return posts.map(post => ({
    ...post,
    isLiked: likedPostIds.has(post.id),
  }));
};

export const postResolvers = {
  Mutation: {
    // Create a new Article Post
    createArticlePost: async (_, { title, contentFile, caption, tags }, context) => {
      try {
        const user = await requireAuth(context.req);

        if (!title) {
          throw new Error("400: Title is required for an Article post");
        }

        if (!contentFile) {
          throw new Error("400: Either content text or content image is required for an Article post");
        }

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
          content: coverImage,
          caption: caption || "",
          tags: tags || [],
        });

        const populatedArticle = await ArticlePost.findById(article._id)
          .populate('author');

        const postWithCounts = {
          ...populatedArticle.toObject(),
          id: populatedArticle._id.toString(),
          author: {
            ...populatedArticle.author.toObject(),
            id: populatedArticle.author._id.toString(),
          },
          totalLikes: populatedArticle.likesCount || 0,
          totalComments: populatedArticle.commentsCount || 0,
          type: 'ArticlePost',
        };

        // Add isLiked field
        const postWithIsLiked = await addIsLikedToPost(postWithCounts, user._id);

        return {
          success: true,
          message: "Article post created successfully",
          statusCode: 201,
          post: postWithIsLiked,
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

        const postWithCounts = {
          ...populatedImagePost.toObject(),
          id: populatedImagePost._id.toString(),
          author: {
            ...populatedImagePost.author.toObject(),
            id: populatedImagePost.author._id.toString(),
          },
          totalLikes: populatedImagePost.likesCount || 0,
          totalComments: populatedImagePost.commentsCount || 0,
          type: 'ImagePost',
        };

        // Add isLiked field
        const postWithIsLiked = await addIsLikedToPost(postWithCounts, user._id);

        return {
          success: true,
          message: "Image post created successfully",
          statusCode: 201,
          post: postWithIsLiked,
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

        const postWithCounts = {
          ...populatedVideoPost.toObject(),
          id: populatedVideoPost._id.toString(),
          author: {
            ...populatedVideoPost.author.toObject(),
            id: populatedVideoPost.author._id.toString(),
          },
          totalLikes: populatedVideoPost.likesCount || 0,
          totalComments: populatedVideoPost.commentsCount || 0,
          type: 'VideoPost',
        };

        // Add isLiked field
        const postWithIsLiked = await addIsLikedToPost(postWithCounts, user._id);

        return {
          success: true,
          message: "Video post created successfully",
          statusCode: 201,
          post: postWithIsLiked,
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

    toggleLike: async (_, { postId }, context) => {
      try {
        const user = await requireAuth(context.req);

        const existingLike = await Like.findOne({ post: postId, user: user._id });
        const isUnliking = !!existingLike;
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

        // Publish a minimal like update to subscribers of this post
        pubsub.publish(postTopic(post._id), {
          postUpdated: {
            postId: post._id.toString(),
            action: isUnliking ? "UNLIKE" : "LIKE",
            like: { userId: user._id.toString() }, // minimal like payload
            totalLikes: post.likesCount || 0,
            updatedAt: new Date().toISOString()
          }
        });

        const postWithCounts = {
          ...post.toObject(),
          id: post._id.toString(),
          author: {
            ...post.author.toObject(),
            id: post.author._id.toString(),
          },
          totalLikes: post.likesCount || 0,
          totalComments: post.commentsCount || 0,
          type: post.title ? 'ArticlePost' : post.images ? 'ImagePost' : 'VideoPost',
        };

        // Add isLiked field
        const postWithIsLiked = await addIsLikedToPost(postWithCounts, user._id);

        return {
          success: true,
          message,
          statusCode: 200,
          post: postWithIsLiked,
        };
      } catch (error) {
        console.log("Toggle like error:", error);
        return { success: false, message: "Failed to toggle like", statusCode: 500, post: null };
      }
    },

    addComment: async (_, { postId, text, parentCommentId }, context) => {
      try {
        const user = await requireAuth(context.req);

        const createdComment = await Comment.create({
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

        // Publish a concise comment update for this post
        pubsub.publish(postTopic(post._id), {
          postUpdated: {
            postId: post._id.toString(),
            action: "COMMENT_ADDED",
            comment: {
              id: createdComment._id.toString(),
              text: createdComment.text,
              parentCommentId: createdComment.parentComment ? String(createdComment.parentComment) : null,
              user: { id: user._id.toString(), name: user.username || user.name || null },
              createdAt: createdComment.createdAt ? createdComment.createdAt.toISOString() : new Date().toISOString()
            },
            totalComments: post.commentsCount || 0,
            updatedAt: new Date().toISOString()
          }
        });

        const postWithCounts = {
          ...post.toObject(),
          id: post._id.toString(),
          author: {
            ...post.author.toObject(),
            id: post.author._id.toString(),
          },
          totalLikes: post.likesCount || 0,
          totalComments: post.commentsCount || 0,
          type: post.title ? 'ArticlePost' : post.images ? 'ImagePost' : 'VideoPost',
        };

        // Add isLiked field
        const postWithIsLiked = await addIsLikedToPost(postWithCounts, user._id);

        return {
          success: true,
          message: "Comment added",
          statusCode: 201,
          post: postWithIsLiked,
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

        // Publish a concise comment update for this post
        pubsub.publish(postTopic(post._id), {
          postUpdated: {
            postId: post._id.toString(),
            action: "COMMENT_UPDATED",
            comment: {
              id: comment._id.toString(),
              text: comment.text,
              user: { id: user._id.toString(), name: user.username || user.name || null },
              updatedAt: comment.updatedAt ? comment.updatedAt.toISOString() : new Date().toISOString()
            },
            totalComments: post.commentsCount || 0,
            updatedAt: new Date().toISOString()
          }
        });

        const postWithCounts = {
          ...post.toObject(),
          id: post._id.toString(),
          author: {
            ...post.author.toObject(),
            id: post.author._id.toString(),
          },
          totalLikes: post.likesCount || 0,
          totalComments: post.commentsCount || 0,
          type: post.title ? 'ArticlePost' : post.images ? 'ImagePost' : 'VideoPost',
        };

        // Add isLiked field
        const postWithIsLiked = await addIsLikedToPost(postWithCounts, user._id);

        return {
          success: true,
          message: "Comment updated",
          statusCode: 200,
          post: postWithIsLiked,
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

        const postId = comment.post;

        await Comment.deleteOne({ _id: commentId });

        await Promise.all([
          ArticlePost.updateOne({ _id: postId }, { $inc: { commentsCount: -1 } }),
          ImagePost.updateOne({ _id: postId }, { $inc: { commentsCount: -1 } }),
          VideoPost.updateOne({ _id: postId }, { $inc: { commentsCount: -1 } })
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

        // Publish a concise comment deletion update for this post
        pubsub.publish(postTopic(post._id), {
          postUpdated: {
            postId: post._id.toString(),
            action: "COMMENT_DELETED",
            comment: { id: commentId },
            totalComments: post.commentsCount || 0,
            updatedAt: new Date().toISOString()
          }
        });

        const postWithCounts = {
          ...post.toObject(),
          id: post._id.toString(),
          author: {
            ...post.author.toObject(),
            id: post.author._id.toString(),
          },
          totalLikes: post.likesCount || 0,
          totalComments: post.commentsCount || 0,
          type: post.title ? 'ArticlePost' : post.images ? 'ImagePost' : 'VideoPost',
        };

        // Add isLiked field
        const postWithIsLiked = await addIsLikedToPost(postWithCounts, user._id);

        return {
          success: true,
          message: "Comment deleted",
          statusCode: 200,
          post: postWithIsLiked,
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

        // Add isLiked field to all posts
        const postsWithIsLiked = await addIsLikedToPosts(posts, user._id);

        return {
          success: true,
          message: 'Posts fetched successfully',
          statusCode: 200,
          posts: postsWithIsLiked,
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
        const user = await requireAuth(context.req);

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

        const postWithCounts = {
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

        // Add isLiked field
        const postWithIsLiked = await addIsLikedToPost(postWithCounts, user._id);

        return {
          success: true,
          message: 'Post fetched successfully',
          statusCode: 200,
          post: postWithIsLiked,
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

    getUserPosts: async (_, { offset = 0, limit = 10, userId }, context) => {
      try {
        // Get current user for isLiked field (if authenticated)
        let currentUser = null;
        try {
          currentUser = await requireAuth(context.req);
        } catch (error) {
          return {
            success: false,
            message: error,
            statusCode: 404,
            posts: [],
          };
        }

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

        // Add isLiked field to all posts
        const postsWithIsLiked = await addIsLikedToPosts(posts, currentUser?._id);

        return {
          success: true,
          message: 'Posts fetched successfully',
          statusCode: 200,
          posts: postsWithIsLiked,
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

        const [articles, images, videos] = await Promise.all([
          ArticlePost.find({})
            .populate("author")
            .sort({ createdAt: -1 })
            .skip(offset)
            .limit(limit)
            .lean(),
          ImagePost.find({})
            .populate("author")
            .sort({ createdAt: -1 })
            .skip(offset)
            .limit(limit)
            .lean(),
          VideoPost.find({})
            .populate("author")
            .sort({ createdAt: -1 })
            .skip(offset)
            .limit(limit)
            .lean(),
        ]);

        let posts = [...articles, ...images, ...videos]
          .map((obj) => ({
            ...obj,
            id: obj._id.toString(),
            author: obj.author
              ? { ...obj.author, id: obj.author._id.toString() }
              : null,
            likesCount: obj.likesCount ?? 0,
            commentsCount: obj.commentsCount ?? 0,
            totalLikes: obj.likesCount ?? 0,
            totalComments: obj.commentsCount ?? 0,
            type: obj.title
              ? "ArticlePost"
              : obj.images
                ? "ImagePost"
                : "VideoPost",
          }))
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, limit); // final slice after merge

        // Add isLiked field to all posts
        const postsWithIsLiked = await addIsLikedToPosts(posts, currentUser?._id);

        return {
          success: true,
          message: "Home feed fetched successfully",
          statusCode: 200,
          posts: postsWithIsLiked,
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