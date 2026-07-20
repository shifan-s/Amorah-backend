import path from 'node:path';
import multer from 'multer';
import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const allowedExtensions = new Set(['.jpeg', '.jpg', '.png', '.webp']);

function validateImageFile(req, file, callback) {
  const extension = path.extname(file.originalname || '').toLowerCase();

  if (!allowedMimeTypes.has(file.mimetype) || !allowedExtensions.has(extension)) {
    callback(new ApiError(400, 'Only JPEG, PNG and WebP images are supported'));
    return;
  }

  callback(null, true);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.maxImageSizeMb * 1024 * 1024,
    files: env.maxImagesPerRequest,
  },
  fileFilter: validateImageFile,
});

function ensureFilesPresent(req, res, next) {
  const files = req.file ? [req.file] : req.files || [];

  if (!files.length) {
    next(new ApiError(400, 'At least one image is required'));
    return;
  }

  if (files.some((file) => !file.buffer || file.size <= 0)) {
    next(new ApiError(400, 'Empty image files are not supported'));
    return;
  }

  next();
}

export const singleImageUpload = [upload.single('image'), ensureFilesPresent];
export const multipleImagesUpload = [upload.array('images', env.maxImagesPerRequest), ensureFilesPresent];
export { allowedExtensions, allowedMimeTypes };
