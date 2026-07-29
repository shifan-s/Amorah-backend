import { body, param } from 'express-validator';
import mongoose from 'mongoose';

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value || '');
}

function hasHtml(value = '') {
  return /<[^>]*>/.test(String(value));
}

function rejectUnknown(allowedFields) {
  return body().custom((value) => {
    const unknownField = Object.keys(value || {}).find((field) => !allowedFields.includes(field));

    if (unknownField) {
      throw new Error(`${unknownField} is not allowed`);
    }

    return true;
  });
}

export const createRazorpayOrderValidator = [
  rejectUnknown(['items', 'shippingAddressId', 'billingSameAsShipping', 'billingAddressId', 'customerNotes', 'idempotencyKey']),
  body('items').isArray({ min: 1, max: 50 }).withMessage('Cart items are required'),
  body('items.*').custom((item) => {
    const allowed = ['productId', 'variantId', 'sizeId', 'quantity'];
    const unknown = Object.keys(item || {}).find((field) => !allowed.includes(field));
    if (unknown) {
      throw new Error(`${unknown} is not allowed in a cart item`);
    }
    return true;
  }),
  body('items.*.productId').custom(isObjectId).withMessage('Product ID is invalid'),
  body('items.*.variantId').custom(isObjectId).withMessage('Variant ID is invalid'),
  body('items.*.sizeId').custom(isObjectId).withMessage('Size ID is invalid'),
  body('items.*.quantity')
    .isInt({ min: 1, max: 20 })
    .withMessage('Quantity must be between 1 and 20')
    .toInt(),
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
  body('idempotencyKey')
    .trim()
    .isLength({ min: 16, max: 100 })
    .withMessage('Payment attempt key must be between 16 and 100 characters')
    .matches(/^[A-Za-z0-9_-]+$/)
    .withMessage('Payment attempt key contains unsupported characters'),
];

export const verifyRazorpayPaymentValidator = [
  rejectUnknown(['orderNumber', 'razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature']),
  body('orderNumber')
    .trim()
    .matches(/^AMR-\d{4}-\d{6}$/)
    .withMessage('Order number is invalid'),
  body('razorpay_order_id')
    .trim()
    .isLength({ min: 8, max: 80 })
    .withMessage('Razorpay order ID is invalid')
    .matches(/^order_[A-Za-z0-9]+$/)
    .withMessage('Razorpay order ID is invalid'),
  body('razorpay_payment_id')
    .trim()
    .isLength({ min: 8, max: 80 })
    .withMessage('Razorpay payment ID is invalid')
    .matches(/^pay_[A-Za-z0-9]+$/)
    .withMessage('Razorpay payment ID is invalid'),
  body('razorpay_signature')
    .trim()
    .isLength({ min: 32, max: 256 })
    .withMessage('Razorpay signature is invalid')
    .matches(/^[A-Fa-f0-9]+$/)
    .withMessage('Razorpay signature is invalid'),
];

export const razorpayStatusValidator = [
  param('orderNumber')
    .trim()
    .matches(/^AMR-\d{4}-\d{6}$/)
    .withMessage('Order number is invalid'),
];
