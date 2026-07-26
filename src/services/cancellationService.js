import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import ApiError from '../utils/ApiError.js';
import { initiateFullRefund } from './refundService.js';
import { sendCancellationApprovedEmail } from './emailService.js';
import { createOrderNotification } from './notificationService.js';

const cancellableStatuses = ['pending_payment', 'confirmed', 'processing', 'packed'];
const dispatchedStatuses = ['shipped', 'out_for_delivery', 'delivered', 'delivery_refused', 'return_to_origin', 'returned_to_seller'];

function cleanReason(value) {
  return String(value || '').replace(/<[^>]*>/g, '').trim().slice(0, 500);
}

async function restoreStock(order, session) {
  if (!order.inventoryApplied || order.inventoryRestored) return false;
  for (const item of order.items) {
    const result = await Product.updateOne(
      { _id: item.product, variants: { $elemMatch: { _id: item.variantId, sizes: { $elemMatch: { _id: item.sizeId } } } } },
      { $inc: { 'variants.$[variant].sizes.$[size].stock': item.quantity } },
      { arrayFilters: [{ 'variant._id': item.variantId }, { 'size._id': item.sizeId }], session },
    );
    if (result.modifiedCount !== 1) throw new ApiError(409, 'Inventory could not be restored safely. Please contact support.', []);
  }
  order.inventoryRestored = true;
  order.inventoryRestoredAt = new Date();
  order.statusTimeline.push({ status: 'cancelled', message: 'Stock restored', changedByType: 'system', changedAt: new Date() });
  return true;
}

export async function cancelBeforeDispatch({ orderId, customerId, admin, reason }) {
  const safeReason = cleanReason(reason);
  const session = await mongoose.startSession();
  let cancelled;
  try {
    await session.withTransaction(async () => {
      const identity = mongoose.isValidObjectId(orderId) ? { _id: orderId } : { orderNumber: String(orderId).toUpperCase() };
      const owner = customerId ? { customer: customerId } : {};
      const order = await Order.findOne({ ...identity, ...owner }).session(session);
      if (!order) throw new ApiError(404, 'Order not found', []);
      if (dispatchedStatuses.includes(order.orderStatus)) throw new ApiError(409, 'This order has already been dispatched and can no longer be cancelled.', []);
      if (!cancellableStatuses.includes(order.orderStatus)) throw new ApiError(409, order.orderStatus === 'cancelled' ? 'This order has already been cancelled.' : 'This order cannot be cancelled.', []);

      const actorId = admin?.id || customerId;
      const actorType = admin ? 'admin' : 'customer';
      const claimed = await Order.findOneAndUpdate(
        { _id: order._id, orderStatus: order.orderStatus },
        { $set: { orderStatus: 'cancelled', 'cancellation.status': order.paymentStatus === 'paid' ? 'refund_required' : 'approved', 'cancellation.requestReason': safeReason, 'cancellation.customerResponse': safeReason, 'cancellation.decidedAt': new Date() } },
        { new: true, session },
      );
      if (!claimed) throw new ApiError(409, 'The order changed while cancellation was being processed. Please refresh and try again.', []);
      claimed.statusTimeline.push({ status: 'cancelled', message: 'Order cancelled', note: safeReason, changedBy: actorId, changedByType: actorType, changedAt: new Date() });
      await restoreStock(claimed, session);
      await claimed.save({ session });
      cancelled = claimed;
    });
  } finally {
    await session.endSession();
  }

  let refund = null;
  if (cancelled.paymentStatus === 'paid') {
    refund = await initiateFullRefund({ orderNumber: cancelled.orderNumber, reason: safeReason, adminId: admin?.id || customerId });
  }
  const populated = await Order.findById(cancelled._id).populate('customer', 'fullName email mobile');
  await createOrderNotification(
    populated,
    'Order cancelled',
    `Your order #${populated.orderNumber} has been cancelled.`,
    'order_cancelled',
  );
  const notification = await sendCancellationApprovedEmail(populated).catch((error) => ({ sent: false, failed: true, reason: error.message }));
  return { order: populated, refund, notification };
}
