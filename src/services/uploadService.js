import env from '../config/env.js';
import { isCloudinaryConfigured } from '../config/cloudinary.js';
import ApiError from '../utils/ApiError.js';
import { logSafeCloudinaryError, toCloudinaryApiError } from '../utils/cloudinaryErrors.js';
import {
  deleteCloudinaryImage,
  uploadBufferToCloudinary,
  validateAmorahPublicId,
} from '../utils/cloudinaryUpload.js';

const uploadTypeFolders = {
  product: env.cloudinaryProductFolder,
  category: env.cloudinaryCategoryFolder,
  banner: env.cloudinaryBannerFolder,
};

function ensureCloudinaryReady() {
  if (!isCloudinaryConfigured()) {
    throw new ApiError(503, 'Cloudinary uploads are not configured');
  }
}

function getUploadFolder(uploadType) {
  const folder = uploadTypeFolders[uploadType];

  if (!folder) {
    throw new ApiError(400, 'Upload type must be product, category or banner');
  }

  return folder;
}

function safeDisplayFilename(originalname = '') {
  return String(originalname)
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    .replace(/[^\w.\- ]+/g, '')
    .trim()
    .slice(0, 120);
}

function toUploadResponse(result, originalFilename) {
  return {
    url: result.secure_url,
    secureUrl: result.secure_url,
    publicId: result.public_id,
    width: result.width,
    height: result.height,
    format: result.format,
    bytes: result.bytes,
    originalFilename,
  };
}

export async function uploadImages(files = [], uploadType, filenamePrefix = '') {
  ensureCloudinaryReady();

  if (!Array.isArray(files) || !files.length) {
    throw new ApiError(400, 'At least one image is required');
  }

  if (files.length > env.maxImagesPerRequest) {
    throw new ApiError(400, `A maximum of ${env.maxImagesPerRequest} images may be uploaded at once`);
  }

  const folder = getUploadFolder(uploadType);
  const uploadedImages = [];

  try {
    for (const file of files) {
      const originalFilename = safeDisplayFilename(file.originalname);
      const filenameHint = filenamePrefix || originalFilename;
      const result = await uploadBufferToCloudinary(file.buffer, folder, filenameHint);
      uploadedImages.push(toUploadResponse(result, originalFilename));
    }
  } catch (error) {
    await Promise.allSettled(uploadedImages.map((image) => deleteCloudinaryImage(image.publicId)));
    if (error instanceof ApiError) {
      throw error;
    }

    logSafeCloudinaryError(error, 'Cloudinary image upload failed');
    throw toCloudinaryApiError(error);
  }

  return uploadedImages;
}

export async function deleteImage(publicId) {
  ensureCloudinaryReady();
  const safePublicId = validateAmorahPublicId(publicId);
  await deleteCloudinaryImage(safePublicId);

  return {
    publicId: safePublicId,
  };
}

export { getUploadFolder, uploadTypeFolders };
