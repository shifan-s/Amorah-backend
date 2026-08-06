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
import User from '../src/models/User.js';

const confirmation = '--confirm-delete-test-orders';

async function clearTestOrders() {
  if (!process.argv.includes(confirmation)) {
    throw new Error(`Refusing to delete test orders without ${confirmation}`);
  }

  await connectDatabase();
  const emailArgument = process.argv.find((argument) => argument.startsWith('--customer-email='));
  const customerEmail = emailArgument?.split('=').slice(1).join('=').trim().toLowerCase();
  if (!customerEmail) throw new Error('A test customer email is required.');

  const testCustomers = await User.find({ email: customerEmail }).select('_id');
  const customerIds = testCustomers.map((customer) => customer._id);
  const orders = await Order.find({ customer: { $in: customerIds } }).select('_id orderNumber items inventoryApplied inventoryRestored razorpay');
  if (!orders.length) {
    console.log(JSON.stringify({ success: true, message: `No orders found for ${customerEmail}.` }, null, 2));
    return;
  }
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
  };

  const remainingOrders = await Order.find({}).select('orderNumber');
  const maximumByYear = new Map();
  remainingOrders.forEach((order) => {
    const match = /^AMR-(\d{4})-(\d+)$/.exec(order.orderNumber);
    if (match) maximumByYear.set(match[1], Math.max(maximumByYear.get(match[1]) || 0, Number(match[2])));
  });
  await Counter.deleteMany({ key: /^order-\d{4}$/ });
  if (maximumByYear.size) {
    await Counter.insertMany([...maximumByYear].map(([year, sequence]) => ({ key: `order-${year}`, sequence })));
  }
  results.countersReset = true;

  console.log(JSON.stringify({ success: true, customerEmail, inventoryRestoredForOrders: orders.filter((order) => order.inventoryApplied && !order.inventoryRestored).length, deleted: results }, null, 2));
}

clearTestOrders()
  .catch((error) => {
    console.error(error.message || 'Unable to clear test orders.');
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await disconnectDatabase();
  });
