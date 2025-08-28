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
    const folderName = req.body.folderName || 'default';
    const folderPath = path.join(uploadsDir, folderName);

    // Create folder if it doesn't exist
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    cb(null, folderPath);
  },
  filename: (req, file, cb) => {
    // Use username if provided, otherwise use original filename
    const username = req.body.username || 'user';
    const fileExtension = path.extname(file.originalname);
    const fileName = `${username}_${Date.now()}${fileExtension}`;
    cb(null, fileName);
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  // Allow only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Middleware for single file upload
export const uploadSingle = upload.single('file');

// Middleware for multiple files upload
export const uploadMultiple = upload.array('files', 5);

// Error handling middleware
export const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 5MB.',
        statusCode: 400,
      });
    }
    return res.status(400).json({
      success: false,
      message: error.message,
      statusCode: 400,
    });
  }

  if (error.message === 'Only image files are allowed!') {
    return res.status(400).json({
      success: false,
      message: error.message,
      statusCode: 400,
    });
  }

  next(error);
};

// Helper function to get file path
export const getFilePath = (filename, folderName = 'default') => {
  return `/uploads/${folderName}/${filename}`;
};

// Helper function to get full server path
export const getFullPath = (filename, folderName = 'default') => {
  return path.join(process.cwd(), 'public', 'uploads', folderName, filename);
};
