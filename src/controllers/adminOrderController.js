import mongoose from 'mongoose';
import AdminAudit from '../models/AdminAudit.js';
import EmailNotification from '../models/EmailNotification.js';
import Order from '../models/Order.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import {
  retryFailedEmailNotification,
  sendCancellationApprovedEmail,
  sendOrderDeliveredEmail,
  sendOrderOutForDeliveryEmail,
  sendOrderShippedEmail,
} from '../services/emailService.js';
import { cancelBeforeDispatch } from '../services/cancellationService.js';
import { createOrderNotification } from '../services/notificationService.js';

const statusAliases = {
  new: 'confirmed',
  confirmed: 'confirmed',
  packed: 'packed',
  dispatched: 'shipped',
  'out-for-delivery': 'out_for_delivery',
  delivered: 'delivered',
  cancelled: 'cancelled',
};

const publicStatus = (status) => ({
  pending_payment: 'new',
  payment_failed: 'new',
  payment_review: 'new',
  processing: 'confirmed',
  shipped: 'dispatched',
  out_for_delivery: 'out-for-delivery',
}[status] || status);

function serialize(order) {
  const customer = order.customer || {};
  return {
    id: order._id.toString(),
    orderNumber: order.orderNumber,
    customer: {
      id: customer._id?.toString?.() || '',
      name: customer.fullName || order.shippingAddress?.fullName || 'Customer',
      email: customer.email || '',
      phone: customer.mobile || order.shippingAddress?.mobile || '',
      type: 'registered',
    },
    items: (order.items || []).map((item) => ({
      productId: item.product?.toString?.() || '',
      productName: item.productName,
      productImage: item.productImage,
      sku: item.sku,
      colour: item.colourName,
      size: item.size,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: 0,
      itemTotal: item.lineTotal,
    })),
    itemCount: (order.items || []).reduce((sum, item) => sum + item.quantity, 0),
    subtotal: order.subtotal,
    discount: 0,
    couponDiscount: 0,
    shippingCharge: order.shippingCharge,
    tax: order.tax,
    totalAmount: order.total,
    amountPaid: order.paymentStatus === 'paid' ? order.total : 0,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    orderStatus: publicStatus(order.orderStatus),
    razorpayOrderId: order.razorpay?.orderId || '',
    razorpayPaymentId: order.razorpay?.paymentId || '',
    shippingAddress: order.shippingAddress,
    shipping: {
      courierName: order.shipment?.courierName || '',
      trackingId: order.shipment?.trackingNumber || '',
      trackingUrl: order.shipment?.trackingUrl || '',
      estimatedDeliveryDate: order.shipment?.estimatedDeliveryDate || null,
    },
    customerNote: order.customerNotes || '',
    timeline: (order.statusTimeline || []).map((event) => ({
      status: publicStatus(event.status),
      message: event.message,
      note: event.note || '',
      changedBy: event.changedBy?.fullName || (event.changedByType === 'admin' ? 'Admin' : 'System'),
      createdAt: event.changedAt,
    })),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

function baseQuery(query) {
  const filter = {};
  if (query.orderStatus && query.orderStatus !== 'all') filter.orderStatus = statusAliases[query.orderStatus] || query.orderStatus;
  if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;
  if (query.startDate || query.endDate) {
    filter.createdAt = {};
    if (query.startDate) filter.createdAt.$gte = new Date(`${query.startDate}T00:00:00.000Z`);
    if (query.endDate) filter.createdAt.$lte = new Date(`${query.endDate}T23:59:59.999Z`);
  }
  return filter;
}

export const listAdminOrders = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 15));
  const filter = baseQuery(req.query);
  const search = String(req.query.search || '').trim();
  if (search) {
    const expression = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const users = await mongoose.model('User').find({
      $or: [{ fullName: expression }, { email: expression }, { mobile: expression }],
    }).select('_id');
    filter.$or = [
      { orderNumber: expression },
      { 'items.productName': expression },
      { 'shipment.trackingNumber': expression },
      { customer: { $in: users.map((user) => user._id) } },
    ];
  }
  const [orders, total] = await Promise.all([
    Order.find(filter).populate('customer', 'fullName email mobile').sort({ createdAt: req.query.sort === 'oldest' ? 1 : -1 })
      .skip((page - 1) * limit).limit(limit).lean(),
    Order.countDocuments(filter),
  ]);
  res.json({ success: true, message: 'Orders retrieved successfully', data: {
    orders: orders.map(serialize), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  } });
});

export const getAdminOrderStats = asyncHandler(async (_req, res) => {
  const [groups, sales, recentOrders] = await Promise.all([
    Order.aggregate([{ $group: { _id: '$orderStatus', count: { $sum: 1 } } }]),
    Order.aggregate([{ $match: { paymentStatus: 'paid', orderStatus: { $nin: ['cancelled', 'refunded'] } } }, { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }]),
    Order.find().populate('customer', 'fullName email mobile').sort({ createdAt: -1 }).limit(5).lean(),
  ]);
  const counts = Object.fromEntries(groups.map((group) => [publicStatus(group._id), group.count]));
  const totalOrders = groups.reduce((sum, group) => sum + group.count, 0);
  res.json({ success: true, message: 'Order statistics retrieved successfully', data: {
    totalOrders, newOrders: (counts.new || 0), paidOrders: sales[0]?.count || 0, ordersToPack: counts.confirmed || 0,
    dispatchedOrders: counts.dispatched || 0, deliveredOrders: counts.delivered || 0, totalSales: sales[0]?.total || 0,
    pendingBadge: (counts.new || 0) + (counts.confirmed || 0) + (counts.packed || 0),
    counts: { all: totalOrders, ...counts }, recentOrders: recentOrders.map(serialize),
  } });
});

export const getAdminOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ $or: [
    ...(mongoose.isValidObjectId(req.params.orderId) ? [{ _id: req.params.orderId }] : []),
    { orderNumber: req.params.orderId.toUpperCase() },
  ] }).populate('customer', 'fullName email mobile').populate('statusTimeline.changedBy', 'fullName');
  if (!order) throw new ApiError(404, 'Order not found', []);
  res.json({ success: true, message: 'Order retrieved successfully', data: serialize(order) });
});

async function transition(req, target, allowed, message, emailSender) {
  const order = await Order.findOne({ $or: [
    ...(mongoose.isValidObjectId(req.params.orderId) ? [{ _id: req.params.orderId }] : []),
    { orderNumber: req.params.orderId.toUpperCase() },
  ] }).populate('customer', 'fullName email mobile');
  if (!order) throw new ApiError(404, 'Order not found', []);
  if (!allowed.includes(order.orderStatus)) throw new ApiError(409, `Only ${allowed.map(publicStatus).join(' or ')} orders can be updated this way`, []);
  if (['confirmed', 'packed', 'shipped', 'out_for_delivery'].includes(target) && order.paymentStatus !== 'paid') {
    throw new ApiError(409, 'A verified paid order is required for this action', []);
  }
  if (target === 'shipped') {
    const estimated = new Date(req.body.estimatedDeliveryDate);
    if (!req.body.courierName?.trim() || !req.body.trackingId?.trim()) throw new ApiError(422, 'Courier name and tracking ID are required', []);
    if (Number.isNaN(estimated.getTime()) || estimated < new Date(new Date().setHours(0, 0, 0, 0))) throw new ApiError(422, 'Estimated delivery date cannot be in the past', []);
    const dispatched = await Order.findOneAndUpdate(
      { _id: order._id, orderStatus: 'packed', paymentStatus: 'paid' },
      {
        $set: {
          orderStatus: 'shipped',
          'shipment.courierName': req.body.courierName.trim(),
          'shipment.trackingNumber': req.body.trackingId.trim(),
          'shipment.trackingUrl': req.body.trackingUrl?.trim() || '',
          'shipment.estimatedDeliveryDate': estimated,
          'shipment.shippedAt': new Date(),
        },
        $push: { statusTimeline: { status: 'shipped', message, note: req.body.note || '', changedBy: req.user.id, changedByType: 'admin', changedAt: new Date() } },
      },
      { new: true },
    ).populate('customer', 'fullName email mobile');
    if (!dispatched) throw new ApiError(409, 'The order was cancelled or changed before dispatch could be completed.', []);
    await AdminAudit.create({ admin: req.user.id, adminName: req.user.fullName || 'Admin', action: message, order: dispatched._id, orderNumber: dispatched.orderNumber });
    await createOrderNotification(
      dispatched,
      'Order dispatched',
      `Your order #${dispatched.orderNumber} has been dispatched through ${dispatched.shipment.courierName}. Tracking ID: ${dispatched.shipment.trackingNumber}.`,
      'order_dispatched',
    );
    const notification = await emailSender(dispatched);
    res.json({ success: true, message: notification.sent ? 'Order updated successfully. The customer has been notified.' : 'Order updated, but the email notification could not be sent.', data: { order: serialize(dispatched), notification } });
    return;
  }
  order.orderStatus = target;
  order.statusTimeline.push({ status: target, message, note: req.body.note || '', changedBy: req.user.id, changedByType: 'admin' });
  if (target === 'out_for_delivery') order.shipment.outForDeliveryAt = new Date();
  if (target === 'delivered') order.shipment.deliveredAt = new Date();
  await order.save();
  await createOrderNotification(
    order,
    message,
    `Your order #${order.orderNumber} is now ${publicStatus(target).replaceAll('_', ' ')}.`,
    `order_${target}`,
  );
  await AdminAudit.create({ admin: req.user.id, adminName: req.user.fullName || 'Admin', action: message, order: order._id, orderNumber: order.orderNumber });
  const notification = emailSender ? await emailSender(order) : { sent: false, skipped: true };
  res.json({ success: true, message: notification.sent ? 'Order updated successfully. The customer has been notified.' : 'Order updated, but the email notification could not be sent.', data: { order: serialize(order), notification } });
}

export const confirmOrder = asyncHandler((req, res) => transition(req, 'confirmed', ['confirmed'], 'Order confirmed', null));
export const processOrder = asyncHandler((req, res) => transition(req, 'processing', ['confirmed'], 'Order processing', null));
export const packOrder = asyncHandler((req, res) => transition(req, 'packed', ['confirmed', 'processing'], 'Order packed', null));
export const dispatchOrder = asyncHandler((req, res) => transition(req, 'shipped', ['packed'], 'Order dispatched', sendOrderShippedEmail));
export const outForDeliveryOrder = asyncHandler((req, res) => transition(req, 'out_for_delivery', ['shipped'], 'Order out for delivery', sendOrderOutForDeliveryEmail));
export const deliverOrder = asyncHandler((req, res) => transition(req, 'delivered', ['out_for_delivery'], 'Order delivered', sendOrderDeliveredEmail));
export const updateOrderStatus = asyncHandler((req, res) => {
  const target = req.body.orderStatus;
  const transitions = {
    processing: { allowed: ['confirmed'], message: 'Order processing' },
    packed: { allowed: ['processing'], message: 'Order packed' },
    out_for_delivery: { allowed: ['shipped'], message: 'Order out for delivery', email: sendOrderOutForDeliveryEmail },
    delivered: { allowed: ['out_for_delivery'], message: 'Order delivered', email: sendOrderDeliveredEmail },
  };
  const rule = transitions[target];
  if (!rule) throw new ApiError(422, 'Invalid order-status change.', []);
  return transition(req, target, rule.allowed, rule.message, rule.email || null);
});

export const updatePaymentStatus = asyncHandler(async (req, res) => {
  if (req.body.paymentStatus === 'paid') {
    throw new ApiError(409, 'Paid status can be set only by verified Razorpay payment confirmation.', []);
  }
  if (!['pending', 'failed'].includes(req.body.paymentStatus)) {
    throw new ApiError(422, 'Invalid payment-status change.', []);
  }
  const order = await Order.findById(req.params.orderId);
  if (!order) throw new ApiError(404, 'Order not found.', []);
  order.paymentStatus = req.body.paymentStatus;
  await order.save();
  res.json({ success: true, message: 'Payment status updated successfully', data: { order: serialize(order) } });
});
export const cancelOrder = asyncHandler(async (req, res) => {
  const result = await cancelBeforeDispatch({ orderId: req.params.orderId, admin: req.user, reason: req.body.reason });
  await AdminAudit.create({ admin: req.user.id, adminName: req.user.fullName || 'Admin', action: 'Order cancelled', order: result.order._id, orderNumber: result.order.orderNumber });
  res.json({ success: true, message: result.refund ? 'Order cancelled and refund initiated successfully.' : 'Order cancelled successfully.', data: { order: serialize(result.order), refund: result.refund, notification: result.notification } });
});

export const retryOrderNotification = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ $or: [
    ...(mongoose.isValidObjectId(req.params.orderId) ? [{ _id: req.params.orderId }] : []),
    { orderNumber: req.params.orderId.toUpperCase() },
  ] });
  if (!order) throw new ApiError(404, 'Order not found', []);
  const notification = await EmailNotification.findOne({ order: order._id, status: { $in: ['failed', 'skipped'] } }).sort({ createdAt: -1 });
  if (!notification) throw new ApiError(404, 'No failed notification is available to retry', []);
  const result = await retryFailedEmailNotification(notification._id);
  await AdminAudit.create({ admin: req.user.id, adminName: req.user.fullName || 'Admin', action: 'Notification retried', order: order._id, orderNumber: order.orderNumber });
  res.json({ success: true, message: result.sent ? 'Notification sent successfully' : 'Notification could not be sent', data: result });
});
