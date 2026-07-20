import { param } from 'express-validator';

export const invoiceOrderNumberValidator = [
  param('orderNumber')
    .trim()
    .isLength({ min: 15, max: 15 })
    .withMessage('Order number is invalid')
    .matches(/^AMR-\d{4}-\d{6}$/)
    .withMessage('Order number is invalid'),
];

