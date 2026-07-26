import Notification from '../models/Notification.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

function safeNotification(item) {
  return {
    id: item._id.toString(),
    orderNumber: item.order?.orderNumber || null,
    title: item.title,
    message: item.message,
    type: item.type,
    isRead: item.isRead,
    createdAt: item.createdAt,
  };
}

export const listMyNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ user: req.user.id })
    .populate('order', 'orderNumber')
    .sort({ createdAt: -1 })
    .limit(100);
  res.json({ success: true, message: 'Notifications retrieved successfully', data: { notifications: notifications.map(safeNotification) } });
});

export const readNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.notificationId, user: req.user.id },
    { $set: { isRead: true } },
    { new: true },
  ).populate('order', 'orderNumber');
  if (!notification) throw new ApiError(404, 'Notification not found.', []);
  res.json({ success: true, message: 'Notification marked as read', data: { notification: safeNotification(notification) } });
});

export const readAllNotifications = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user.id, isRead: false }, { $set: { isRead: true } });
  res.json({ success: true, message: 'All notifications marked as read' });
});
