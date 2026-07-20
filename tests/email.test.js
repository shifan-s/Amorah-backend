import assert from 'node:assert/strict';
import test from 'node:test';
import env from '../src/config/env.js';
import orderConfirmationEmail from '../src/templates/email/orderConfirmationEmail.js';
import cancellationRejectedEmail from '../src/templates/email/cancellationRejectedEmail.js';
import { buildFrontendUrl, escapeHtml, formatEmailCurrency } from '../src/utils/emailHtml.js';
import { sendOrderConfirmationEmail } from '../src/services/emailService.js';

function sampleOrder(overrides = {}) {
  return {
    _id: '507f1f77bcf86cd799439011',
    orderNumber: 'AMR-2026-000001',
    createdAt: new Date('2026-07-18T06:00:00.000Z'),
    customer: {
      fullName: 'Nisha <Rao>',
      email: 'nisha@example.com',
      mobile: '9876543210',
    },
    items: [
      {
        productName: 'Ivory Kurta <script>',
        colourName: 'Pearl & Rose',
        size: 'M',
        quantity: 1,
        unitPrice: 1599,
        lineTotal: 1599,
      },
    ],
    shippingAddress: {
      fullName: 'Nisha <Rao>',
      mobile: '9876543210',
      addressLine1: '12 Cotton Lane',
      addressLine2: 'Apt "4"',
      landmark: "Near Women's Studio",
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400001',
      country: 'India',
    },
    subtotal: 1599,
    shippingCharge: 0,
    tax: 0,
    total: 1599,
    paymentStatus: 'paid',
    orderStatus: 'confirmed',
    inventoryApplied: true,
    razorpay: {
      checkoutSignatureVerified: true,
      webhookVerified: false,
    },
    ...overrides,
  };
}

test('escapes user-provided HTML for email templates', () => {
  assert.equal(escapeHtml(`A&B <x> "quote" 'single'`), 'A&amp;B &lt;x&gt; &quot;quote&quot; &#39;single&#39;');
});

test('formats email currency as INR', () => {
  assert.equal(formatEmailCurrency(1599), '₹1,599');
});

test('builds frontend URLs from configured host only', () => {
  env.frontendUrl = 'https://amorah.example.com/';
  assert.equal(buildFrontendUrl('/account/orders/AMR-2026-000001'), 'https://amorah.example.com/account/orders/AMR-2026-000001');
});

test('order confirmation template excludes payment secrets and escapes product text', () => {
  const built = orderConfirmationEmail(sampleOrder());

  assert.match(built.subject, /AMR-2026-000001/);
  assert.match(built.html, /Ivory Kurta &lt;script&gt;/);
  assert.doesNotMatch(built.html, /razorpay_signature|RAZORPAY_KEY_SECRET|checkoutSignatureVerified/i);
  assert.match(built.text, /Ivory Kurta <script>/);
});

test('customer cancellation decision template does not expose private admin notes', () => {
  const built = cancellationRejectedEmail(
    sampleOrder({
      cancellation: {
        customerResponse: 'We cannot cancel because the parcel has shipped.',
        privateAdminNotes: 'Internal fraud review note',
      },
    }),
  );

  assert.doesNotMatch(built.html, /Internal fraud review note/);
  assert.doesNotMatch(built.text, /Internal fraud review note/);
});

test('order confirmation email is blocked for pending or review orders before touching SMTP', async () => {
  const result = await sendOrderConfirmationEmail(
    sampleOrder({
      paymentStatus: 'pending',
      orderStatus: 'pending_payment',
      inventoryApplied: false,
    }),
  );

  assert.equal(result.skipped, true);
});
