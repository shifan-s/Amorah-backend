import { body, param, query } from 'express-validator';
import mongoose from 'mongoose';
import { refundInventoryStatuses, refundStatuses } from '../models/Refund.js';

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value || '');
}

function rejectUnknown(allowedFields) {
  return body().custom((value) => {
    const unknown = Object.keys(value || {}).find((field) => !allowedFields.includes(field));

    if (unknown) {
      throw new Error(`${unknown} is not allowed`);
    }

    return true;
  });
}

export const orderRefundEligibilityValidator = [
  param('orderNumber')
    .trim()
    .matches(/^AMR-\d{4}-\d{6}$/)
    .withMessage('Order number is invalid'),
];

export const initiateRefundValidator = [
  param('orderNumber')
    .trim()
    .matches(/^AMR-\d{4}-\d{6}$/)
    .withMessage('Order number is invalid'),
  rejectUnknown(['reason']),
  body('reason')
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('Refund reason must be between 5 and 500 characters')
    .customSanitizer((value) => String(value || '').replace(/<[^>]*>/g, '').trim()),
];

export const refundIdValidator = [
  param('refundId').custom(isObjectId).withMessage('Refund ID is invalid'),
];

export const listRefundsValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive number').toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50').toInt(),
  query('search').optional().trim().isLength({ max: 120 }).withMessage('Search is too long'),
  query('orderNumber')
    .optional()
    .trim()
    .matches(/^AMR-\d{4}-\d{6}$/)
    .withMessage('Order number is invalid'),
  query('status').optional().isIn(refundStatuses).withMessage('Refund status is invalid'),
  query('inventoryRestorationStatus')
    .optional()
    .isIn(refundInventoryStatuses)
    .withMessage('Inventory restoration status is invalid'),
  query('dateFrom').optional().isISO8601().withMessage('Start date is invalid').toDate(),
  query('dateTo').optional().isISO8601().withMessage('End date is invalid').toDate(),
];
