// src/controllers/createPost.controller.js
import { Post } from '../models/postModel.js';
import { cleanupUploadedFiles } from '../utils/deleteFromS3.js';
import { generateAndUploadThumbnail } from '../utils/generateThumbnail.js';
import { Logger } from '../utils/logger.js';
import { optimizeVideoBuffer } from '../utils/optimizeVideo.js';
import { uploadFile } from '../utils/uploadToS3.js';

/**
 * Controller responsible for creating posts with media uploads.
 * - Uploads original files (images/videos)
 * - Optionally optimizes videos for streaming (moov atom)
 * - Generates and uploads thumbnails for videos
 * - If any upload/processing step fails, all uploaded objects for this request
 *   are rolled back (deleted) so no orphan objects remain in S3/MinIO.
 */
export const createPostControllers = {
  // ================= Article post =================
  createArticlePost: async (req, res) => {
    // keep list of uploaded keys so we can roll them back on error
    const uploadedKeys = [];

    try {
      const { title, caption } = req.body;
      const files = req.files;

      if (!title || !caption) {
        return res
          .status(400)
          .json({ message: 'Title and caption is required', success: false });
      }

      if (!files || files.length === 0) {
        return res
          .status(400)
          .json({
            message: 'At least one media file is required',
            success: false,
          });
      }

      const folder = 'posts';
      const thumbFolder = 'thumbnails';

      const mediaArray = await Promise.all(
        files.map(async (file) => {
          // track keys related to this file (original + thumbnail)
          const thisFileUploadedKeys = [];

          // buffer that may be replaced by optimized video buffer
          let fileBufferToUpload = file.buffer;
          const isVideo = file.mimetype.startsWith('video');
          const isImage = file.mimetype.startsWith('image');

          // Optimize video for streaming: place moov atom at start (fast start)
          if (isVideo) {
            try {
              fileBufferToUpload = await optimizeVideoBuffer(file.buffer);
            } catch (optErr) {
              Logger.error(
                `Video optimization failed for ${file.originalname}, uploading original.`,
                optErr
              );
              // proceed with original buffer
              fileBufferToUpload = file.buffer;
            }
          }

          // Upload original media file
          const key = await uploadFile(
            fileBufferToUpload,
            file.originalname,
            file.mimetype,
            folder
          );
          // uploadFile returns the object KEY (e.g. 'posts/<uuid>.mp4')
          uploadedKeys.push(key);
          thisFileUploadedKeys.push(key);

          // Generate & upload thumbnail for videos
          let thumbnailKey = '';
          if (isVideo) {
            try {
              thumbnailKey = await generateAndUploadThumbnail(file.buffer, {
                thumbFolder,
                origKey: key,
                time: '00:00:01.000',
                size: '480x?',
              });

              if (thumbnailKey) {
                uploadedKeys.push(thumbnailKey);
                thisFileUploadedKeys.push(thumbnailKey);
              }
            } catch (thumbErr) {
              // Log and continue: thumbnail fail should not block post creation
              Logger.error(
                'Thumbnail generation/upload failed for file:',
                file.originalname,
                thumbErr
              );
              thumbnailKey = '';
            }
          }

          return {
            url: key,
            type: isImage ? 'image' : 'video',
            thumbnailUrl: thumbnailKey || '',
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

      return res
        .status(201)
        .json({
          success: true,
          message: 'Article post created successfully',
          post: newPost,
        });
    } catch (error) {
      Logger.error('Error creating article post:', error);

      // Attempt rollback of any uploaded objects for this request
      try {
        await cleanupUploadedFiles(uploadedKeys);
      } catch (cleanupErr) {
        Logger.error('Rollback failed:', cleanupErr);
      }

      return res
        .status(500)
        .json({ message: 'Internal server error', success: false });
    }
  },

  // ================= Regular media post =================
  createMediaPost: async (req, res) => {
    const uploadedKeys = [];

    try {
      const { caption } = req.body;
      const files = req.files;

      if (!caption) {
        return res
          .status(400)
          .json({ message: 'Caption is required', success: false });
      }

      if (!files || files.length === 0) {
        return res
          .status(400)
          .json({
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

      const mediaArray = await Promise.all(
        files.map(async (file) => {
          let fileBufferToUpload = file.buffer;
          const isVideo = file.mimetype.startsWith('video');
          const isImage = file.mimetype.startsWith('image');

          // Video optimization (moov atom position)
          if (isVideo) {
            try {
              fileBufferToUpload = await optimizeVideoBuffer(file.buffer);
            } catch (optErr) {
              Logger.error(
                `Video optimization failed for ${file.originalname}, uploading original.`,
                optErr
              );
              fileBufferToUpload = file.buffer;
            }
          }

          // Upload the (possibly optimized) file
          const key = await uploadFile(
            fileBufferToUpload,
            file.originalname,
            file.mimetype,
            folder
          );
          uploadedKeys.push(key);

          // Generate thumbnail for videos
          let thumbnailKey = '';
          if (isVideo) {
            try {
              thumbnailKey = await generateAndUploadThumbnail(file.buffer, {
                thumbFolder,
                origKey: key,
                time: '00:00:01.000',
                size: '480x?',
              });

              if (thumbnailKey) uploadedKeys.push(thumbnailKey);
            } catch (thumbErr) {
              Logger.error(
                'Thumbnail generation/upload failed for file:',
                file.originalname,
                thumbErr
              );
              thumbnailKey = '';
            }
          }

          return {
            url: key,
            type: isImage ? 'image' : 'video',
            thumbnailUrl: thumbnailKey || '',
          };
        })
      );

      const newPost = await Post.create({
        author: req.user._id,
        caption,
        media: mediaArray,
      });

      return res
        .status(201)
        .json({
          success: true,
          message: 'Media post created successfully',
          post: newPost,
        });
    } catch (error) {
      Logger.error('Error creating media post:', error);

      // Attempt rollback of uploaded files
      try {
        await cleanupUploadedFiles(uploadedKeys);
      } catch (cleanupErr) {
        Logger.error('Rollback failed:', cleanupErr);
      }

      return res
        .status(500)
        .json({ message: 'Internal server error', success: false });
    }
  },
};
