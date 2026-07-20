import { randomUUID } from 'node:crypto';
import path from 'node:path';
import cloudinary from '../config/cloudinary.js';
import { logSafeCloudinaryError, toCloudinaryApiError } from './cloudinaryErrors.js';
import ApiError from './ApiError.js';

const approvedFolders = ['amorah/products', 'amorah/categories', 'amorah/banners'];

function normalizeFolder(folder) {
  return String(folder || '').replace(/^\/+|\/+$/g, '');
}

function isApprovedFolder(folder) {
  const normalizedFolder = normalizeFolder(folder);
  return approvedFolders.map(normalizeFolder).includes(normalizedFolder);
}

function originalNameWithoutExtension(filename = '') {
  return path.basename(filename, path.extname(filename));
}

function sanitizePublicIdPart(value, fallback = 'amorah-image') {
  const safeValue = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return safeValue || fallback;
}

export function buildSafePublicId(filenameHint = '') {
  const hintWithoutExtension = originalNameWithoutExtension(filenameHint);
  const prefix = sanitizePublicIdPart(hintWithoutExtension);
  return `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

export function validateAmorahPublicId(publicId) {
  const normalizedPublicId = String(publicId || '').trim();
  const hasUnsafeCharacters = !/^[a-z0-9][a-z0-9/_-]*[a-z0-9]$/i.test(normalizedPublicId);
  const hasUnsafeSegments =
    normalizedPublicId.includes('..') ||
    normalizedPublicId.includes('//') ||
    normalizedPublicId.includes('\\');

  if (hasUnsafeCharacters || hasUnsafeSegments) {
    throw new ApiError(400, 'Cloudinary public ID is invalid');
  }

  const isAllowed = approvedFolders
    .map((folder) => `${normalizeFolder(folder)}/`)
    .some((folderPrefix) => normalizedPublicId.startsWith(folderPrefix));

  if (!isAllowed) {
    throw new ApiError(400, 'Only Amorah Cloudinary images may be deleted');
  }

  return normalizedPublicId;
}

export function uploadBufferToCloudinary(buffer, folder, filenameHint = '') {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new ApiError(400, 'Image file is empty');
  }

  if (!isApprovedFolder(folder)) {
    throw new ApiError(400, 'Upload folder is not allowed');
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        folder: normalizeFolder(folder),
        public_id: buildSafePublicId(filenameHint),
        use_filename: false,
        unique_filename: true,
        overwrite: false,
        secure: true,
        quality: 'auto:good',
      },
      (error, result) => {
        if (error || !result) {
          reject(error || new ApiError(502, 'Cloudinary upload failed'));
          return;
        }

        resolve(result);
      },
    );

    uploadStream.end(buffer);
  });
}

export async function deleteCloudinaryImage(publicId) {
  const safePublicId = validateAmorahPublicId(publicId);

  try {
    return await cloudinary.uploader.destroy(safePublicId, { resource_type: 'image' });
  } catch (error) {
    logSafeCloudinaryError(error, 'Cloudinary image deletion failed');
    throw toCloudinaryApiError(error);
  }
}
