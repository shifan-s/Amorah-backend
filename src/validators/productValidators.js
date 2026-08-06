import { body, param, query } from 'express-validator';
import mongoose from 'mongoose';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const hexPattern = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const allowedProductFields = [
  'name',
  'slug',
  'skuPrefix',
  'mainCategory',
  'subcategory',
  'productType',
  'style',
  'fabric',
  'occasion',
  'tags',
  'shortDescription',
  'description',
  'regularPrice',
  'salePrice',
  'variants',
  'fabricDetails',
  'fit',
  'careInstructions',
  'status',
  'featured',
  'newArrival',
  'bestSeller',
  'metaTitle',
  'metaDescription',
];
const allowedVariantFields = ['_id', 'id', 'sku', 'colourName', 'colourHex', 'price', 'compareAtPrice', 'images', 'sizes', 'active'];
const allowedImageFields = ['_id', 'id', 'pose', 'url', 'publicId', 'alt', 'sortOrder', 'isPrimary'];
const allowedSizeFields = ['_id', 'id', 'name', 'stock', 'active'];

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

function rejectUnknownProductFields() {
  return body().custom((value) => {
    const unknownField = Object.keys(value || {}).find((field) => !allowedProductFields.includes(field));

    if (unknownField) {
      throw new Error(`${unknownField} is not allowed`);
    }

    return true;
  });
}

function validateNestedFields() {
  return body('variants').custom((variants) => {
    if (variants === undefined) {
      return true;
    }

    if (!Array.isArray(variants)) {
      throw new Error('Variants must be an array');
    }

    variants.forEach((variant, variantIndex) => {
      const unknownVariantField = Object.keys(variant || {}).find((field) => !allowedVariantFields.includes(field));

      if (unknownVariantField) {
        throw new Error(`variants.${variantIndex}.${unknownVariantField} is not allowed`);
      }

      if (Array.isArray(variant.images)) {
        variant.images.forEach((image, imageIndex) => {
          const unknownImageField = Object.keys(image || {}).find((field) => !allowedImageFields.includes(field));

          if (unknownImageField) {
            throw new Error(`variants.${variantIndex}.images.${imageIndex}.${unknownImageField} is not allowed`);
          }
        });
      }

      if (Array.isArray(variant.sizes)) {
        variant.sizes.forEach((size, sizeIndex) => {
          const unknownSizeField = Object.keys(size || {}).find((field) => !allowedSizeFields.includes(field));

          if (unknownSizeField) {
            throw new Error(`variants.${variantIndex}.sizes.${sizeIndex}.${unknownSizeField} is not allowed`);
          }
        });
      }
    });

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

function productIdValidator() {
  return param('productId').custom((value) => {
    if (!isObjectId(value)) {
      throw new Error('Invalid product ID');
    }

    return true;
  });
}

const productBodyValidators = [
  rejectUnknownProductFields(),
  validateNestedFields(),
  body('name')
    .optional({ values: 'undefined' })
    .trim()
    .isLength({ min: 2, max: 150 })
    .withMessage('Name must be between 2 and 150 characters'),
  body('slug')
    .optional({ values: 'falsy' })
    .trim()
    .toLowerCase()
    .matches(slugPattern)
    .withMessage('Slug must be lowercase and URL safe'),
  body('skuPrefix')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 30 })
    .withMessage('SKU prefix must be at most 30 characters'),
  body('mainCategory')
    .optional({ values: 'undefined' })
    .custom(isObjectId)
    .withMessage('Main category must be valid'),
  body('subcategory')
    .optional({ values: 'falsy' })
    .custom(isObjectId)
    .withMessage('Subcategory must be valid'),
  body(['productType', 'style', 'fabric', 'occasion'])
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 80 })
    .withMessage('Product discovery fields must be at most 80 characters'),
  body('tags')
    .optional({ values: 'undefined' })
    .isArray({ max: 20 })
    .withMessage('Tags must be an array with at most 20 values'),
  body('tags.*')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 40 })
    .withMessage('Each tag must be at most 40 characters'),
  body('shortDescription')
    .optional({ values: 'undefined' })
    .trim()
    .isLength({ min: 1, max: 300 })
    .withMessage('Short description is required and must be at most 300 characters'),
  body('description')
    .optional({ values: 'undefined' })
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Description is required and must be at most 5000 characters'),
  body('regularPrice')
    .optional({ values: 'undefined' })
    .isFloat({ min: 0 })
    .withMessage('Regular price cannot be negative')
    .toFloat(),
  body('salePrice')
    .optional({ nullable: true, values: 'undefined' })
    .custom((value) => value === null || value === '' || Number(value) >= 0)
    .withMessage('Sale price cannot be negative')
    .customSanitizer((value) => (value === '' ? null : value))
    .toFloat(),
  body('variants')
    .optional({ values: 'undefined' })
    .isArray({ min: 1 })
    .withMessage('At least one colour variant is required'),
  body('variants.*.sku')
    .optional({ values: 'undefined' })
    .trim()
    .notEmpty()
    .withMessage('Variant SKU is required'),
  body('variants.*.colourName')
    .optional({ values: 'undefined' })
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Colour name is required and must be at most 50 characters'),
  body('variants.*.colourHex')
    .optional({ values: 'falsy' })
    .trim()
    .matches(hexPattern)
    .withMessage('Colour hex must be a valid hex colour'),
  body('variants.*.price').isFloat({ min: 0 }).withMessage('Variant price cannot be negative').toFloat(),
  body('variants.*.compareAtPrice')
    .optional({ nullable: true, values: 'undefined' })
    .custom((value) => value === null || value === '' || Number(value) >= 0)
    .withMessage('Compare-at price cannot be negative')
    .customSanitizer((value) => (value === '' ? null : value)),
  body('variants.*.active')
    .optional({ values: 'undefined' })
    .isBoolean()
    .withMessage('Variant active must be true or false')
    .toBoolean(),
  body('variants.*.images')
    .optional({ values: 'undefined' })
    .isArray()
    .withMessage('Variant images must be an array'),
  body('variants.*.images.*.pose')
    .isIn(['front', 'side', 'back'])
    .withMessage('Image pose must be front, side or back'),
  body('variants.*.images.*.url')
    .optional({ values: 'undefined' })
    .trim()
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('Image URL must be a valid HTTP or HTTPS URL'),
  body('variants.*.images.*.alt')
    .optional({ values: 'undefined' })
    .trim()
    .isLength({ min: 1, max: 180 })
    .withMessage('Image alt text is required and must be at most 180 characters'),
  body('variants.*.images.*.publicId').optional({ values: 'falsy' }).trim(),
  body('variants.*.images.*.sortOrder')
    .optional({ values: 'undefined' })
    .isInt({ min: 0 })
    .withMessage('Image sort order must be at least 0')
    .toInt(),
  body('variants.*.images.*.isPrimary')
    .optional({ values: 'undefined' })
    .isBoolean()
    .withMessage('Image primary flag must be true or false')
    .toBoolean(),
  body('variants.*.sizes')
    .optional({ values: 'undefined' })
    .isArray()
    .withMessage('Variant sizes must be an array'),
  body('variants.*.sizes.*.name')
    .optional({ values: 'undefined' })
    .trim()
    .notEmpty()
    .withMessage('Size name is required')
    .bail()
    .isLength({ max: 40 })
    .withMessage('Size name must be at most 40 characters'),
  body('variants.*.sizes.*.stock')
    .optional({ values: 'undefined' })
    .isInt({ min: 0 })
    .withMessage('Stock cannot be negative')
    .toInt(),
  body('variants.*.sizes.*.active')
    .optional({ values: 'undefined' })
    .isBoolean()
    .withMessage('Size active must be true or false')
    .toBoolean(),
  body(['fabricDetails', 'careInstructions'])
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 500 })
    .withMessage('Text field must be at most 500 characters'),
  body('fit').optional({ values: 'falsy' }).trim().isLength({ max: 200 }).withMessage('Fit must be at most 200 characters'),
  body('status').optional({ values: 'undefined' }).isIn(['draft', 'active', 'archived']).withMessage('Status must be draft, active or archived'),
  optionalBoolean('featured'),
  optionalBoolean('newArrival'),
  optionalBoolean('bestSeller'),
  body('metaTitle').optional({ values: 'falsy' }).trim().isLength({ max: 70 }).withMessage('Meta title must be at most 70 characters'),
  body('metaDescription')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 170 })
    .withMessage('Meta description must be at most 170 characters'),
  body(['createdBy', 'updatedBy', 'ratingAverage', 'ratingCount', 'salesCount', 'viewCount'])
    .not()
    .exists()
    .withMessage('System-managed fields cannot be changed'),
];

export const createProductValidator = [
  ...productBodyValidators,
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('mainCategory').notEmpty().withMessage('Main category is required'),
  body('shortDescription').trim().notEmpty().withMessage('Short description is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('regularPrice').notEmpty().withMessage('Regular price is required'),
  body('variants').isArray({ min: 1 }).withMessage('At least one colour variant is required'),
];

export const updateProductValidator = [productIdValidator(), ...productBodyValidators];

export const updateProductStatusValidator = [
  productIdValidator(),
  body().custom((value) => {
    const unknownField = Object.keys(value || {}).find((field) => field !== 'status');

    if (unknownField) {
      throw new Error(`${unknownField} is not allowed`);
    }

    return true;
  }),
  body('status').isIn(['draft', 'active', 'archived']).withMessage('Status must be draft, active or archived'),
];

export const updateProductStockValidator = [
  productIdValidator(),
  body().custom((value) => {
    const unknownField = Object.keys(value || {}).find((field) => !['variantId', 'sizeId', 'stock'].includes(field));

    if (unknownField) {
      throw new Error(`${unknownField} is not allowed`);
    }

    return true;
  }),
  body('variantId').custom(isObjectId).withMessage('Variant ID must be valid'),
  body('sizeId').custom(isObjectId).withMessage('Size ID must be valid'),
  body('stock').isInt({ min: 0 }).withMessage('Stock cannot be negative').toInt(),
];

export const productIdOnlyValidator = [productIdValidator()];

export const publicProductListValidator = [
  query('page').optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('Page must be at least 1').toInt(),
  query('limit').optional({ values: 'falsy' }).isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
  query(['search', 'mainCategorySlug', 'subcategorySlug', 'productType', 'style', 'fabric', 'occasion', 'size', 'colour'])
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 100 }),
  query(['mainCategory', 'subcategory']).optional({ values: 'falsy' }).custom(isObjectId).withMessage('Category ID must be valid'),
  query('tags').optional({ values: 'falsy' }),
  query(['minPrice', 'maxPrice']).optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('Price filters cannot be negative').toFloat(),
  query(['inStock', 'featured', 'newArrival', 'bestSeller', 'sale'])
    .optional({ values: 'falsy' })
    .isBoolean()
    .withMessage('Boolean filters must be true or false')
    .toBoolean(),
  query('sort')
    .optional({ values: 'falsy' })
    .isIn(['recommended', 'newest', 'best-selling', 'price-low-high', 'price-high-low', 'highest-discount'])
    .withMessage('Sort option is not supported'),
];

export const adminProductListValidator = [
  ...publicProductListValidator,
  query('status').optional({ values: 'falsy' }).isIn(['draft', 'active', 'archived']).withMessage('Status filter is not supported'),
  query('stockStatus').optional({ values: 'falsy' }).isIn(['in-stock', 'out-of-stock']).withMessage('Stock status filter is not supported'),
];

export const productSlugValidator = [
  param('slug').trim().matches(slugPattern).withMessage('Product slug must be URL safe'),
];
