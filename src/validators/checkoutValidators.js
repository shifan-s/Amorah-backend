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
    const allowedFields = ['shippingAddressId', 'billingSameAsShipping', 'billingAddressId', 'customerNotes'];
    const unknownField = Object.keys(value || {}).find((field) => !allowedFields.includes(field));

    if (unknownField) {
      throw new Error(`${unknownField} is not allowed`);
    }

    return true;
  }),
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
