import mongoose from 'mongoose';
import '../src/config/env.js';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import AdminAudit from '../src/models/AdminAudit.js';
import Counter from '../src/models/Counter.js';
import EmailNotification from '../src/models/EmailNotification.js';
import Notification from '../src/models/Notification.js';
import Order from '../src/models/Order.js';
import OrderIssue from '../src/models/OrderIssue.js';
import Product from '../src/models/Product.js';
import RazorpayWebhookEvent from '../src/models/RazorpayWebhookEvent.js';
import Refund from '../src/models/Refund.js';

const confirmation = '--confirm-delete-all-test-orders';

async function clearTestOrders() {
  if (!process.argv.includes(confirmation)) {
    throw new Error(`Refusing to delete orders without ${confirmation}`);
  }

  await connectDatabase();
  const orders = await Order.find({}).select('_id orderNumber items inventoryApplied inventoryRestored razorpay');
  const orderIds = orders.map((order) => order._id);
  const orderNumbers = orders.map((order) => order.orderNumber);
  const razorpayOrderIds = orders.map((order) => order.razorpay?.orderId).filter(Boolean);
  const razorpayPaymentIds = orders.map((order) => order.razorpay?.paymentId).filter(Boolean);

  for (const order of orders) {
    if (!order.inventoryApplied || order.inventoryRestored) continue;

    for (const item of order.items) {
      await Product.updateOne(
        { _id: item.product, 'variants._id': item.variantId, 'variants.sizes._id': item.sizeId },
        { $inc: { 'variants.$[variant].sizes.$[size].stock': item.quantity } },
        { arrayFilters: [{ 'variant._id': item.variantId }, { 'size._id': item.sizeId }] },
      );
    }
  }

  const results = {
    notifications: (await Notification.deleteMany({ order: { $in: orderIds } })).deletedCount,
    emails: (await EmailNotification.deleteMany({ $or: [{ order: { $in: orderIds } }, { orderNumber: { $in: orderNumbers } }] })).deletedCount,
    refunds: (await Refund.deleteMany({ order: { $in: orderIds } })).deletedCount,
    issues: (await OrderIssue.deleteMany({ order: { $in: orderIds } })).deletedCount,
    audits: (await AdminAudit.deleteMany({ order: { $in: orderIds } })).deletedCount,
    webhooks: (await RazorpayWebhookEvent.deleteMany({
      $or: [{ razorpayOrderId: { $in: razorpayOrderIds } }, { razorpayPaymentId: { $in: razorpayPaymentIds } }],
    })).deletedCount,
    orders: (await Order.deleteMany({ _id: { $in: orderIds } })).deletedCount,
    counters: (await Counter.deleteMany({ key: /^order-\d{4}$/ })).deletedCount,
  };

  console.log(JSON.stringify({ success: true, inventoryRestoredForOrders: orders.filter((order) => order.inventoryApplied && !order.inventoryRestored).length, deleted: results }, null, 2));
}

clearTestOrders()
  .catch((error) => {
    console.error(error.message || 'Unable to clear test orders.');
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await disconnectDatabase();
  });
