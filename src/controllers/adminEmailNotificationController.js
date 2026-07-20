import EmailNotification from '../models/EmailNotification.js';
import { retryFailedEmailNotification } from '../services/emailService.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

function toSafeNotification(notification) {
  return {
    id: notification._id.toString(),
    orderNumber: notification.orderNumber,
    recipient: notification.recipient,
    eventType: notification.eventType,
    subject: notification.subject,
    status: notification.status,
    attempts: notification.attempts,
    messageId: notification.messageId,
    lastError: notification.lastError,
    sentAt: notification.sentAt,
    lastAttemptAt: notification.lastAttemptAt,
    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt,
  };
}

function buildListFilter(query) {
  const filter = {};

  if (query.orderNumber) {
    filter.orderNumber = query.orderNumber;
  }

  if (query.eventType) {
    filter.eventType = query.eventType;
  }

  if (query.status) {
    filter.status = query.status;
  }

  if (query.recipient) {
    filter.recipient = { $regex: query.recipient, $options: 'i' };
  }

  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {};
    if (query.dateFrom) {
      filter.createdAt.$gte = query.dateFrom;
    }
    if (query.dateTo) {
      filter.createdAt.$lte = query.dateTo;
    }
  }

  return filter;
}

export const listEmailNotifications = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const skip = (page - 1) * limit;
  const filter = buildListFilter(req.query);
  const [notifications, totalNotifications] = await Promise.all([
    EmailNotification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    EmailNotification.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    message: 'Email notifications retrieved successfully',
    data: {
      notifications: notifications.map(toSafeNotification),
      pagination: {
        page,
        limit,
        totalNotifications,
        totalPages: Math.ceil(totalNotifications / limit),
      },
    },
  });
});

export const retryEmailNotification = asyncHandler(async (req, res) => {
  const result = await retryFailedEmailNotification(req.params.notificationId);

  if (!result) {
    throw new ApiError(404, 'Email notification not found', []);
  }

  res.status(200).json({
    success: true,
    message: result.sent ? 'Email notification sent successfully' : result.reason || 'Email notification retry processed',
    data: {
      result,
    },
  });
});
