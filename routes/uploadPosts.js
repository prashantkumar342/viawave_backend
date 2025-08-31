// postUpload.js - New route file for post file uploads

import { auth } from "../middlewares/auth.js";
import { uploadSingleFile, uploadMultipleFiles, handleUploadError } from '../middlewares/upload.js';
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
router.post('/videos',
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
