import { ArticlePost, ImagePost, VideoPost } from '../models/postModel.js';
import { requireAuth } from '../utils/requireAuth.js';
import { Logger } from '../utils/logger.js';

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

        let uploadedFilePath = null;

        // Enhanced file handling with better error handling and validation
        if (contentFile && contentFile.startsWith("data:image/")) {
          try {
            // Extract file data with validation
            const matches = contentFile.match(/^data:([^;]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
              const mimeType = matches[1];
              const base64Data = matches[2];

              // Validate MIME type (optional but recommended)
              const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
              if (!allowedMimeTypes.includes(mimeType)) {
                return {
                  success: false,
                  message: 'Unsupported file type. Only JPEG, PNG, GIF, and WebP are allowed.',
                  statusCode: 400,
                };
              }

              const buffer = Buffer.from(base64Data, "base64");

              // Optional: Add file size validation
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

              // Set the uploaded file path
              uploadedFilePath = `/uploads/articles/${fileName}`;
              console.log('File uploaded successfully:', uploadedFilePath);
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
          content: uploadedFilePath || content || '',  // Priority: uploaded file > content string > empty
          caption: caption || "",
          tags: tags || [],
          likes: [],
          comments: [],
        });

        return {
          success: true,
          message: "Article post created successfully",
          statusCode: 201,
          post: {
            ...article.toObject(),
            id: article._id.toString(),
            author: {
              ...user.toObject(),
              id: user._id.toString(),
            }
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
            .populate('likes')
            .populate('comments.user')
            .sort({ createdAt: -1 }),
          ImagePost.find({ author: user._id })
            .populate('author')
            .populate('likes')
            .populate('comments.user')
            .sort({ createdAt: -1 }),
          VideoPost.find({ author: user._id })
            .populate('author')
            .populate('likes')
            .populate('comments.user')
            .sort({ createdAt: -1 }),
        ]);

        // Merge and sort by createdAt
        let posts = [...articles, ...images, ...videos]
          .map(post => {
            const obj = post.toObject();
            return {
              ...obj,
              id: post._id.toString(),
              totalLikes: obj.likes ? obj.likes.length : 0,
              totalComments: obj.comments ? obj.comments.length : 0,
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
        const user = await requireAuth(context.req);

        // Try to find post in each collection
        const post =
          (await ArticlePost.findById(postId)
            .populate('author')
            .populate('likes')
            .populate('comments.user')) ||
          (await ImagePost.findById(postId)
            .populate('author')
            .populate('likes')
            .populate('comments.user')) ||
          (await VideoPost.findById(postId)
            .populate('author')
            .populate('likes')
            .populate('comments.user'));

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
            totalLikes: obj.likes ? obj.likes.length : 0,
            totalComments: obj.comments ? obj.comments.length : 0,
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


  }
};