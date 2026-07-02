import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import { createError } from '../utils/errors';

// Disk storage destination dynamically mapped to root uploads/{userId} directory
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = req.user?.userId || 'anonymous';
    const uploadDir = path.join(process.cwd(), `uploads/${userId}`);
    
    // Ensure nested uploads directory exists
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const fileExt = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${fileExt}`);
  },
});

// Enforce mimetype restrictions for image formats only
const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(
      createError(
        'Invalid file type. Only image/jpeg, image/png, and image/webp are allowed.',
        'INVALID_FILE_TYPE',
        400
      ),
      false
    );
  }
  cb(null, true);
};

// Initiate internal Multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file limit
  },
});

/**
 * Middleware handling up to 5 image uploads and catching raw Multer errors to format as 400 Bad Requests.
 */
export const uploadImages = (req: Request, res: Response, next: NextFunction) => {
  const uploadArray = upload.array('images', 5);
  
  uploadArray(req, res, (error: any) => {
    if (error) {
      if (error instanceof multer.MulterError) {
        let message = error.message;
        let code = 'UPLOAD_ERROR';
        
        if (error.code === 'LIMIT_FILE_SIZE') {
          message = 'File size exceeds maximum limit of 5MB per image.';
          code = 'LIMIT_FILE_SIZE';
        } else if (error.code === 'LIMIT_UNEXPECTED_FILE') {
          message = 'Maximum of 5 images are allowed per upload request.';
          code = 'LIMIT_UNEXPECTED_FILE';
        }
        
        return next(createError(message, code, 400));
      }
      return next(error);
    }
    next();
  });
};
