import { param, query } from 'express-validator';

export const myOrdersQueryValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive number').toInt(),
  query('limit').optional().isInt({ min: 1, max: 25 }).withMessage('Limit must be between 1 and 25').toInt(),
];

export const orderNumberValidator = [
  param('orderNumber')
    .trim()
    .matches(/^AMR-\d{4}-\d{6}$/)
    .withMessage('Order number is invalid'),
];
