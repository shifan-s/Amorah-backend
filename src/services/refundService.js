import mongoose from 'mongoose';
import env from '../config/env.js';
import { getRazorpayClient, isRazorpayConfigured } from '../config/razorpay.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Refund from '../models/Refund.js';
import ApiError from '../utils/ApiError.js';
import {
  calculateFullRefundAmount,
  canInitiateFullRefund,
  getRefundEligibilityReason,
} from '../utils/refundEligibility.js';
import { amountToPaise } from './paymentService.js';
import {
  sendRefundFailedEmail,
  sendRefundInitiatedEmail,
  sendRefundProcessedEmail,
} from './emailService.js';

function now() {
  return new Date();
}

function idString(value) {
  if (!value) {
    return '';
  }

  if (value._id) {
    return value._id.toString();
  }

  return value.toString();
}

function safeReason(value = '') {
  return String(value || '').replace(/<[^>]*>/g, '').trim().slice(0, 500);
}

function safeFailure(error, fallback = 'Refund could not be completed') {
  return String(error?.message || error?.error?.description || error?.description || fallback).slice(0, 500);
}

function appendTimeline(order, status, message, changedBy = null) {
  const exists = (order.statusTimeline || []).some((event) => event.status === status && event.message === message);

  if (!exists) {
    order.statusTimeline.push({
      status,
      message,
      changedAt: now(),
      changedBy,
    });
  }
}

function extractAcquirerReference(refund = {}) {
  const acquirerData = refund.acquirer_data || {};
  return acquirerData.arn || acquirerData.rrn || acquirerData.utr || refund.acquirer_reference || '';
}

function safeRefundReceipt(orderNumber) {
  return `AMR-REFUND-${orderNumber}`.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 40);
}

function refundIdempotencyKey(orderId, attemptNumber) {
  return `amorah_${idString(orderId)}_refund_${attemptNumber}`.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 100);
}

async function existingRefunds(orderId) {
  return Refund.find({ order: orderId }).sort({ createdAt: -1 });
}

async function loadOrderForRefund(orderNumber) {
  return Order.findOne({ orderNumber }).populate('customer', 'fullName email mobile');
}

export async function getRefundEligibility(orderNumber) {
  const order = await loadOrderForRefund(orderNumber);
  const refunds = order ? await existingRefunds(order._id) : [];
  const reason = getRefundEligibilityReason(order, refunds);

  return {
    eligible: !reason,
    reason,
    amount: order ? calculateFullRefundAmount(order) : 0,
    currency: order?.currency || 'INR',
    refund: order ? buildAdminRefundResponse(order.refundSummary, refunds[0]) : null,
  };
}

async function fetchRazorpayPayment(order) {
  if (!isRazorpayConfigured()) {
    throw new ApiError(503, 'Razorpay refund processing is not configured', []);
  }

  const payment = await getRazorpayClient().payments.fetch(order.razorpay.paymentId);
  const amount = amountToPaise(order.total);

  if (payment.id !== order.razorpay.paymentId) {
    throw new ApiError(400, 'Stored payment could not be verified with Razorpay', []);
  }

  if (order.razorpay.orderId && payment.order_id !== order.razorpay.orderId) {
    throw new ApiError(400, 'Razorpay payment does not belong to this order', []);
  }

  if (payment.status !== 'captured') {
    throw new ApiError(400, 'Only captured payments can be refunded', []);
  }

  if (payment.currency !== order.currency) {
    throw new ApiError(400, 'Razorpay payment currency does not match the order', []);
  }

  if (Number(payment.amount) !== amount) {
    throw new ApiError(400, 'Razorpay payment amount does not match the order total', []);
  }

  if (Number(payment.amount_refunded || 0) >= amount) {
    throw new ApiError(400, 'This payment has already been fully refunded', []);
  }

  return payment;
}

async function createRazorpayRefund(order, refund) {
  const credentials = Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString('base64');
  const response = await fetch(`https://api.razorpay.com/v1/payments/${order.razorpay.paymentId}/refund`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
      'X-Refund-Idempotency': refund.idempotencyKey,
    },
    body: JSON.stringify({
      amount: amountToPaise(refund.amount),
      speed: 'normal',
      receipt: safeRefundReceipt(order.orderNumber),
      notes: {
        amorahOrderNumber: order.orderNumber,
        refundType: 'full',
      },
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(response.status >= 500 ? 502 : 400, data.error?.description || 'Razorpay refund request failed', []);
  }

  return data;
}

function applyPendingRefund(order, refund, razorpayRefund = {}) {
  refund.razorpayRefundId = razorpayRefund.id || refund.razorpayRefundId;
  refund.status = razorpayRefund.status === 'processed' ? 'processed' : razorpayRefund.status === 'failed' ? 'failed' : 'pending';
  refund.speedProcessed = razorpayRefund.speed_processed || refund.speedProcessed;
  refund.acquirerReference = extractAcquirerReference(razorpayRefund) || refund.acquirerReference;

  order.orderStatus = refund.status === 'failed' ? 'cancelled' : 'refund_initiated';
  order.paymentStatus = order.paymentStatus === 'refunded' ? 'refunded' : 'paid';
  order.refundSummary.status = refund.status === 'failed' ? 'failed' : 'pending';
  order.refundSummary.amount = refund.amount;
  order.refundSummary.currency = refund.currency;
  order.refundSummary.razorpayRefundId = refund.razorpayRefundId;
  order.refundSummary.reason = refund.reason;
  order.refundSummary.initiatedAt = order.refundSummary.initiatedAt || refund.initiatedAt || now();
  order.refundSummary.initiatedBy = order.refundSummary.initiatedBy || refund.initiatedBy;
  order.refundSummary.inventoryRestorationStatus = order.inventoryApplied ? 'pending' : 'not_required';
  order.refundSummary.acquirerReference = refund.acquirerReference;

  if (refund.status === 'failed') {
    order.refundSummary.failedAt = now();
    order.refundSummary.failureReason = refund.failureReason || 'Razorpay refund request failed';
  }
}

export async function initiateFullRefund({ orderNumber, reason, adminId }) {
  const order = await loadOrderForRefund(orderNumber);
  const refunds = order ? await existingRefunds(order._id) : [];

  if (!canInitiateFullRefund(order, refunds)) {
    throw new ApiError(400, getRefundEligibilityReason(order, refunds), []);
  }

  await fetchRazorpayPayment(order);

  const amount = calculateFullRefundAmount(order);
  const previousAttempts = await Refund.countDocuments({ order: order._id });
  const attemptNumber = previousAttempts + 1;
  const idempotencyKey = refundIdempotencyKey(order._id, attemptNumber);
  const refund = await Refund.create({
    order: order._id,
    orderNumber: order.orderNumber,
    customer: order.customer?._id || order.customer,
    paymentId: order.razorpay.paymentId,
    amount,
    currency: order.currency,
    reason: safeReason(reason),
    idempotencyKey,
    attemptNumber,
    status: 'initiating',
    inventoryRestorationStatus: order.inventoryApplied ? 'pending' : 'not_required',
    initiatedBy: adminId,
    initiatedAt: now(),
  });

  order.refundSummary.status = 'initiating';
  order.refundSummary.amount = amount;
  order.refundSummary.currency = order.currency;
  order.refundSummary.reason = refund.reason;
  order.refundSummary.initiatedAt = refund.initiatedAt;
  order.refundSummary.initiatedBy = adminId;
  appendTimeline(order, 'refund_initiated', 'Full refund initiated by admin', adminId);
  await order.save();

  try {
    const razorpayRefund = await createRazorpayRefund(order, refund);
    applyPendingRefund(order, refund, razorpayRefund);
    await refund.save();
    await order.save();

    if (refund.status === 'processed') {
      const processed = await finalizeProcessedRefund({ razorpayRefundId: refund.razorpayRefundId });
      return buildAdminRefundResponse(processed.order, processed.refund);
    }

    if (refund.status === 'failed') {
      await sendRefundFailedEmail(order).catch(() => {});
    } else {
      await sendRefundInitiatedEmail(order).catch(() => {});
    }

    return buildAdminRefundResponse(order, refund);
  } catch (error) {
    refund.status = 'failed';
    refund.failedAt = now();
    refund.failureReason = safeFailure(error);
    await refund.save();

    order.refundSummary.status = 'failed';
    order.refundSummary.failedAt = refund.failedAt;
    order.refundSummary.failureReason = refund.failureReason;
    order.refundSummary.inventoryRestorationStatus = order.inventoryApplied ? 'pending' : 'not_required';
    order.orderStatus = 'cancelled';
    order.paymentStatus = 'paid';
    order.cancellation.status = 'refund_required';
    appendTimeline(order, 'cancelled', 'Refund request failed. Refund still requires support review.', adminId);
    await order.save();
    await sendRefundFailedEmail(order).catch(() => {});

    throw new ApiError(502, 'Unable to initiate refund with Razorpay. The failed attempt has been recorded.', []);
  }
}

async function restoreOneProduct(item, session) {
  const stockResult = await Product.updateOne(
    {
      _id: item.product,
      'variants._id': item.variantId,
      'variants.sizes._id': item.sizeId,
    },
    {
      $inc: {
        'variants.$[variant].sizes.$[size].stock': item.quantity,
      },
    },
    {
      arrayFilters: [{ 'variant._id': item.variantId }, { 'size._id': item.sizeId }],
      ...(session ? { session } : {}),
    },
  );

  if (stockResult.modifiedCount !== 1) {
    throw new ApiError(409, 'Refund completed, but inventory requires manual reconciliation.', []);
  }

  await Product.updateOne(
    { _id: item.product },
    [{ $set: { salesCount: { $max: [0, { $subtract: ['$salesCount', item.quantity] }] } } }],
    session ? { session } : undefined,
  );
}

export async function restoreRefundedInventory(order, refund, session = null) {
  if (!order.inventoryApplied) {
    refund.inventoryRestorationStatus = 'not_required';
    order.refundSummary.inventoryRestorationStatus = 'not_required';
    return;
  }

  if (order.inventoryRestored) {
    refund.inventoryRestorationStatus = 'completed';
    refund.inventoryRestoredAt = order.inventoryRestoredAt || now();
    order.refundSummary.inventoryRestorationStatus = 'completed';
    order.refundSummary.inventoryRestoredAt = refund.inventoryRestoredAt;
    return;
  }

  for (const item of order.items) {
    await restoreOneProduct(item, session);
  }

  order.inventoryRestored = true;
  order.inventoryRestoredAt = now();
  refund.inventoryRestorationStatus = 'completed';
  refund.inventoryRestoredAt = order.inventoryRestoredAt;
  order.refundSummary.inventoryRestorationStatus = 'completed';
  order.refundSummary.inventoryRestoredAt = order.inventoryRestoredAt;
}

async function finalizeProcessedRefundWithSession({ refund, razorpayRefund, webhookVerified = false, session = null }) {
  const orderQuery = Order.findById(refund.order).populate('customer', 'fullName email mobile');
  const order = session ? await orderQuery.session(session) : await orderQuery;

  if (!order) {
    throw new ApiError(404, 'Order not found for refund', []);
  }

  if (refund.status === 'processed' && order.paymentStatus === 'refunded' && order.inventoryRestored) {
    return { order, refund };
  }

  if (refund.paymentId !== order.razorpay.paymentId) {
    throw new ApiError(400, 'Refund payment ID does not match the order', []);
  }

  if (Number(refund.amount) !== Number(order.total) || refund.currency !== order.currency) {
    throw new ApiError(400, 'Refund amount does not match the order total', []);
  }

  refund.status = 'processed';
  refund.webhookVerified = refund.webhookVerified || Boolean(webhookVerified);
  refund.processedAt = refund.processedAt || now();
  refund.acquirerReference = extractAcquirerReference(razorpayRefund) || refund.acquirerReference;

  order.refundSummary.status = 'processed';
  order.refundSummary.amount = refund.amount;
  order.refundSummary.currency = refund.currency;
  order.refundSummary.razorpayRefundId = refund.razorpayRefundId;
  order.refundSummary.processedAt = refund.processedAt;
  order.refundSummary.webhookVerified = order.refundSummary.webhookVerified || Boolean(webhookVerified);
  order.refundSummary.acquirerReference = refund.acquirerReference;
  order.paymentStatus = 'refunded';
  order.orderStatus = 'refunded';
  order.cancellation.status = 'refunded';
  appendTimeline(order, 'refunded', 'Full refund processed successfully');

  try {
    await restoreRefundedInventory(order, refund, session);
  } catch (error) {
    refund.inventoryRestorationStatus = 'failed';
    order.refundSummary.inventoryRestorationStatus = 'failed';
    order.refundSummary.inventoryRestorationFailureReason = safeFailure(error);
    appendTimeline(order, 'refunded', 'Refund completed, but inventory requires manual reconciliation.');
  }

  await refund.save(session ? { session } : undefined);
  await order.save(session ? { session } : undefined);

  return { order, refund };
}

function isTransactionUnsupported(error) {
  return /Transaction numbers are only allowed|replica set member|Transaction.*not supported/i.test(error?.message || '');
}

export async function finalizeProcessedRefund({ razorpayRefundId, razorpayRefund = {}, webhookVerified = false }) {
  const refund = await Refund.findOne({ razorpayRefundId });

  if (!refund) {
    throw new ApiError(404, 'Refund not found', []);
  }

  const session = await mongoose.startSession();

  try {
    let result;
    await session.withTransaction(async () => {
      result = await finalizeProcessedRefundWithSession({ refund, razorpayRefund, webhookVerified, session });
    });
    await sendRefundProcessedEmail(result.order).catch(() => {});
    return result;
  } catch (error) {
    if (isTransactionUnsupported(error)) {
      const result = await finalizeProcessedRefundWithSession({ refund, razorpayRefund, webhookVerified, session: null });
      await sendRefundProcessedEmail(result.order).catch(() => {});
      return result;
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

async function findRefundByRazorpayEntity(entity) {
  return Refund.findOne({
    $or: [
      { razorpayRefundId: entity.id },
      { paymentId: entity.payment_id, amount: Number(entity.amount) / 100 },
    ],
  });
}

export async function processRefundCreatedWebhook(entity) {
  const refund = await findRefundByRazorpayEntity(entity);

  if (!refund) {
    return { ignored: true };
  }

  refund.razorpayRefundId = entity.id || refund.razorpayRefundId;
  refund.status = entity.status === 'processed' ? 'processed' : entity.status === 'failed' ? 'failed' : 'pending';
  refund.speedProcessed = entity.speed_processed || refund.speedProcessed;
  await refund.save();

  const order = await Order.findById(refund.order).populate('customer', 'fullName email mobile');
  if (order) {
    order.refundSummary.razorpayRefundId = refund.razorpayRefundId;
    order.refundSummary.status = refund.status === 'failed' ? 'failed' : 'pending';
    order.orderStatus = refund.status === 'failed' ? 'cancelled' : 'refund_initiated';
    await order.save();
  }

  return { refund };
}

export async function processRefundProcessedWebhook(entity) {
  const refund = await findRefundByRazorpayEntity(entity);
  if (!refund) {
    return { ignored: true };
  }
  refund.razorpayRefundId = entity.id || refund.razorpayRefundId;
  await refund.save();
  return finalizeProcessedRefund({ razorpayRefundId: refund.razorpayRefundId, razorpayRefund: entity, webhookVerified: true });
}

export async function processRefundFailedWebhook(entity) {
  const refund = await findRefundByRazorpayEntity(entity);
  if (!refund) {
    return { ignored: true };
  }

  if (refund.status === 'processed') {
    return { refund };
  }

  const order = await Order.findById(refund.order).populate('customer', 'fullName email mobile');
  refund.razorpayRefundId = entity.id || refund.razorpayRefundId;
  refund.status = 'failed';
  refund.failedAt = now();
  refund.failureReason = safeFailure(entity.error_description || entity.error_reason || 'Refund failed');
  refund.inventoryRestorationStatus = order?.inventoryApplied ? 'pending' : 'not_required';
  await refund.save();

  if (order) {
    order.refundSummary.status = 'failed';
    order.refundSummary.failedAt = refund.failedAt;
    order.refundSummary.failureReason = 'Refund could not be completed automatically.';
    order.orderStatus = 'cancelled';
    order.paymentStatus = 'paid';
    order.cancellation.status = 'refund_required';
    appendTimeline(order, 'cancelled', 'Refund could not be completed automatically.');
    await order.save();
    await sendRefundFailedEmail(order).catch(() => {});
  }

  return { order, refund };
}

export async function reconcileRefundStatus(refundId) {
  const refund = await Refund.findById(refundId);

  if (!refund) {
    throw new ApiError(404, 'Refund not found', []);
  }

  if (!refund.razorpayRefundId) {
    return { refund };
  }

  if (!isRazorpayConfigured()) {
    throw new ApiError(503, 'Razorpay refund reconciliation is not configured', []);
  }

  const razorpayRefund = await getRazorpayClient().payments.fetchRefund(refund.paymentId, refund.razorpayRefundId);

  if (razorpayRefund.payment_id !== refund.paymentId) {
    throw new ApiError(400, 'Razorpay refund payment ID mismatch', []);
  }

  if (Number(razorpayRefund.amount) !== amountToPaise(refund.amount) || razorpayRefund.currency !== refund.currency) {
    throw new ApiError(400, 'Razorpay refund amount or currency mismatch', []);
  }

  if (razorpayRefund.status === 'processed') {
    return finalizeProcessedRefund({ razorpayRefundId: refund.razorpayRefundId, razorpayRefund });
  }

  if (razorpayRefund.status === 'failed') {
    return processRefundFailedWebhook(razorpayRefund);
  }

  refund.status = 'pending';
  await refund.save();
  return { refund };
}

export async function retryFailedRefund(refundId, adminId) {
  const oldRefund = await Refund.findById(refundId);

  if (!oldRefund) {
    throw new ApiError(404, 'Refund not found', []);
  }

  if (oldRefund.status === 'processed') {
    throw new ApiError(400, 'Processed refunds cannot be retried', []);
  }

  if (oldRefund.status !== 'failed') {
    return reconcileRefundStatus(refundId);
  }

  const order = await Order.findById(oldRefund.order).populate('customer', 'fullName email mobile');
  const refunds = await Refund.find({ order: oldRefund.order, _id: { $ne: oldRefund._id } });
  const reason = getRefundEligibilityReason(order, refunds);

  if (reason) {
    throw new ApiError(400, reason, []);
  }

  return initiateFullRefund({ orderNumber: oldRefund.orderNumber, reason: oldRefund.reason, adminId });
}

export function refundSafeMessage(status) {
  if (status === 'required') {
    return 'Your cancellation was approved and is waiting for refund initiation.';
  }
  if (['initiating', 'pending'].includes(status)) {
    return 'Your refund has been initiated and is being processed.';
  }
  if (status === 'processed') {
    return 'Your refund has been processed successfully.';
  }
  if (status === 'failed') {
    return 'We could not complete the refund automatically. Amorah support will assist you.';
  }
  return '';
}

export function buildCustomerRefundResponse(order) {
  const summary = order.refundSummary || {};
  return {
    status: summary.status || 'none',
    amount: summary.amount || 0,
    currency: summary.currency || 'INR',
    initiatedAt: summary.initiatedAt || null,
    processedAt: summary.processedAt || null,
    safeMessage: refundSafeMessage(summary.status),
    acquirerReference: summary.status === 'processed' ? summary.acquirerReference || '' : '',
  };
}

export function buildAdminRefundResponse(orderOrSummary, refund = null) {
  const summary = orderOrSummary?.refundSummary || orderOrSummary || {};
  return {
    id: refund?._id?.toString?.() || '',
    orderNumber: refund?.orderNumber || orderOrSummary?.orderNumber || '',
    amount: refund?.amount ?? summary.amount ?? 0,
    currency: refund?.currency || summary.currency || 'INR',
    status: refund?.status || summary.status || 'none',
    razorpayRefundId: refund?.razorpayRefundId || summary.razorpayRefundId || '',
    reason: refund?.reason || summary.reason || '',
    initiatedAt: refund?.initiatedAt || summary.initiatedAt || null,
    processedAt: refund?.processedAt || summary.processedAt || null,
    failedAt: refund?.failedAt || summary.failedAt || null,
    failureReason: refund?.failureReason || summary.failureReason || '',
    inventoryRestorationStatus: refund?.inventoryRestorationStatus || summary.inventoryRestorationStatus || 'not_required',
    inventoryRestoredAt: refund?.inventoryRestoredAt || summary.inventoryRestoredAt || null,
    acquirerReference: refund?.acquirerReference || summary.acquirerReference || '',
    attemptNumber: refund?.attemptNumber || 0,
  };
}

export async function listRefundRecords(query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
  const filter = {};

  if (query.orderNumber) filter.orderNumber = query.orderNumber;
  if (query.status) filter.status = query.status;
  if (query.inventoryRestorationStatus) filter.inventoryRestorationStatus = query.inventoryRestorationStatus;
  if (query.search) {
    filter.$or = [
      { orderNumber: { $regex: query.search, $options: 'i' } },
      { razorpayRefundId: { $regex: query.search, $options: 'i' } },
    ];
  }
  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {};
    if (query.dateFrom) filter.createdAt.$gte = query.dateFrom;
    if (query.dateTo) filter.createdAt.$lte = query.dateTo;
  }

  const skip = (page - 1) * limit;
  const [refunds, totalRefunds] = await Promise.all([
    Refund.find(filter).populate('customer', 'fullName email').sort({ createdAt: -1 }).skip(skip).limit(limit),
    Refund.countDocuments(filter),
  ]);

  return {
    refunds: refunds.map((refund) => ({
      ...buildAdminRefundResponse(null, refund),
      customer: refund.customer
        ? { id: refund.customer._id.toString(), fullName: refund.customer.fullName, email: refund.customer.email }
        : null,
      createdAt: refund.createdAt,
      updatedAt: refund.updatedAt,
    })),
    pagination: {
      page,
      limit,
      totalRefunds,
      totalPages: Math.ceil(totalRefunds / limit),
    },
  };
}

export async function getRefundRecord(refundId) {
  const refund = await Refund.findById(refundId).populate('customer', 'fullName email').populate('order');

  if (!refund) {
    return null;
  }

  return {
    ...buildAdminRefundResponse(refund.order, refund),
    customer: refund.customer
      ? { id: refund.customer._id.toString(), fullName: refund.customer.fullName, email: refund.customer.email }
      : null,
    order: refund.order
      ? {
          orderNumber: refund.order.orderNumber,
          paymentStatus: refund.order.paymentStatus,
          orderStatus: refund.order.orderStatus,
          refund: buildAdminRefundResponse(refund.order, refund),
        }
      : null,
    createdAt: refund.createdAt,
    updatedAt: refund.updatedAt,
  };
}
