import { body } from 'express-validator';
import { validateAmorahPublicId } from '../utils/cloudinaryUpload.js';

const uploadTypes = ['product', 'category', 'banner'];

function normalizeFilenamePrefix(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export const uploadImagesValidator = [
  body().custom((value) => {
    const unknownField = Object.keys(value || {}).find((field) => !['uploadType', 'filenamePrefix'].includes(field));

    if (unknownField) {
      throw new Error(`${unknownField} is not allowed`);
    }

    return true;
  }),
  body('uploadType').trim().notEmpty().withMessage('Upload type is required').bail().isIn(uploadTypes).withMessage('Upload type must be product, category or banner'),
  body('filenamePrefix')
    .optional({ values: 'falsy' })
    .customSanitizer(normalizeFilenamePrefix)
    .isLength({ max: 80 })
    .withMessage('Filename prefix must be at most 80 characters')
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Filename prefix may contain letters, numbers and hyphens only'),
];

export const deleteImageValidator = [
  body().custom((value) => {
    const unknownField = Object.keys(value || {}).find((field) => field !== 'publicId');

    if (unknownField) {
      throw new Error(`${unknownField} is not allowed`);
    }

    return true;
  }),
  body('publicId')
    .trim()
    .notEmpty()
    .withMessage('Public ID is required')
    .bail()
    .isLength({ max: 220 })
    .withMessage('Public ID is too long')
    .custom((value) => {
      validateAmorahPublicId(value);
      return true;
    }),
];
