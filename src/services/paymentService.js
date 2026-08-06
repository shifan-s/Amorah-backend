import mongoose from 'mongoose';
import crypto from 'crypto';
import env from '../config/env.js';
import { getRazorpayClient, isRazorpayConfigured, isRazorpayWebhookConfigured } from '../config/razorpay.js';
import Cart from '../models/Cart.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import RazorpayWebhookEvent from '../models/RazorpayWebhookEvent.js';
import ApiError from '../utils/ApiError.js';
import { generateOrderNumber } from '../utils/orderNumber.js';
import { verifyCheckoutSignature, verifyWebhookSignature } from '../utils/razorpaySignature.js';
import { sendOrderConfirmationEmail } from './emailService.js';
import {
  calculateCheckoutSummary,
  resolveCheckoutAddress,
  sanitizeCustomerNotes,
  validateClientCartSelection,
  validateCheckoutSelection,
} from './checkoutService.js';

function idString(value) {
  if (!value) {
    return '';
  }

  if (value._id) {
    return value._id.toString();
  }

  return value.toString();
}

function now() {
  return new Date();
}

export function amountToPaise(amount) {
  const numericAmount = Number(amount);
  const paise = Math.round(numericAmount * 100);

  if (!Number.isSafeInteger(paise) || paise <= 0) {
    throw new ApiError(400, 'Payment amount is invalid', []);
  }

  return paise;
}

function safeFailureMessage(error, fallback = 'Payment could not be completed') {
  if (error instanceof ApiError) {
    return error.message;
  }

  return error?.error?.description || error?.description || fallback;
}

function appendTimeline(order, status, message) {
  const exists = (order.statusTimeline || []).some((event) => event.status === status && event.message === message);

  if (!exists) {
    order.statusTimeline.push({
      status,
      message,
      changedAt: now(),
    });
  }
}

function orderPaymentMessage(order) {
  if (order.paymentStatus === 'paid' && order.orderStatus === 'confirmed') {
    return 'Payment confirmed and order placed successfully';
  }

  if (order.orderStatus === 'payment_review') {
    return 'Your payment was received, but the order needs review. Please contact Amorah support.';
  }

  if (order.paymentStatus === 'failed' || order.orderStatus === 'payment_failed') {
    return order.paymentFailureReason || 'Payment failed. Your cart has not been cleared.';
  }

  return 'Your payment is being processed.';
}

function safePaymentResponse(order) {
  return {
    orderNumber: order.orderNumber,
    paymentStatus: order.paymentStatus,
    orderStatus: order.orderStatus,
    inventoryApplied: Boolean(order.inventoryApplied),
    cartCleared: Boolean(order.cartCleared),
    message: orderPaymentMessage(order),
  };
}

function safeOrderResult(order) {
  return {
    orderNumber: order.orderNumber,
    paymentStatus: order.paymentStatus,
    orderStatus: order.orderStatus,
    total: order.total,
    currency: order.currency,
    inventoryApplied: Boolean(order.inventoryApplied),
    cartCleared: Boolean(order.cartCleared),
    message: orderPaymentMessage(order),
  };
}

function orderItemPayload(item) {
  return {
    product: item.product || item.productId,
    productName: item.productName,
    productSlug: item.productSlug,
    productImage: item.productImage,
    variantId: item.variantId,
    sizeId: item.sizeId,
    sku: item.sku,
    colourName: item.colourName,
    colourHex: item.colourHex,
    size: item.size,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: item.lineTotal,
  };
}

function buildPaymentConfig(order, user, selectedAddress) {
  const priceSummary = {
    subtotal: order.subtotal,
    shippingCharge: order.shippingCharge,
    discount: 0,
    tax: order.tax,
    total: order.total,
    currency: order.currency,
  };

  return {
    keyId: env.razorpayKeyId,
    order: {
      id: order.razorpay.orderId,
      amount: amountToPaise(order.total),
      currency: order.currency,
      receipt: order.orderNumber,
    },
    orderNumber: order.orderNumber,
    orderId: order.razorpay.orderId,
    razorpayOrderId: order.razorpay.orderId,
    amount: amountToPaise(order.total),
    currency: order.currency,
    priceSummary,
    companyName: env.razorpayCompanyName,
    description: env.razorpayCompanyDescription,
    logoUrl: env.razorpayLogoUrl,
    prefill: {
      name: user.fullName || selectedAddress?.fullName || '',
      email: user.email || '',
      contact: user.mobile || selectedAddress?.mobile || '',
    },
  };
}

async function createInternalOrder(user, payload) {
  const { cart, items } = await validateCheckoutSelection(user.id, payload);
  if (payload.checkoutMode !== 'buyNow') validateClientCartSelection(payload.items, cart.items);
  const { shippingAddress, billingAddress } = resolveCheckoutAddress(user, payload);
  const customerNotes = sanitizeCustomerNotes(payload.customerNotes);
  const summary = calculateCheckoutSummary(items);
  const orderNumber = await generateOrderNumber();
  const createdAt = now();

  return Order.create({
    orderNumber,
    customer: user.id,
    checkoutSource: payload.checkoutMode === 'buyNow' ? 'buy_now' : 'cart',
    checkoutIdempotencyKey: payload.idempotencyKey,
    items: items.map(orderItemPayload),
    shippingAddress,
    billingAddress,
    subtotal: summary.subtotal,
    shippingCharge: summary.shippingCharge,
    tax: summary.tax,
    total: summary.total,
    currency: env.razorpayCurrency || summary.currency || 'INR',
    paymentMethod: 'razorpay',
    paymentStatus: 'pending',
    orderStatus: 'pending_payment',
    razorpay: {
      orderId: '',
      paymentId: '',
      checkoutSignatureVerified: false,
      webhookVerified: false,
      paidAt: null,
      lastPaymentStatus: '',
    },
    statusTimeline: [
      {
        status: 'pending_payment',
        message: 'Waiting for online payment',
        changedAt: createdAt,
      },
    ],
    customerNotes,
    inventoryApplied: false,
    cartCleared: false,
    paymentInitiatedAt: createdAt,
  });
}

async function getExistingIdempotentOrder(userId, idempotencyKey) {
  return Order.findOne({ customer: userId, checkoutIdempotencyKey: idempotencyKey });
}

export function validateRazorpayPaymentConfiguration() {
  if (!env.razorpayKeyId) {
    throw new ApiError(500, 'Razorpay Key ID is not configured on the server', []);
  }

  if (!env.razorpayKeySecret) {
    throw new ApiError(500, 'Razorpay Key Secret is not configured on the server', []);
  }

  if (!/^rzp_(test|live)_[A-Za-z0-9]+$/.test(env.razorpayKeyId)) {
    throw new ApiError(500, 'Razorpay Key ID has an invalid format on the server', []);
  }
}

export async function createRazorpayPaymentOrder(user, payload) {
  validateRazorpayPaymentConfiguration();

  let order = await getExistingIdempotentOrder(user.id, payload.idempotencyKey);

  if (order) {
    if (order.razorpay?.orderId && ['pending', 'paid'].includes(order.paymentStatus)) {
      return buildPaymentConfig(order, user, order.shippingAddress);
    }

    throw new ApiError(409, 'This payment attempt cannot be reused. Please start a new payment attempt.', []);
  }

  try {
    order = await createInternalOrder(user, payload);
  } catch (error) {
    if (error?.code === 11000) {
      order = await getExistingIdempotentOrder(user.id, payload.idempotencyKey);
      if (order?.razorpay?.orderId) {
        return buildPaymentConfig(order, user, order.shippingAddress);
      }
    }

    if (!order) {
      throw error;
    }
  }

  const razorpay = getRazorpayClient();
  const amount = amountToPaise(order.total);

  try {
    const razorpayOrder = await razorpay.orders.create({
      amount,
      currency: order.currency,
      receipt: order.orderNumber,
      notes: {
        amorahOrderNumber: order.orderNumber,
      },
    });

    order.razorpay.orderId = razorpayOrder.id;
    order.paymentInitiatedAt = now();
    await order.save();

    if (env.nodeEnv === 'development') {
      console.info(`[Razorpay] Calculated total: INR ${order.total}`);
      console.info(`[Razorpay] Order amount: ${amount} paise`);
      console.info(`[Razorpay] Order ID: ${razorpayOrder.id}`);
    }

    return buildPaymentConfig(order, user, order.shippingAddress);
  } catch (error) {
    order.paymentStatus = 'failed';
    order.orderStatus = 'payment_failed';
    order.paymentFailureReason = safeFailureMessage(error, 'Unable to create secure Razorpay order');
    appendTimeline(order, 'payment_failed', 'Unable to create secure Razorpay order');
    await order.save();

    throw new ApiError(502, 'Unable to create secure payment order. Please try again.', []);
  }
}

export async function fetchAndValidateRazorpayPayment(order, razorpayPaymentId) {
  if (!isRazorpayConfigured()) {
    throw new ApiError(503, 'Razorpay payment verification is not configured', []);
  }

  const razorpay = getRazorpayClient();
  const payment = await razorpay.payments.fetch(razorpayPaymentId);
  const expectedAmount = amountToPaise(order.total);

  if (payment.order_id !== order.razorpay.orderId) {
    throw new ApiError(400, 'Payment does not belong to this order', []);
  }

  if (Number(payment.amount) !== expectedAmount) {
    throw new ApiError(400, 'Payment amount does not match the order total', []);
  }

  if (payment.currency !== order.currency) {
    throw new ApiError(400, 'Payment currency does not match the order currency', []);
  }

  return payment;
}

async function markPaymentReview(orderId, reason) {
  const order = await Order.findById(orderId);

  if (!order) {
    return null;
  }

  order.paymentStatus = 'paid';
  order.orderStatus = 'payment_review';
  order.inventoryApplied = false;
  order.paymentReviewReason = reason;
  order.paymentCompletedAt = order.paymentCompletedAt || now();
  appendTimeline(order, 'payment_review', reason);
  await order.save();

  return order;
}

async function deductInventory(order, session) {
  for (const item of order.items) {
    const result = await Product.updateOne(
      {
        _id: item.product,
        status: 'active',
        variants: {
          $elemMatch: {
            _id: item.variantId,
            active: true,
            sizes: {
              $elemMatch: {
                _id: item.sizeId,
                active: true,
                stock: { $gte: item.quantity },
              },
            },
          },
        },
      },
      {
        $inc: {
          'variants.$[variant].sizes.$[size].stock': -item.quantity,
          salesCount: item.quantity,
        },
      },
      {
        arrayFilters: [
          { 'variant._id': item.variantId, 'variant.active': true },
          { 'size._id': item.sizeId, 'size.active': true, 'size.stock': { $gte: item.quantity } },
        ],
        ...(session ? { session } : {}),
      },
    );

    if (result.modifiedCount !== 1) {
      throw new ApiError(409, 'Stock changed while the payment was being completed.', []);
    }
  }
}

async function processPurchasedCartItems(order, session) {
  const query = Cart.findOne({ user: order.customer });
  const cart = session ? await query.session(session) : await query;

  if (!cart) {
    return;
  }

  for (const purchased of order.items) {
    const item = cart.items.find(
      (cartItem) =>
        idString(cartItem.product) === idString(purchased.product) &&
        idString(cartItem.variantId) === idString(purchased.variantId) &&
        idString(cartItem.sizeId) === idString(purchased.sizeId),
    );

    if (!item) {
      continue;
    }

    if (item.quantity <= purchased.quantity) {
      cart.items.pull(item._id);
    } else {
      item.quantity -= purchased.quantity;
    }
  }

  await cart.save(session ? { session } : undefined);
}

async function finalizePaidOrderWithSession({
  orderId,
  razorpayOrderId,
  razorpayPaymentId,
  verifiedByCheckout = false,
  verifiedByWebhook = false,
  lastPaymentStatus = 'captured',
  session,
}) {
  const order = session ? await Order.findById(orderId).session(session) : await Order.findById(orderId);

  if (!order) {
    throw new ApiError(404, 'Order not found', []);
  }

  if (order.paymentStatus === 'paid' && order.inventoryApplied && order.cartCleared) {
    return order;
  }

  if (order.razorpay.orderId !== razorpayOrderId) {
    throw new ApiError(400, 'Razorpay order ID mismatch', []);
  }

  if (order.razorpay.paymentId && order.razorpay.paymentId !== razorpayPaymentId) {
    throw new ApiError(400, 'Razorpay payment ID mismatch', []);
  }

  await deductInventory(order, session);

  order.inventoryApplied = true;
  order.inventoryAppliedAt = now();
  order.paymentStatus = 'paid';
  order.orderStatus = 'confirmed';
  order.razorpay.paymentId = razorpayPaymentId;
  order.razorpay.checkoutSignatureVerified =
    order.razorpay.checkoutSignatureVerified || Boolean(verifiedByCheckout);
  order.razorpay.webhookVerified = order.razorpay.webhookVerified || Boolean(verifiedByWebhook);
  order.razorpay.lastPaymentStatus = lastPaymentStatus;
  order.razorpay.paidAt = order.razorpay.paidAt || now();
  order.paymentCompletedAt = order.paymentCompletedAt || now();
  order.paymentFailureReason = '';
  order.paymentReviewReason = '';
  appendTimeline(order, 'confirmed', 'Payment verified and order confirmed');

  if (order.checkoutSource !== 'buy_now') {
    await processPurchasedCartItems(order, session);
  }

  order.cartCleared = true;
  order.cartClearedAt = now();
  await order.save(session ? { session } : undefined);

  return order;
}

function isTransactionUnsupported(error) {
  return /Transaction numbers are only allowed|replica set member|Transaction.*not supported/i.test(error?.message || '');
}

async function sendConfirmationAfterFinalize(order) {
  if (
    order?.paymentStatus !== 'paid' ||
    order?.orderStatus !== 'confirmed' ||
    !order?.inventoryApplied
  ) {
    return;
  }

  try {
    await sendOrderConfirmationEmail(order);
  } catch (error) {
    console.warn(`Order confirmation email for ${order.orderNumber} failed: ${safeFailureMessage(error)}`);
  }
}

export async function finalizePaidOrder(payload) {
  const session = await mongoose.startSession();

  try {
    let finalizedOrder;
    await session.withTransaction(async () => {
      finalizedOrder = await finalizePaidOrderWithSession({ ...payload, session });
    });
    await sendConfirmationAfterFinalize(finalizedOrder);
    return finalizedOrder;
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 409) {
      return markPaymentReview(payload.orderId, error.message);
    }

    if (isTransactionUnsupported(error)) {
      try {
        const finalizedOrder = await finalizePaidOrderWithSession({ ...payload, session: null });
        await sendConfirmationAfterFinalize(finalizedOrder);
        return finalizedOrder;
      } catch (fallbackError) {
        if (fallbackError instanceof ApiError && fallbackError.statusCode === 409) {
          return markPaymentReview(payload.orderId, fallbackError.message);
        }

        throw fallbackError;
      }
    }

    throw error;
  } finally {
    await session.endSession();
  }
}

export async function markPaymentFailure(order, reason = 'Payment failed') {
  if (!order || order.paymentStatus === 'paid') {
    return order;
  }

  order.paymentStatus = 'failed';
  order.orderStatus = 'payment_failed';
  order.paymentFailureReason = String(reason).slice(0, 500);
  appendTimeline(order, 'payment_failed', order.paymentFailureReason);
  await order.save();

  return order;
}

export async function verifyRazorpayPayment(userId, payload) {
  const order = await Order.findOne({ customer: userId, orderNumber: payload.orderNumber });

  if (!order) {
    throw new ApiError(404, 'Order not found', []);
  }

  if (order.paymentStatus === 'paid' && order.inventoryApplied && order.cartCleared) {
    return safeOrderResult(order);
  }

  if (payload.razorpay_order_id !== order.razorpay.orderId) {
    throw new ApiError(400, 'Razorpay order ID mismatch', []);
  }

  const signatureValid = verifyCheckoutSignature({
    razorpayOrderId: order.razorpay.orderId,
    razorpayPaymentId: payload.razorpay_payment_id,
    razorpaySignature: payload.razorpay_signature,
  });

  if (!signatureValid) {
    throw new ApiError(400, 'Payment signature verification failed', []);
  }

  const paymentOwner = await Order.findOne({
    'razorpay.paymentId': payload.razorpay_payment_id,
    _id: { $ne: order._id },
  }).select('_id');

  if (paymentOwner) {
    throw new ApiError(409, 'This Razorpay payment is already linked to another order', []);
  }

  order.razorpay.checkoutSignatureVerified = true;
  order.razorpay.paymentId = payload.razorpay_payment_id;
  try {
    await order.save();
  } catch (error) {
    if (error?.code === 11000) {
      throw new ApiError(409, 'This Razorpay payment is already linked to another order', []);
    }
    throw error;
  }

  const payment = await fetchAndValidateRazorpayPayment(order, payload.razorpay_payment_id);
  order.razorpay.lastPaymentStatus = payment.status;
  await order.save();

  if (payment.status === 'captured') {
    const finalizedOrder = await finalizePaidOrder({
      orderId: order._id,
      razorpayOrderId: order.razorpay.orderId,
      razorpayPaymentId: payload.razorpay_payment_id,
      verifiedByCheckout: true,
      lastPaymentStatus: payment.status,
    });

    return safeOrderResult(finalizedOrder);
  }

  if (payment.status === 'failed') {
    const failedOrder = await markPaymentFailure(order, payment.error_description || 'Payment failed');
    return safeOrderResult(failedOrder);
  }

  return {
    ...safeOrderResult(order),
    message: 'Your payment is being processed.',
  };
}

export async function getPaymentStatus(userId, orderNumber) {
  const order = await Order.findOne({ customer: userId, orderNumber });

  if (!order) {
    throw new ApiError(404, 'Order not found', []);
  }

  if (order.paymentStatus === 'pending' && order.razorpay.paymentId) {
    const payment = await fetchAndValidateRazorpayPayment(order, order.razorpay.paymentId);
    order.razorpay.lastPaymentStatus = payment.status;
    await order.save();

    if (payment.status === 'captured') {
      const finalizedOrder = await finalizePaidOrder({
        orderId: order._id,
        razorpayOrderId: order.razorpay.orderId,
        razorpayPaymentId: order.razorpay.paymentId,
        lastPaymentStatus: payment.status,
      });
      return safePaymentResponse(finalizedOrder);
    }

    if (payment.status === 'failed') {
      const failedOrder = await markPaymentFailure(order, payment.error_description || 'Payment failed');
      return safePaymentResponse(failedOrder);
    }
  }

  return safePaymentResponse(order);
}

async function processCapturedPayment(payment, verifiedByWebhook) {
  const order = await Order.findOne({ 'razorpay.orderId': payment.order_id });

  if (!order) {
    return { ignored: true, message: 'Order not found for Razorpay payment' };
  }

  if (Number(payment.amount) !== amountToPaise(order.total) || payment.currency !== order.currency) {
    await markPaymentReview(order._id, 'Razorpay payment details did not match the order.');
    return { reviewed: true };
  }

  if (payment.status !== 'captured') {
    order.razorpay.paymentId = payment.id || order.razorpay.paymentId;
    order.razorpay.lastPaymentStatus = payment.status || order.razorpay.lastPaymentStatus;
    await order.save();
    return { pending: true };
  }

  const finalizedOrder = await finalizePaidOrder({
    orderId: order._id,
    razorpayOrderId: order.razorpay.orderId,
    razorpayPaymentId: payment.id,
    verifiedByWebhook,
    lastPaymentStatus: payment.status,
  });

  return { order: safeOrderResult(finalizedOrder) };
}

export async function processRazorpayWebhook(rawBody, headers = {}) {
  if (!isRazorpayWebhookConfigured()) {
    throw new ApiError(503, 'Razorpay webhook verification is not configured', []);
  }

  const signature = headers['x-razorpay-signature'];
  const eventIdHeader = headers['x-razorpay-event-id'];
  let receivedEventName = 'unknown';

  if (env.nodeEnv === 'development') {
    try {
      const receivedPayload = JSON.parse(
        Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody),
      );
      receivedEventName =
        typeof receivedPayload?.event === 'string'
          ? receivedPayload.event.replace(/[\r\n]/g, '').slice(0, 100)
          : 'unknown';
    } catch {
      receivedEventName = 'invalid-json';
    }

    const safeEventId =
      typeof eventIdHeader === 'string'
        ? eventIdHeader.replace(/[\r\n]/g, '').slice(0, 200)
        : 'not-provided';
    console.info(`[Razorpay Webhook] Received: ${receivedEventName}`);
    console.info(`[Razorpay Webhook] Event ID: ${safeEventId}`);
  }

  if (!verifyWebhookSignature(rawBody, signature)) {
    if (env.nodeEnv === 'development') {
      console.warn('[Razorpay Webhook] Signature verification failed');
    }
    throw new ApiError(400, 'Invalid Razorpay webhook signature', []);
  }

  if (env.nodeEnv === 'development') {
    console.info('[Razorpay Webhook] Signature verified');
  }

  const payload = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody));
  const payment = payload.payload?.payment?.entity || null;
  const razorpayOrder = payload.payload?.order?.entity || null;
  const refund = payload.payload?.refund?.entity || null;
  const eventId =
    eventIdHeader ||
    `derived-${crypto.createHash('sha256').update(rawBody).digest('hex')}`;

  let event = await RazorpayWebhookEvent.findOne({ eventId });

  if (event?.processingStatus === 'processed' || event?.processingStatus === 'ignored') {
    return { duplicate: true };
  }

  if (event?.processingStatus === 'processing') {
    return { duplicate: true };
  }

  if (!event) {
    try {
      event = await RazorpayWebhookEvent.create({
        eventId,
        eventType: payload.event || '',
        razorpayOrderId: payment?.order_id || razorpayOrder?.id || '',
        razorpayPaymentId: payment?.id || refund?.payment_id || '',
        processingStatus: 'processing',
        receivedAt: now(),
      });
    } catch (error) {
      if (error?.code === 11000) {
        return { duplicate: true };
      }
      throw error;
    }
  } else {
    event.processingStatus = 'processing';
    event.errorMessage = '';
    await event.save();
  }

  try {
    let result = { ignored: true };

    if (payload.event === 'payment.captured' && payment) {
      result = await processCapturedPayment(payment, true);
    } else if (payload.event === 'order.paid' && razorpayOrder) {
      const order = await Order.findOne({ 'razorpay.orderId': razorpayOrder.id });
      if (order?.razorpay.paymentId) {
        const fetchedPayment = await fetchAndValidateRazorpayPayment(order, order.razorpay.paymentId);
        result = await processCapturedPayment(fetchedPayment, true);
      } else if (order) {
        const payments = await getRazorpayClient().orders.fetchPayments(razorpayOrder.id);
        const capturedPayment = (payments.items || []).find((item) => item.status === 'captured') || payments.items?.[0];

        if (capturedPayment) {
          result = await processCapturedPayment(capturedPayment, true);
        }
      }
    } else if (payload.event === 'payment.failed' && payment) {
      const order = await Order.findOne({ 'razorpay.orderId': payment.order_id });
      if (order) {
        await markPaymentFailure(order, payment.error_description || 'Payment failed');
        result = { failed: true };
      }
    } else if (payload.event === 'refund.created' && refund) {
      const { processRefundCreatedWebhook } = await import('./refundService.js');
      result = await processRefundCreatedWebhook(refund);
    } else if (payload.event === 'refund.processed' && refund) {
      const { processRefundProcessedWebhook } = await import('./refundService.js');
      result = await processRefundProcessedWebhook(refund);
    } else if (payload.event === 'refund.failed' && refund) {
      const { processRefundFailedWebhook } = await import('./refundService.js');
      result = await processRefundFailedWebhook(refund);
    } else if (payload.event === 'refund.speed_changed' && refund) {
      const { processRefundCreatedWebhook } = await import('./refundService.js');
      result = await processRefundCreatedWebhook(refund);
    }

    event.processingStatus = result.ignored ? 'ignored' : 'processed';
    event.processedAt = now();
    await event.save();

    return result;
  } catch (error) {
    event.processingStatus = 'failed';
    event.errorMessage = safeFailureMessage(error, 'Webhook processing failed');
    await event.save();
    throw error;
  }
}
