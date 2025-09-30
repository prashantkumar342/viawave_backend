import express from "express";
import multer from "multer";
import { createPostControllers } from "../controllers/createPost.controller.js";
import auth from "../middlewares/auth.js";

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 10MB limit per file
  },
  fileFilter: (req, file, cb) => {
    // Accept images and videos
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed!'), false);
    }
  }
});

// ================= Create Post Routes =================
router
  .post('/article', auth, upload.array('files', 10), createPostControllers.createArticlePost)
  .post('/regularPost', auth, upload.array('files', 5), createPostControllers.createMediaPost)

export default router;