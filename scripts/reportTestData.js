import '../src/config/env.js';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import Category from '../src/models/Category.js';
import EmailNotification from '../src/models/EmailNotification.js';
import Order from '../src/models/Order.js';
import Product from '../src/models/Product.js';
import RazorpayWebhookEvent from '../src/models/RazorpayWebhookEvent.js';
import Refund from '../src/models/Refund.js';
import User from '../src/models/User.js';

const testPattern = /(test|demo|sample|dummy|example|seed|razorpay|sandbox)/i;

async function count(model, filter) {
  return model.countDocuments(filter);
}

async function reportTestData() {
  await connectDatabase();

  try {
    const report = {
      users: await count(User, {
        $or: [{ email: testPattern }, { fullName: testPattern }],
      }),
      categories: await count(Category, {
        $or: [{ name: testPattern }, { slug: testPattern }],
      }),
      products: await count(Product, {
        $or: [{ name: testPattern }, { slug: testPattern }, { sku: testPattern }],
      }),
      orders: await count(Order, {
        $or: [{ customerNotes: testPattern }, { paymentReviewReason: testPattern }],
      }),
      refunds: await count(Refund, {
        $or: [{ reason: testPattern }, { failureReason: testPattern }],
      }),
      emailNotifications: await count(EmailNotification, {
        $or: [{ recipient: testPattern }, { orderNumber: testPattern }],
      }),
      webhookEvents: await count(RazorpayWebhookEvent, {
        $or: [{ eventId: testPattern }, { eventType: testPattern }],
      }),
    };

    console.log('Likely development/test data counts:');
    Object.entries(report).forEach(([label, value]) => {
      console.log(`${label}: ${value}`);
    });
    console.log('No records were modified or deleted.');
  } finally {
    await disconnectDatabase();
  }
}

reportTestData().catch(async (error) => {
  console.error(error.message || 'Unable to report test data.');
  await disconnectDatabase();
  process.exit(1);
});

