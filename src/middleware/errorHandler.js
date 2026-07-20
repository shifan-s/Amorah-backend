import mongoose from 'mongoose';
import multer from 'multer';
import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';

function normalizeError(error) {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return new ApiError(400, `Each image must be ${env.maxImageSizeMb} MB or smaller`);
    }

    if (error.code === 'LIMIT_FILE_COUNT') {
      return new ApiError(400, `A maximum of ${env.maxImagesPerRequest} images may be uploaded at once`);
    }

    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return new ApiError(400, 'Unexpected image field');
    }

    return new ApiError(400, 'Image upload request is invalid');
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return new ApiError(
      400,
      'Validation failed',
      Object.values(error.errors).map((item) => item.message),
    );
  }

  if (error instanceof mongoose.Error.CastError && error.kind === 'ObjectId') {
    return new ApiError(400, 'Invalid MongoDB ObjectId');
  }

  if (error?.code === 11000) {
    return new ApiError(409, 'Duplicate value already exists');
  }

  return new ApiError(500, 'Internal server error');
}

export default function errorHandler(error, req, res, next) {
  const normalizedError = normalizeError(error);
  const response = {
    success: false,
    message: normalizedError.message,
    errors: normalizedError.errors || [],
  };

  res.status(normalizedError.statusCode || 500).json(response);
}
