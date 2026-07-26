import OrderIssue from '../models/OrderIssue.js';
import Order from '../models/Order.js';
import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { cancelBeforeDispatch } from '../services/cancellationService.js';

export const cancelMyOrder = asyncHandler(async (req, res) => {
  const result = await cancelBeforeDispatch({ orderId: req.params.orderId, customerId: req.user.id, reason: req.body.reason });
  res.json({ success: true, message: result.refund ? 'Order cancelled and refund initiated successfully.' : 'Order cancelled successfully.', data: { orderNumber: result.order.orderNumber, orderStatus: result.order.orderStatus, refund: result.refund, notification: result.notification } });
});

export const reportOrderIssue = asyncHandler(async (req, res) => {
  const identity = mongoose.isValidObjectId(req.params.orderId)
    ? { _id: req.params.orderId }
    : { orderNumber: String(req.params.orderId).toUpperCase() };
  const order = await Order.findOne({ ...identity, customer: req.user.id });
  if (!order) throw new ApiError(404, 'Order not found', []);
  if (!['shipped', 'out_for_delivery', 'delivered'].includes(order.orderStatus)) throw new ApiError(409, 'Issues may be reported only after an order has been dispatched.', []);
  const item = order.items.find((entry) => entry.product.toString() === req.body.productId || entry.sku === req.body.sku);
  if (!item) throw new ApiError(422, 'The selected product does not belong to this order.', []);
  const issue = await OrderIssue.create({ order: order._id, orderNumber: order.orderNumber, customer: req.user.id, product: item.product, productName: item.productName, sku: item.sku, issueType: req.body.issueType, explanation: req.body.explanation, evidenceImages: req.body.evidenceImages || [] });
  order.statusTimeline.push({ status: order.orderStatus, message: 'Issue reported', note: req.body.issueType, changedBy: req.user.id, changedByType: 'customer' });
  await order.save();
  res.status(201).json({ success: true, message: 'Your issue has been submitted for review.', data: { issue } });
});
