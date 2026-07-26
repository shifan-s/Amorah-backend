import Notification from '../models/Notification.js';

export function createOrderNotification(order, title, message, type) {
  const user = order.customer?._id || order.customer;
  if (!user) return Promise.resolve(null);
  return Notification.create({ user, order: order._id, title, message, type });
}
