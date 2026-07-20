import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import env from '../src/config/env.js';
import { amountToPaise } from '../src/services/paymentService.js';
import {
  safeSignatureCompare,
  verifyCheckoutSignature,
  verifyWebhookSignature,
} from '../src/utils/razorpaySignature.js';

test('converts rupees to Razorpay paise safely', () => {
  assert.equal(amountToPaise(1599), 159900);
  assert.equal(amountToPaise(1599.5), 159950);
  assert.throws(() => amountToPaise(0), /Payment amount is invalid/);
});

test('verifies checkout signature using stored Razorpay order ID', () => {
  env.razorpayKeySecret = 'test_checkout_secret';
  const orderId = 'order_abc123';
  const paymentId = 'pay_def456';
  const signature = crypto
    .createHmac('sha256', env.razorpayKeySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  assert.equal(
    verifyCheckoutSignature({
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: signature,
    }),
    true,
  );
  assert.equal(
    verifyCheckoutSignature({
      razorpayOrderId: 'order_wrong',
      razorpayPaymentId: paymentId,
      razorpaySignature: signature,
    }),
    false,
  );
});

test('verifies webhook signature with raw request body', () => {
  env.razorpayWebhookSecret = 'test_webhook_secret';
  const rawBody = Buffer.from('{"event":"payment.captured"}');
  const signature = crypto.createHmac('sha256', env.razorpayWebhookSecret).update(rawBody).digest('hex');

  assert.equal(verifyWebhookSignature(rawBody, signature), true);
  assert.equal(verifyWebhookSignature(Buffer.from(JSON.stringify(JSON.parse(rawBody.toString()), null, 2)), signature), false);
  assert.equal(verifyWebhookSignature(Buffer.from('{"event":"payment.failed"}'), signature), false);
});

test('compares signatures safely when lengths differ', () => {
  assert.equal(safeSignatureCompare('abcdef', 'abc'), false);
  assert.equal(safeSignatureCompare('', 'abc'), false);
});
