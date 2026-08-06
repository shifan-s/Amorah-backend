import { body } from 'express-validator';
import mongoose from 'mongoose';

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value || '');
}

function hasHtml(value = '') {
  return /<[^>]*>/.test(String(value));
}

export const checkoutPreviewValidator = [
  body().custom((value) => {
    const allowedFields = ['items', 'checkoutMode', 'shippingAddressId', 'billingSameAsShipping', 'billingAddressId', 'customerNotes'];
    const unknownField = Object.keys(value || {}).find((field) => !allowedFields.includes(field));

    if (unknownField) {
      throw new Error(`${unknownField} is not allowed`);
    }

    return true;
  }),
  body('checkoutMode').optional().isIn(['cart', 'buyNow']).withMessage('Checkout mode is invalid'),
  body('items').optional().isArray({ min: 1, max: 1 }).withMessage('Buy Now requires one item'),
  body('items.*.productId').optional().custom(isObjectId).withMessage('Product ID is invalid'),
  body('items.*.variantId').optional().custom(isObjectId).withMessage('Variant ID is invalid'),
  body('items.*.sizeId').optional().custom(isObjectId).withMessage('Size ID is invalid'),
  body('items.*.quantity').optional().isInt({ min: 1, max: 20 }).withMessage('Quantity must be between 1 and 20').toInt(),
  body('shippingAddressId').custom(isObjectId).withMessage('Shipping address is required'),
  body('billingSameAsShipping').isBoolean().withMessage('Billing preference is required').toBoolean(),
  body('billingAddressId').custom((value, { req }) => {
    const billingSameAsShipping = req.body.billingSameAsShipping === true || req.body.billingSameAsShipping === 'true';

    if (!billingSameAsShipping && !isObjectId(value)) {
      throw new Error('Billing address is required');
    }

    return true;
  }),
  body('billingAddressId')
    .optional({ nullable: true, checkFalsy: true })
    .custom(isObjectId)
    .withMessage('Billing address is invalid'),
  body('customerNotes')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage('Order notes must be at most 500 characters')
    .custom((value) => {
      if (hasHtml(value)) {
        throw new Error('Order notes cannot include HTML');
      }

      return true;
    }),
];
