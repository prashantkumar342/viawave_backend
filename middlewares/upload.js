// upload.js - Fixed version with proper folder handling and username extraction

import fs from 'fs';
import multer from 'multer';
import path from 'path';

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Get folderName from the route middleware or default to 'default'
    const folderName = req.folderName || req.body.folderName || 'default';
    const folderPath = path.join(uploadsDir, folderName);

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    cb(null, folderPath);
  },
  filename: (req, file, cb) => {
    // Extract username from authenticated user or fallback to body or default
    const username = req.user?.username || req.user?.name || req.body.username || 'user';
    const fileExtension = path.extname(file.originalname);
    const fileName = `${username}_${Date.now()}${fileExtension}`;
    cb(null, fileName);
  },
});

// File filter for validation
const fileFilter = (req, file, cb) => {
  const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const videoTypes = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo'];

  if (imageTypes.includes(file.mimetype) || videoTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type. Only images (JPEG, PNG, GIF, WebP) and videos (MP4, MPEG, MOV, AVI) are allowed.'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for videos
  },
});

// Single file upload function with folder support
export const uploadSingleFile = () => {
  return upload.single('file');
};

// Multiple files upload function  
export const uploadMultipleFiles = (maxCount = 5) => {
  return upload.array('files', maxCount);
};

// Unified error handling function
export const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    let message = 'Upload error';
    if (error.code === 'LIMIT_FILE_SIZE') {
      message = 'File size too large. Maximum allowed size is 50MB.';
    } else if (error.code === 'LIMIT_FILE_COUNT') {
      message = 'Too many files. Maximum allowed is 5 files.';
    } else if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Unexpected file field.';
    }

    return res.status(400).json({
      success: false,
      message,
      statusCode: 400,
    });
  }

  if (error.message.includes('Unsupported file type')) {
    return res.status(400).json({
      success: false,
      message: error.message,
      statusCode: 400,
    });
  }

  return res.status(500).json({
    success: false,
    message: 'Internal server error during upload',
    statusCode: 500,
  });
};

// Helper function to delete files
export const deleteFile = async (filePath) => {
  try {
    if (filePath && filePath.startsWith('/uploads/')) {
      const fullPath = path.join(process.cwd(), 'public', filePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        return true;
      }
    }
    return false;
  } catch (error) {
    console.warn('Failed to delete file:', error);
    return false;
  }
};
