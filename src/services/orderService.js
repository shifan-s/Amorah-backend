import Order from '../models/Order.js';
import { generateOrderNumber } from '../utils/orderNumber.js';
import { canGenerateInvoice } from '../utils/invoiceEligibility.js';
import { buildCustomerRefundResponse } from './refundService.js';

function titleCaseStatus(value = '') {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function safeItem(item) {
  return {
    productId: item.product?.toString?.() || '',
    productName: item.productName,
    productSlug: item.productSlug,
    productImage: item.productImage,
    variantId: item.variantId?.toString?.() || '',
    sizeId: item.sizeId?.toString?.() || '',
    sku: item.sku,
    colourName: item.colourName,
    colourHex: item.colourHex,
    size: item.size,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: item.lineTotal,
  };
}

export function buildOrderInvoiceResponse(order) {
  return {
    available: canGenerateInvoice(order),
    number: order.invoice?.number || null,
    documentType: order.invoice?.documentType || null,
    issuedAt: order.invoice?.issuedAt || null,
  };
}

function toOrderSummary(order) {
  const firstItem = order.items?.[0] || {};
  const itemCount = (order.items || []).reduce((total, item) => total + (Number(item.quantity) || 0), 0);
  const refund = buildCustomerRefundResponse(order);
  const invoice = buildOrderInvoiceResponse(order);

  return {
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    productThumbnail: firstItem.productImage || null,
    itemCount,
    total: order.total,
    currency: order.currency,
    paymentStatus: order.paymentStatus,
    paymentStatusLabel: titleCaseStatus(order.paymentStatus),
    orderStatus: order.orderStatus,
    orderStatusLabel: titleCaseStatus(order.orderStatus),
    refund,
    invoice,
  };
}

function toOrderDetails(order) {
  const refund = buildCustomerRefundResponse(order);
  const invoice = buildOrderInvoiceResponse(order);

  return {
    orderNumber: order.orderNumber,
    items: (order.items || []).map(safeItem),
    shippingAddress: order.shippingAddress,
    billingAddress: order.billingAddress,
    totals: {
      subtotal: order.subtotal,
      shippingCharge: order.shippingCharge,
      tax: order.tax,
      total: order.total,
      currency: order.currency,
    },
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    paymentStatusLabel: titleCaseStatus(order.paymentStatus),
    orderStatus: order.orderStatus,
    orderStatusLabel: titleCaseStatus(order.orderStatus),
    statusTimeline: (order.statusTimeline || []).map((event) => ({
      status: event.status,
      statusLabel: titleCaseStatus(event.status),
      message: event.message,
      changedAt: event.changedAt,
    })),
    customerNotes: order.customerNotes,
    refund,
    invoice,
    createdAt: order.createdAt,
  };
}

export async function buildOrderDataFromPreview(customerId, preview) {
  const orderNumber = await generateOrderNumber();
  const items = (preview.items || []).map((item) => ({
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
  }));

  return {
    orderNumber,
    customer: customerId,
    checkoutIdempotencyKey: preview.checkoutIdempotencyKey || `order-${orderNumber}`,
    items,
    shippingAddress: preview.shippingAddress,
    billingAddress: preview.billingAddress,
    subtotal: preview.summary.subtotal,
    shippingCharge: preview.summary.shippingCharge,
    tax: preview.summary.tax,
    total: preview.summary.total,
    currency: preview.summary.currency || 'INR',
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
        changedAt: new Date(),
      },
    ],
    customerNotes: preview.customerNotes || '',
    inventoryApplied: false,
    cartCleared: false,
  };
}

export async function getCustomerOrders(customerId, { page = 1, limit = 10 } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(25, Math.max(1, Number(limit) || 10));
  const skip = (safePage - 1) * safeLimit;
  const [orders, totalOrders] = await Promise.all([
    Order.find({ customer: customerId }).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).lean(),
    Order.countDocuments({ customer: customerId }),
  ]);

  return {
    orders: orders.map(toOrderSummary),
    pagination: {
      page: safePage,
      limit: safeLimit,
      totalOrders,
      totalPages: Math.ceil(totalOrders / safeLimit),
    },
  };
}

export async function getCustomerOrderByNumber(customerId, orderNumber) {
  const order = await Order.findOne({
    customer: customerId,
    orderNumber: String(orderNumber || '').trim().toUpperCase(),
  }).lean();

  return order ? toOrderDetails(order) : null;
}
