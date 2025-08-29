import { ArticlePost } from '../models/postModel.js';
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
};