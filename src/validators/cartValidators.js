import { body, param } from 'express-validator';
import mongoose from 'mongoose';

const maxQuantity = 20;
const maxMergeItems = 50;

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

const cartSelectionValidators = [
  body('productId').custom(isObjectId).withMessage('Product ID must be valid'),
  body('variantId').custom(isObjectId).withMessage('Variant ID must be valid'),
  body('sizeId').custom(isObjectId).withMessage('Size ID must be valid'),
  body('quantity')
    .isInt({ min: 1, max: maxQuantity })
    .withMessage(`Quantity must be between 1 and ${maxQuantity}`)
    .toInt(),
];

export const addCartItemValidator = [
  body().custom((value) => {
    const allowedFields = ['productId', 'variantId', 'sizeId', 'quantity'];
    const unknownField = Object.keys(value || {}).find((field) => !allowedFields.includes(field));

    if (unknownField) {
      throw new Error(`${unknownField} is not allowed`);
    }

    return true;
  }),
  ...cartSelectionValidators,
];

export const updateCartItemValidator = [
  param('itemId').custom(isObjectId).withMessage('Cart item ID must be valid'),
  body().custom((value) => {
    const allowedFields = ['quantity'];
    const unknownField = Object.keys(value || {}).find((field) => !allowedFields.includes(field));

    if (unknownField) {
      throw new Error(`${unknownField} is not allowed`);
    }

    return true;
  }),
  body('quantity')
    .isInt({ min: 1, max: maxQuantity })
    .withMessage(`Quantity must be between 1 and ${maxQuantity}`)
    .toInt(),
];

export const cartItemIdValidator = [
  param('itemId').custom(isObjectId).withMessage('Cart item ID must be valid'),
];

export const mergeCartValidator = [
  body().custom((value) => {
    const allowedFields = ['items', 'mergeId'];
    const unknownField = Object.keys(value || {}).find((field) => !allowedFields.includes(field));

    if (unknownField) {
      throw new Error(`${unknownField} is not allowed`);
    }

    return true;
  }),
  body('items')
    .isArray({ max: maxMergeItems })
    .withMessage(`Items must be an array with at most ${maxMergeItems} entries`),
  body('items.*').custom((value) => {
    const allowedFields = ['productId', 'variantId', 'sizeId', 'quantity'];
    const unknownField = Object.keys(value || {}).find((field) => !allowedFields.includes(field));

    if (unknownField) {
      throw new Error(`items.${unknownField} is not allowed`);
    }

    return true;
  }),
  body('mergeId').isString().trim().isLength({ min: 8, max: 100 }).withMessage('Merge ID must be valid'),
  body('items.*.productId').optional().isString(),
  body('items.*.variantId').optional().isString(),
  body('items.*.sizeId').optional().isString(),
  body('items.*.quantity')
    .optional()
    .isInt({ max: maxQuantity })
    .withMessage(`Quantity must be at most ${maxQuantity}`)
    .toInt(),
];
