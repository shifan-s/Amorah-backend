import { body, param, query } from 'express-validator';
import mongoose from 'mongoose';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const allowedFields = [
  'categoryType',
  'name',
  'slug',
  'description',
  'parent',
  'image',
  'isFeatured',
  'showOnHomepage',
  'showInNavigation',
  'displayOrder',
  'isActive',
];

function rejectUnknownFields() {
  return body().custom((value) => {
    const incomingFields = Object.keys(value || {});
    const unknownField = incomingFields.find((field) => !allowedFields.includes(field));

    if (unknownField) {
      throw new Error(`${unknownField} is not allowed`);
    }

    return true;
  });
}

function optionalBoolean(field) {
  return body(field)
    .optional({ values: 'undefined' })
    .isBoolean()
    .withMessage(`${field} must be true or false`)
    .toBoolean();
}

function optionalImageUrl() {
  return body('image.url')
    .optional({ values: 'falsy' })
    .trim()
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('Image URL must be a valid HTTP or HTTPS URL');
}

const categoryIdValidator = param('categoryId').custom((value) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new Error('Invalid category ID');
  }

  return true;
});

const categoryBodyValidators = [
  rejectUnknownFields(),
  body('categoryType')
    .optional({ values: 'undefined' })
    .isIn(['main', 'subcategory'])
    .withMessage('Category type must be main or subcategory'),
  body('name')
    .optional({ values: 'undefined' })
    .trim()
    .isLength({ min: 2, max: 80 })
    .withMessage('Name must be between 2 and 80 characters'),
  body('slug')
    .optional({ values: 'falsy' })
    .trim()
    .toLowerCase()
    .matches(slugPattern)
    .withMessage('Slug must be lowercase and URL safe'),
  body('description')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be at most 500 characters'),
  body('parent')
    .optional({ values: 'falsy' })
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage('Parent category must be valid'),
  optionalImageUrl(),
  body('image.publicId').optional({ values: 'falsy' }).trim(),
  body('image.alt')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 120 })
    .withMessage('Image alt text must be at most 120 characters'),
  body('image').custom((image) => {
    if (image?.url && !String(image.alt || '').trim()) {
      throw new Error('Image alt text is required when an image URL is provided');
    }

    return true;
  }),
  optionalBoolean('isFeatured'),
  optionalBoolean('showOnHomepage'),
  optionalBoolean('showInNavigation'),
  optionalBoolean('isActive'),
  body('displayOrder')
    .optional({ values: 'undefined' })
    .isInt({ min: 0 })
    .withMessage('Display order must be an integer of at least 0')
    .toInt(),
];

export const listCategoryValidator = [
  query('search').optional({ values: 'falsy' }).trim().isLength({ max: 80 }),
  query('type').optional({ values: 'falsy' }).isIn(['main', 'subcategory']),
  query('status').optional({ values: 'falsy' }).isIn(['active', 'inactive']),
  query('showOnHomepage').optional({ values: 'falsy' }).isBoolean().toBoolean(),
  query('showOnHome').optional({ values: 'falsy' }).isBoolean().toBoolean(),
  query('showInNavigation').optional({ values: 'falsy' }).isBoolean().toBoolean(),
];

export const createCategoryValidator = [
  ...categoryBodyValidators,
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('categoryType')
    .optional({ values: 'undefined' })
    .custom((value, { req }) => {
      if (value === 'subcategory' && !req.body.parent) {
        throw new Error('Parent category is required for subcategories');
      }

      return true;
    }),
];

export const updateCategoryValidator = [categoryIdValidator, ...categoryBodyValidators];
export const categoryIdOnlyValidator = [categoryIdValidator];
