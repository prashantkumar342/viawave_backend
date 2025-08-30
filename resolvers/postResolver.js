import { ArticlePost, ImagePost, VideoPost } from '../models/postModel.js';
import { requireAuth } from '../utils/requireAuth.js';
import { Logger } from '../utils/logger.js';
import { User } from '../models/userModel.js';
import { Like } from '../models/likeModel.js';
import { Comment } from '../models/commentModel.js';
import { CommentLike } from '../models/commentLikeModel.js';

export const postResolvers = {
  Mutation: {
    // Create a new Article Post
    createArticlePost: async (_, { title, content, contentFile, caption, tags }, context) => {
      try {
        const user = await requireAuth(context.req);
        console.log('createArticlePost input:', { title, content, contentFile, caption, tags });

        if (!title) {
          throw new Error("400: Title is required for an Article post");
        }

        // Validate that either content or contentFile is provided
        if (!content && !contentFile) {
          throw new Error("400: Either content text or content file is required for an Article post");
        }

        let finalContent = content || '';

        // Enhanced file handling with better error handling and validation
        if (contentFile && contentFile.startsWith("data:image/")) {
          try {
            // Extract file data with validation
            const matches = contentFile.match(/^data:([^;]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
              const mimeType = matches[1];
              const base64Data = matches[2];

              // Validate MIME type
              const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
              if (!allowedMimeTypes.includes(mimeType)) {
                return {
                  success: false,
                  message: 'Unsupported file type. Only JPEG, PNG, GIF, and WebP are allowed.',
                  statusCode: 400,
                };
              }

              const buffer = Buffer.from(base64Data, "base64");

              // File size validation
              const maxFileSize = 5 * 1024 * 1024; // 5MB
              if (buffer.length > maxFileSize) {
                return {
                  success: false,
                  message: 'File size too large. Maximum allowed size is 5MB.',
                  statusCode: 400,
                };
              }

              // Generate filename using username and timestamp
              const fileExtension = mimeType.split("/")[1];
              const fileName = `${user.username}_${Date.now()}.${fileExtension}`;

              // Import fs and path for file operations
              const fs = await import("fs");
              const path = await import("path");

              // Ensure directory exists
              const uploadDir = path.default.join(
                process.cwd(),
                "public",
                "uploads",
                "articles"
              );
              if (!fs.default.existsSync(uploadDir)) {
                fs.default.mkdirSync(uploadDir, { recursive: true });
              }

              // Write new file
              const filePath = path.default.join(uploadDir, fileName);
              fs.default.writeFileSync(filePath, buffer);

              // Use uploaded file path as content
              finalContent = `/uploads/articles/${fileName}`;
              console.log('File uploaded successfully:', finalContent);
            } else {
              throw new Error('Invalid file format');
            }
          } catch (fileError) {
            console.error('File upload error:', fileError);
            return {
              success: false,
              message: 'Failed to upload content file',
              statusCode: 500,
            };
          }
        }

        // Create article with proper content handling
        const article = await ArticlePost.create({
          author: user._id,
          title,
          content: finalContent,
          caption: caption || "",
          tags: tags || [],
        });

        // Populate the created article
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
          },
        };

      } catch (error) {
        console.error('Create article error:', error);

        // Handle specific validation errors
        if (error.message.startsWith('400:')) {
          return {
            success: false,
            message: error.message.substring(4), // Remove "400: " prefix
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

    // Create a new Image Post
    createImagePost: async (_, { images, caption, tags }, context) => {
      try {
        const user = await requireAuth(context.req);

        if (!images || images.length === 0) {
          throw new Error("400: At least one image is required for an Image post");
        }

        const imagePost = await ImagePost.create({
          author: user._id,
          images,
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

    // Create a new Video Post
    createVideoPost: async (_, { videoUrl, thumbnailUrl, caption, tags }, context) => {
      try {
        const user = await requireAuth(context.req);

        if (!videoUrl) {
          throw new Error("400: Video URL is required for a Video post");
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

    toggleLike: async (_, { postId }, context) => {
      try {
        const user = await requireAuth(context.req);

        const existingLike = await Like.findOne({ post: postId, user: user._id });

        let message = "";
        if (existingLike) {
          await existingLike.deleteOne();
          // Update all possible post types
          await Promise.all([
            ArticlePost.updateOne({ _id: postId }, { $inc: { likesCount: -1 } }),
            ImagePost.updateOne({ _id: postId }, { $inc: { likesCount: -1 } }),
            VideoPost.updateOne({ _id: postId }, { $inc: { likesCount: -1 } })
          ]);
          message = "Like removed";
        } else {
          await Like.create({ post: postId, user: user._id });
          // Update all possible post types
          await Promise.all([
            ArticlePost.updateOne({ _id: postId }, { $inc: { likesCount: 1 } }),
            ImagePost.updateOne({ _id: postId }, { $inc: { likesCount: 1 } }),
            VideoPost.updateOne({ _id: postId }, { $inc: { likesCount: 1 } })
          ]);
          message = "Post liked";
        }

        // Find the post in any collection
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

        // Update comment count for all possible post types
        await Promise.all([
          ArticlePost.updateOne({ _id: postId }, { $inc: { commentsCount: 1 } }),
          ImagePost.updateOne({ _id: postId }, { $inc: { commentsCount: 1 } }),
          VideoPost.updateOne({ _id: postId }, { $inc: { commentsCount: 1 } })
        ]);

        // Find the post in any collection
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

        // Find the post in any collection
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

        // Update comment count for all possible post types
        await Promise.all([
          ArticlePost.updateOne({ _id: comment.post }, { $inc: { commentsCount: -1 } }),
          ImagePost.updateOne({ _id: comment.post }, { $inc: { commentsCount: -1 } }),
          VideoPost.updateOne({ _id: comment.post }, { $inc: { commentsCount: -1 } })
        ]);

        // Find the post in any collection
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
          },
        };
      } catch (error) {
        Logger.error("Delete comment error:", error);
        return { success: false, message: "Failed to delete comment", statusCode: 500, post: null };
      }
    },

    // Toggle like on a comment
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

        // Fetch all post types by this user
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

        // Merge and sort by createdAt
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
            };
          })
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Apply offset + limit manually since we merged arrays
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

        // Try to find post in each collection
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

        // Fetch all post types by this user
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

        // Merge and sort by createdAt
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
            };
          })
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Apply offset + limit manually since we merged arrays
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
        // Fetch all post types (global feed)
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

        // Merge and normalize
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
            };
          })
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Apply offset + limit
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

        // Get reply counts for each comment
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
          .sort({ createdAt: 1 }) // Replies in chronological order
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