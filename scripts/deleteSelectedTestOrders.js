import mongoose from 'mongoose';
import '../src/config/env.js';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import AdminAudit from '../src/models/AdminAudit.js';
import EmailNotification from '../src/models/EmailNotification.js';
import Notification from '../src/models/Notification.js';
import Order from '../src/models/Order.js';
import OrderIssue from '../src/models/OrderIssue.js';
import RazorpayWebhookEvent from '../src/models/RazorpayWebhookEvent.js';
import Refund from '../src/models/Refund.js';

const execute = process.argv.includes('--execute');
const emailArg = process.argv.find((argument) => argument.startsWith('--customer-email='));
const orderNumbersArg = process.argv.find((argument) => argument.startsWith('--order-numbers='));
const customerEmail = emailArg?.slice('--customer-email='.length).trim().toLowerCase();
const orderNumbers = orderNumbersArg?.slice('--order-numbers='.length).split(',').map((value) => value.trim().toUpperCase()).filter(Boolean);

function relatedFilters(orders) {
  const orderIds = orders.map((order) => order._id);
  const numbers = orders.map((order) => order.orderNumber);
  const razorpayOrderIds = orders.map((order) => order.razorpay?.orderId).filter(Boolean);
  const razorpayPaymentIds = orders.map((order) => order.razorpay?.paymentId).filter(Boolean);

  return {
    notifications: { order: { $in: orderIds } },
    emails: { $or: [{ order: { $in: orderIds } }, { orderNumber: { $in: numbers } }] },
    refunds: { order: { $in: orderIds } },
    issues: { order: { $in: orderIds } },
    audits: { order: { $in: orderIds } },
    webhooks: {
      $or: [
        { razorpayOrderId: { $in: razorpayOrderIds } },
        { razorpayPaymentId: { $in: razorpayPaymentIds } },
      ],
    },
  };
}

async function removeSelectedTestOrders() {
  if (!customerEmail || !orderNumbers?.length || new Set(orderNumbers).size !== orderNumbers.length) {
    throw new Error('Provide --customer-email and a unique comma-separated --order-numbers list.');
  }

  if (orderNumbers.some((orderNumber) => !/^AMR-\d{4}-\d{6}$/.test(orderNumber))) {
    throw new Error('Every order number must use the AMR-YYYY-NNNNNN format.');
  }

  await connectDatabase();

  const orders = await Order.find({ orderNumber: { $in: orderNumbers } })
    .populate('customer', 'email')
    .select('orderNumber customer total paymentStatus orderStatus inventoryApplied inventoryRestored razorpay')
    .lean();

  const foundNumbers = new Set(orders.map((order) => order.orderNumber));
  const missingNumbers = orderNumbers.filter((orderNumber) => !foundNumbers.has(orderNumber));
  if (missingNumbers.length) {
    throw new Error(`No matching order found for: ${missingNumbers.join(', ')}`);
  }

  const mismatchedCustomers = orders.filter((order) => order.customer?.email?.toLowerCase() !== customerEmail);
  if (mismatchedCustomers.length) {
    throw new Error('Refusing cleanup: one or more orders do not belong to the specified customer email.');
  }

  const unsafeOrders = orders.filter((order) =>
    !['pending', 'failed'].includes(order.paymentStatus) ||
    Boolean(order.razorpay?.paymentId) ||
    (order.inventoryApplied && !order.inventoryRestored),
  );
  if (unsafeOrders.length) {
    throw new Error(`Refusing cleanup: unsafe payment or inventory state on ${unsafeOrders.map((order) => order.orderNumber).join(', ')}.`);
  }

  const filters = relatedFilters(orders);
  const [notifications, emails, refunds, issues, audits, webhooks] = await Promise.all([
    Notification.countDocuments(filters.notifications),
    EmailNotification.countDocuments(filters.emails),
    Refund.countDocuments(filters.refunds),
    OrderIssue.countDocuments(filters.issues),
    AdminAudit.countDocuments(filters.audits),
    RazorpayWebhookEvent.countDocuments(filters.webhooks),
  ]);

  console.log(JSON.stringify({
    mode: execute ? 'EXECUTE' : 'DRY RUN',
    customerEmail,
    orders: orders.map((order) => ({
      orderNumber: order.orderNumber,
      total: order.total,
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
      inventoryApplied: Boolean(order.inventoryApplied),
      inventoryRestored: Boolean(order.inventoryRestored),
    })),
    relatedRecords: { notifications, emails, refunds, issues, audits, webhooks },
  }, null, 2));

  if (!execute) {
    console.log('Dry run complete. No records were changed. Rerun with --execute only after reviewing this exact preview.');
    return;
  }

  if (refunds) {
    throw new Error('Refusing cleanup: related refund records exist and must be retained.');
  }

  const deleted = {
    notifications: (await Notification.deleteMany(filters.notifications)).deletedCount,
    emails: (await EmailNotification.deleteMany(filters.emails)).deletedCount,
    issues: (await OrderIssue.deleteMany(filters.issues)).deletedCount,
    audits: (await AdminAudit.deleteMany(filters.audits)).deletedCount,
    webhooks: (await RazorpayWebhookEvent.deleteMany(filters.webhooks)).deletedCount,
    orders: (await Order.deleteMany({ _id: { $in: orders.map((order) => order._id) } })).deletedCount,
  };

  const remaining = await Order.countDocuments({ orderNumber: { $in: orderNumbers } });
  if (remaining) {
    throw new Error(`Cleanup verification failed: ${remaining} targeted order(s) remain.`);
  }

  console.log('Cleanup complete:', JSON.stringify(deleted));
}

removeSelectedTestOrders()
  .catch((error) => {
    console.error(error.message || 'Unable to remove selected test orders.');
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await disconnectDatabase();
  });