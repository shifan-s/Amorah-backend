import env from '../config/env.js';
import { getMailer, isEmailConfigured } from '../config/mailer.js';
import EmailNotification from '../models/EmailNotification.js';
import Order from '../models/Order.js';
import { isValidHttpUrl } from '../utils/emailHtml.js';
import cancellationApprovedEmail from '../templates/email/cancellationApprovedEmail.js';
import cancellationRejectedEmail from '../templates/email/cancellationRejectedEmail.js';
import cancellationRequestedAdminEmail from '../templates/email/cancellationRequestedAdminEmail.js';
import cancellationRequestedCustomerEmail from '../templates/email/cancellationRequestedCustomerEmail.js';
import orderConfirmationEmail from '../templates/email/orderConfirmationEmail.js';
import orderDeliveredEmail from '../templates/email/orderDeliveredEmail.js';
import orderOutForDeliveryEmail from '../templates/email/orderOutForDeliveryEmail.js';
import orderShippedEmail from '../templates/email/orderShippedEmail.js';
import refundFailedEmail from '../templates/email/refundFailedEmail.js';
import refundInitiatedEmail from '../templates/email/refundInitiatedEmail.js';
import refundProcessedEmail from '../templates/email/refundProcessedEmail.js';

const eventConfig = {
  order_confirmation: {
    suffix: 'confirmation',
    template: orderConfirmationEmail,
    recipient: 'customer',
  },
  order_shipped: {
    suffix: 'shipped',
    template: orderShippedEmail,
    recipient: 'customer',
  },
  order_out_for_delivery: {
    suffix: 'out-for-delivery',
    template: orderOutForDeliveryEmail,
    recipient: 'customer',
  },
  order_delivered: {
    suffix: 'delivered',
    template: orderDeliveredEmail,
    recipient: 'customer',
  },
  cancellation_requested_customer: {
    suffix: 'cancellation-request-customer',
    template: cancellationRequestedCustomerEmail,
    recipient: 'customer',
  },
  cancellation_requested_admin: {
    suffix: 'cancellation-request-admin',
    template: cancellationRequestedAdminEmail,
    recipient: 'admin',
  },
  cancellation_approved: {
    suffix: 'cancellation-approved',
    template: cancellationApprovedEmail,
    recipient: 'customer',
  },
  cancellation_rejected: {
    suffix: 'cancellation-rejected',
    template: cancellationRejectedEmail,
    recipient: 'customer',
  },
  refund_initiated: {
    suffix: 'refund-initiated',
    template: refundInitiatedEmail,
    recipient: 'customer',
  },
  refund_processed: {
    suffix: 'refund-processed',
    template: refundProcessedEmail,
    recipient: 'customer',
  },
  refund_failed: {
    suffix: 'refund-failed',
    template: refundFailedEmail,
    recipient: 'customer',
  },
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function now() {
  return new Date();
}

function safeError(error) {
  return String(error?.message || error || 'Email delivery failed')
    .replace(env.smtpPass || '__never_match__', '[redacted]')
    .slice(0, 500);
}

function dedupeKey(order, suffix) {
  return `order:${order._id.toString()}:${suffix}`;
}

function isValidEmail(value = '') {
  return emailPattern.test(String(value).trim());
}

async function loadOrder(orderOrId) {
  if (!orderOrId) {
    return null;
  }

  if (orderOrId.items && orderOrId.orderNumber) {
    if (orderOrId.customer?.email) {
      return orderOrId;
    }

    return Order.findById(orderOrId._id || orderOrId.id).populate('customer', 'fullName email mobile');
  }

  return Order.findById(orderOrId).populate('customer', 'fullName email mobile');
}

function resolveRecipient(order, recipientType) {
  if (recipientType === 'admin') {
    return env.adminOrderEmail;
  }

  return order.customer?.email || order.customerEmail || '';
}

async function createSkippedNotification({ order, eventType, key, recipient, reason }) {
  const notification = await EmailNotification.findOneAndUpdate(
    { dedupeKey: key },
    {
      $setOnInsert: {
        order: order._id,
        orderNumber: order.orderNumber,
        customer: order.customer?._id || order.customer || null,
        recipient: recipient || 'unresolved',
        eventType,
        dedupeKey: key,
      },
      $set: {
        status: 'skipped',
        lastError: reason,
        subject: '',
      },
    },
    { new: true, upsert: true },
  );

  return {
    sent: false,
    skipped: true,
    notificationId: notification._id.toString(),
    reason,
  };
}

export async function sendEmailNotification({ order: orderOrId, eventType, forceRetry = false }) {
  const config = eventConfig[eventType];

  if (!config) {
    return { sent: false, skipped: true, reason: 'Unsupported email event type.' };
  }

  const order = await loadOrder(orderOrId);

  if (!order) {
    return { sent: false, skipped: true, reason: 'Order not found for email notification.' };
  }

  const key = dedupeKey(order, config.suffix);
  const existing = await EmailNotification.findOne({ dedupeKey: key });

  if (existing?.status === 'sent') {
    return {
      sent: true,
      duplicate: true,
      notificationId: existing._id.toString(),
    };
  }

  if (existing?.status === 'sending' && !forceRetry) {
    return {
      sent: false,
      skipped: true,
      notificationId: existing._id.toString(),
      reason: 'Email notification is already being sent.',
    };
  }

  const recipient = resolveRecipient(order, config.recipient);

  if (!env.emailEnabled) {
    return createSkippedNotification({
      order,
      eventType,
      key,
      recipient,
      reason: 'Transactional email is disabled.',
    });
  }

  if (!isEmailConfigured()) {
    return createSkippedNotification({
      order,
      eventType,
      key,
      recipient,
      reason: 'SMTP email is not configured.',
    });
  }

  if (!isValidEmail(recipient)) {
    return createSkippedNotification({
      order,
      eventType,
      key,
      recipient,
      reason: config.recipient === 'admin' ? 'Admin order email is missing or invalid.' : 'Customer email is missing or invalid.',
    });
  }

  if (eventType === 'order_shipped' && order.shipment?.trackingUrl && !isValidHttpUrl(order.shipment.trackingUrl)) {
    order.shipment.trackingUrl = '';
  }

  const built = config.template(order);
  const notification = await EmailNotification.findOneAndUpdate(
    { dedupeKey: key },
    {
      $setOnInsert: {
        order: order._id,
        orderNumber: order.orderNumber,
        customer: order.customer?._id || order.customer || null,
        recipient,
        eventType,
        dedupeKey: key,
      },
      $set: {
        status: 'sending',
        subject: built.subject,
        lastAttemptAt: now(),
        lastError: '',
      },
      $inc: { attempts: 1 },
    },
    { new: true, upsert: true },
  );

  try {
    const info = await getMailer().sendMail({
      from: {
        name: env.emailFromName,
        address: env.emailFromAddress,
      },
      to: recipient,
      replyTo: env.emailReplyTo || env.supportEmail || undefined,
      subject: built.subject,
      html: built.html,
      text: built.text,
    });

    notification.status = 'sent';
    notification.messageId = info.messageId || '';
    notification.sentAt = now();
    notification.lastError = '';
    await notification.save();

    return {
      sent: true,
      notificationId: notification._id.toString(),
      messageId: notification.messageId,
    };
  } catch (error) {
    notification.status = 'failed';
    notification.lastError = safeError(error);
    await notification.save();
    console.warn(`Email ${eventType} for ${order.orderNumber} failed: ${notification.lastError}`);

    return {
      sent: false,
      failed: true,
      notificationId: notification._id.toString(),
      reason: notification.lastError,
    };
  }
}

export async function retryFailedEmailNotification(notificationId) {
  const notification = await EmailNotification.findById(notificationId);

  if (!notification) {
    return null;
  }

  if (notification.status === 'sent') {
    return {
      sent: true,
      duplicate: true,
      notificationId: notification._id.toString(),
      reason: 'Email notification has already been sent.',
    };
  }

  if (!['failed', 'skipped'].includes(notification.status)) {
    return {
      sent: false,
      skipped: true,
      notificationId: notification._id.toString(),
      reason: 'Only failed or skipped notifications can be retried.',
    };
  }

  return sendEmailNotification({
    order: notification.order,
    eventType: notification.eventType,
    forceRetry: true,
  });
}

export function sendOrderConfirmationEmail(order) {
  if (
    order.paymentStatus !== 'paid' ||
    order.orderStatus !== 'confirmed' ||
    !order.inventoryApplied ||
    !(order.razorpay?.checkoutSignatureVerified || order.razorpay?.webhookVerified)
  ) {
    return Promise.resolve({ sent: false, skipped: true, reason: 'Order is not eligible for confirmation email.' });
  }

  return sendEmailNotification({ order, eventType: 'order_confirmation' });
}

export function sendOrderShippedEmail(order) {
  if (order.orderStatus !== 'shipped') {
    return Promise.resolve({ sent: false, skipped: true, reason: 'Order is not shipped.' });
  }

  return sendEmailNotification({ order, eventType: 'order_shipped' });
}

export function sendOrderOutForDeliveryEmail(order) {
  if (order.orderStatus !== 'out_for_delivery') {
    return Promise.resolve({ sent: false, skipped: true, reason: 'Order is not out for delivery.' });
  }

  return sendEmailNotification({ order, eventType: 'order_out_for_delivery' });
}

export function sendOrderDeliveredEmail(order) {
  if (order.orderStatus !== 'delivered') {
    return Promise.resolve({ sent: false, skipped: true, reason: 'Order is not delivered.' });
  }

  return sendEmailNotification({ order, eventType: 'order_delivered' });
}

export function sendCancellationRequestedCustomerEmail(order) {
  return sendEmailNotification({ order, eventType: 'cancellation_requested_customer' });
}

export function sendCancellationRequestedAdminEmail(order) {
  return sendEmailNotification({ order, eventType: 'cancellation_requested_admin' });
}

export function sendCancellationApprovedEmail(order) {
  return sendEmailNotification({ order, eventType: 'cancellation_approved' });
}

export function sendCancellationRejectedEmail(order) {
  return sendEmailNotification({ order, eventType: 'cancellation_rejected' });
}

export function sendRefundInitiatedEmail(order) {
  if (!['initiating', 'pending'].includes(order.refundSummary?.status)) {
    return Promise.resolve({ sent: false, skipped: true, reason: 'Refund has not been initiated.' });
  }

  return sendEmailNotification({ order, eventType: 'refund_initiated' });
}

export function sendRefundProcessedEmail(order) {
  if (order.refundSummary?.status !== 'processed') {
    return Promise.resolve({ sent: false, skipped: true, reason: 'Refund is not processed.' });
  }

  return sendEmailNotification({ order, eventType: 'refund_processed' });
}

export function sendRefundFailedEmail(order) {
  if (order.refundSummary?.status !== 'failed') {
    return Promise.resolve({ sent: false, skipped: true, reason: 'Refund is not failed.' });
  }

  return sendEmailNotification({ order, eventType: 'refund_failed' });
}

export async function sendStatusMilestoneEmail(order) {
  if (order.orderStatus === 'shipped') {
    return sendOrderShippedEmail(order);
  }

  if (order.orderStatus === 'out_for_delivery') {
    return sendOrderOutForDeliveryEmail(order);
  }

  if (order.orderStatus === 'delivered') {
    return sendOrderDeliveredEmail(order);
  }

  return { sent: false, skipped: true, reason: 'No email for this order status.' };
}
