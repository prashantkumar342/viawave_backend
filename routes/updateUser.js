
// Updated route file
// profileUpload.js - Fixed route implementation

import  auth  from "../middlewares/auth.js";
import { uploadSingleFile, handleUploadError, deleteFile } from '../middlewares/upload.js';
import express from "express";
import { Logger } from "../utils/logger.js";

const router = express.Router();

router.post('/profile',
  auth,
  (req, res, next) => {
    req.folderName = 'profiles';
    next();
  },
  uploadSingleFile(),
  handleUploadError,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No profile picture uploaded',
          statusCode: 400,
        });
      }

      // Delete previous profile picture if it exists
      const user = req.user;
      if (user && user.profilePicture) {
        try {
          const deleted = await deleteFile(user.profilePicture);
          if (deleted) {
            Logger.info(`Previous profile picture deleted for user: ${user.username || user.name || user.id}`);
          }
        } catch (deleteError) {
          Logger.warn('Could not delete previous profile picture:', deleteError);
        }
      }

      const filePath = `/uploads/profiles/${req.file.filename}`;

      res.status(200).json({
        success: true,
        message: 'Profile picture uploaded successfully',
        statusCode: 200,
        data: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          path: filePath,
          size: req.file.size,
          mimetype: req.file.mimetype,
        },
      });
    } catch (error) {
      Logger.error('Profile upload error:', error);
      res.status(500).json({
        success: false,
        message: 'Profile picture upload failed',
        statusCode: 500,
      });
    }
  }
);

export default router;