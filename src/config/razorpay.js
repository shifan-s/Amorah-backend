import Razorpay from 'razorpay';
import env from './env.js';

let razorpayInstance = null;

export function isRazorpayConfigured() {
  return Boolean(env.razorpayKeyId && env.razorpayKeySecret);
}

export function isRazorpayWebhookConfigured() {
  return Boolean(env.razorpayWebhookSecret);
}

export function getRazorpayClient() {
  if (!isRazorpayConfigured()) {
    return null;
  }

  if (!razorpayInstance) {
    razorpayInstance = new Razorpay({
      key_id: env.razorpayKeyId,
      key_secret: env.razorpayKeySecret,
    });
  }

  return razorpayInstance;
}

export default getRazorpayClient;
