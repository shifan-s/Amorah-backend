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

// Snapshot approved for cleanup: the 35 orders visible in the admin list on 6 August 2026.
// Both the allow-list and date boundary are intentional safeguards against deleting future orders.
const testOrderNumbers = Array.from(
  { length: 35 },
  (_, index) => `AMR-2026-${String(index + 1).padStart(6, '0')}`,
);
const snapshotCutoff = new Date('2026-08-06T23:59:59.999+05:30');
const testOrderFilter = {
  orderNumber: { $in: testOrderNumbers },
  createdAt: { $lte: snapshotCutoff },
};

function relatedFilters(orders) {
  const orderIds = orders.map((order) => order._id);
  const orderNumbers = orders.map((order) => order.orderNumber);
  const razorpayOrderIds = orders.map((order) => order.razorpay?.orderId).filter(Boolean);
  const razorpayPaymentIds = orders.map((order) => order.razorpay?.paymentId).filter(Boolean);

  return {
    orderIds,
    notifications: { order: { $in: orderIds } },
    emails: {
      $or: [{ order: { $in: orderIds } }, { orderNumber: { $in: orderNumbers } }],
    },
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

async function getRelatedCounts(filters) {
  const [notifications, emails, refunds, issues, audits, webhooks] = await Promise.all([
    Notification.countDocuments(filters.notifications),
    EmailNotification.countDocuments(filters.emails),
    Refund.countDocuments(filters.refunds),
    OrderIssue.countDocuments(filters.issues),
    AdminAudit.countDocuments(filters.audits),
    RazorpayWebhookEvent.countDocuments(filters.webhooks),
  ]);

  return { notifications, emails, refunds, issues, audits, webhooks };
}

async function deleteTestOrders() {
  await connectDatabase();

  const orders = await Order.find(testOrderFilter)
    .populate('customer', 'fullName email')
    .sort({ createdAt: 1 })
    .select('orderNumber customer total currency paymentStatus orderStatus razorpay createdAt')
    .lean();

  console.log('\nTest-order cleanup preview');
  console.log(`Mode: ${execute ? 'EXECUTE' : 'DRY RUN'}`);
  console.log(`Safety boundary: ${testOrderNumbers[0]} to ${testOrderNumbers.at(-1)}`);
  console.log(`Created no later than: ${snapshotCutoff.toISOString()}`);
  console.log(`Matching orders: ${orders.length}`);

  if (orders.length > 0) {
    console.table(
      orders.map((order) => ({
        orderNumber: order.orderNumber,
        createdAt: order.createdAt.toISOString(),
        customer: order.customer?.fullName || 'Unknown customer',
        email: order.customer?.email || 'Unavailable',
        total: `${order.currency || 'INR'} ${order.total}`,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        razorpayOrderId: order.razorpay?.orderId || '',
        razorpayPaymentId: order.razorpay?.paymentId || '',
      })),
    );
  }

  const filters = relatedFilters(orders);
  const relatedCounts = await getRelatedCounts(filters);
  console.log('Related records:', relatedCounts);

  if (!execute) {
    console.log('\nDry run complete. No records were changed.');
    console.log('Run again with --execute to permanently delete this exact snapshot.');
    return;
  }

  if (orders.length === 0) {
    console.log('\nNo matching test orders remain. Nothing was deleted.');
    return;
  }

  // Delete dependent records first so no related test records are orphaned.
  // Products, users, counters, inventory, categories, carts, and settings are untouched.
  const deleted = {
    notifications: (await Notification.deleteMany(filters.notifications)).deletedCount,
    emails: (await EmailNotification.deleteMany(filters.emails)).deletedCount,
    refunds: (await Refund.deleteMany(filters.refunds)).deletedCount,
    issues: (await OrderIssue.deleteMany(filters.issues)).deletedCount,
    audits: (await AdminAudit.deleteMany(filters.audits)).deletedCount,
    webhooks: (await RazorpayWebhookEvent.deleteMany(filters.webhooks)).deletedCount,
    orders: (await Order.deleteMany({ _id: { $in: filters.orderIds } })).deletedCount,
  };

  const remainingTestOrders = await Order.countDocuments(testOrderFilter);
  console.log('\nCleanup complete:', deleted);
  console.log(`Matching test orders remaining: ${remainingTestOrders}`);

  if (remainingTestOrders !== 0) {
    throw new Error('Cleanup verification failed: matching test orders still remain.');
  }
}

deleteTestOrders()
  .catch((error) => {
    console.error('\nTest-order cleanup failed.');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      try {
        await disconnectDatabase();
      } catch (error) {
        console.error('Unable to close the MongoDB connection cleanly.');
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
      }
    }
  });
