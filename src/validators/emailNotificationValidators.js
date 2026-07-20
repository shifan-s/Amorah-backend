import { param, query } from 'express-validator';
import mongoose from 'mongoose';
import { emailEventTypes, emailStatuses } from '../models/EmailNotification.js';

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value || '');
}

export const listEmailNotificationsValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive number').toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50').toInt(),
  query('orderNumber')
    .optional()
    .trim()
    .matches(/^AMR-\d{4}-\d{6}$/)
    .withMessage('Order number is invalid'),
  query('eventType').optional().isIn(emailEventTypes).withMessage('Email event type is invalid'),
  query('status').optional().isIn(emailStatuses).withMessage('Email status is invalid'),
  query('recipient').optional().trim().isLength({ max: 160 }).withMessage('Recipient filter is too long'),
  query('dateFrom').optional().isISO8601().withMessage('Start date is invalid').toDate(),
  query('dateTo').optional().isISO8601().withMessage('End date is invalid').toDate(),
];

export const retryEmailNotificationValidator = [
  param('notificationId').custom(isObjectId).withMessage('Email notification ID is invalid'),
];
