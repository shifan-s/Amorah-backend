import crypto from 'crypto';
import env from '../config/env.js';
import ApiError from './ApiError.js';

function hmacSha256(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

export function safeSignatureCompare(expected, received) {
  if (!expected || !received) {
    return false;
  }

  const expectedBuffer = Buffer.from(String(expected), 'hex');
  const receivedBuffer = Buffer.from(String(received), 'hex');

  if (expectedBuffer.length === 0 || expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

export function verifyCheckoutSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  if (!env.razorpayKeySecret) {
    throw new ApiError(503, 'Razorpay payment verification is not configured', []);
  }

  const expected = hmacSha256(`${razorpayOrderId}|${razorpayPaymentId}`, env.razorpayKeySecret);
  return safeSignatureCompare(expected, razorpaySignature);
}

export function verifyWebhookSignature(rawBody, signature) {
  if (!env.razorpayWebhookSecret) {
    throw new ApiError(503, 'Razorpay webhook verification is not configured', []);
  }

  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody || '');
  const expected = crypto.createHmac('sha256', env.razorpayWebhookSecret).update(body).digest('hex');

  return safeSignatureCompare(expected, signature);
}
