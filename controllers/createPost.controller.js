// controllers/createPost.controller.js
import { Post } from '../models/postModel.js';
import { generateAndUploadThumbnail } from '../utils/generateThumbnail.js';
import { Logger } from '../utils/logger.js';
import { uploadFile } from '../utils/uploadToS3.js';

export const createPostControllers = {
  // ================= Article post =================
  createArticlePost: async (req, res) => {
    try {
      const { title, caption } = req.body;
      const files = req.files;

      if (!title || !caption) {
        return res
          .status(400)
          .json({ message: 'Title and caption is required', success: false });
      }

      if (!files || files.length === 0) {
        return res.status(400).json({
          message: 'At least one media file is required',
          success: false,
        });
      }

      const folder = 'posts';
      const thumbFolder = 'thumbnails'; // prefix in the same bucket (viawave/thumbnails/...)

      const mediaArray = await Promise.all(
        files.map(async (file) => {
          // 1) upload original file
          const key = await uploadFile(
            file.buffer,
            file.originalname,
            file.mimetype,
            folder
          );

          const isImage = file.mimetype.startsWith('image');
          const isVideo = file.mimetype.startsWith('video');

          let thumbnailKey = '';

          // 2) if video, create thumbnail and upload it
          if (isVideo) {
            try {
              // generateAndUploadThumbnail will generate a thumbnail and upload it to S3
              thumbnailKey = await generateAndUploadThumbnail(file.buffer, {
                thumbFolder,
                origKey: key, // Pass the original key for naming the thumbnail
                time: '00:00:01.000',
                size: '480x?',
              });
            } catch (thumbErr) {
              Logger.error(
                'Thumbnail generation/upload failed for file:',
                file.originalname,
                thumbErr
              );
              // proceed without thumbnail (thumbnailUrl remains '')
              thumbnailKey = '';
            }
          }

          // 3) for images optionally generate smaller thumbnail (commented out)
          // if (isImage) { ... generate smaller resized version ... }

          return {
            url: key, // DB stores key like 'posts/<uuid>.mp4'
            type: isImage ? 'image' : 'video',
            thumbnailUrl: thumbnailKey || '', // save key or empty string
          };
        })
      );

      const newPost = await Post.create({
        author: req.user._id,
        title,
        caption,
        media: mediaArray,
        type: 'Article',
      });

      return res.status(201).json({
        success: true,
        message: 'Article post created successfully',
        post: newPost,
      });
    } catch (error) {
      Logger.error('Error creating article post:', error);
      return res
        .status(500)
        .json({ message: 'Internal server error', success: false });
    }
  },

  // ================= Regular media post =================
  createMediaPost: async (req, res) => {
    try {
      const { caption } = req.body;
      const files = req.files;

      if (!caption) {
        return res
          .status(400)
          .json({ message: 'Caption is required', success: false });
      }

      if (!files || files.length === 0) {
        return res.status(400).json({
          message: 'At least one media file is required',
          success: false,
        });
      }

      if (files.length > 5) {
        return res
          .status(400)
          .json({ message: 'Maximum 5 media files allowed', success: false });
      }

      const folder = 'posts';
      const thumbFolder = 'thumbnails';

      // Upload media files in parallel and create thumbnails for videos
      const mediaArray = await Promise.all(
        files.map(async (file) => {
          const key = await uploadFile(
            file.buffer,
            file.originalname,
            file.mimetype,
            folder
          );

          const isImage = file.mimetype.startsWith('image');
          const isVideo = file.mimetype.startsWith('video');

          let thumbnailKey = '';

          if (isVideo) {
            try {
              // generateAndUploadThumbnail will generate a thumbnail and upload it to S3
              thumbnailKey = await generateAndUploadThumbnail(file.buffer, {
                thumbFolder,
                origKey: key, // Pass the original key for naming the thumbnail
                time: '00:00:01.000',
                size: '480x?',
              });
            } catch (thumbErr) {
              Logger.error(
                'Thumbnail generation/upload failed for file:',
                file.originalname,
                thumbErr
              );
              thumbnailKey = '';
            }
          } else {
            // Optionally create smaller thumbnail for images if you want
            thumbnailKey = '';
          }

          return {
            url: key,
            type: isImage ? 'image' : 'video',
            thumbnailUrl: thumbnailKey || '',
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
        message: 'Media post created successfully',
        post: newPost,
      });
    } catch (error) {
      Logger.error('Error creating media post:', error);
      return res
        .status(500)
        .json({ message: 'Internal server error', success: false });
    }
  },
};
