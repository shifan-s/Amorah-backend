const eligibleOrderStatuses = [
  'confirmed',
  'processing',
  'packed',
  'shipped',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'refund_initiated',
  'refunded',
];

function hasAddressSnapshot(address = {}) {
  return Boolean(
    address.fullName &&
      address.mobile &&
      address.addressLine1 &&
      address.city &&
      address.state &&
      address.postalCode &&
      address.country,
  );
}

function hasItemSnapshots(items = []) {
  return (
    Array.isArray(items) &&
    items.length > 0 &&
    items.every((item) => item.productName && Number(item.quantity) > 0 && Number(item.unitPrice) >= 0 && Number(item.lineTotal) >= 0)
  );
}

function paymentWasVerified(order = {}) {
  return Boolean(order.razorpay?.checkoutSignatureVerified || order.razorpay?.webhookVerified || order.paymentCompletedAt);
}

export function getInvoiceEligibilityReason(order) {
  if (!order) {
    return 'Order not found.';
  }

  if (!['paid', 'refunded'].includes(order.paymentStatus)) {
    return 'Invoices are available only for paid or refunded orders.';
  }

  if (order.orderStatus === 'pending_payment') {
    return 'Invoices are not available for pending-payment orders.';
  }

  if (order.orderStatus === 'payment_failed' || order.paymentStatus === 'failed') {
    return 'Invoices are not available for failed payments.';
  }

  if (order.orderStatus === 'payment_review' && !paymentWasVerified(order)) {
    return 'Invoices are not available while payment review is unresolved.';
  }

  if (!eligibleOrderStatuses.includes(order.orderStatus) && order.orderStatus !== 'payment_review') {
    return 'This order is not eligible for invoice generation.';
  }

  if (!Number.isFinite(Number(order.total)) || Number(order.total) <= 0) {
    return 'Order total is missing or invalid.';
  }

  if (!hasItemSnapshots(order.items)) {
    return 'Order item snapshots are incomplete.';
  }

  if (!hasAddressSnapshot(order.shippingAddress) || !hasAddressSnapshot(order.billingAddress)) {
    return 'Order address snapshots are incomplete.';
  }

  if (!paymentWasVerified(order)) {
    return 'Payment verification is required before invoice generation.';
  }

  return '';
}

export function canGenerateInvoice(order) {
  return getInvoiceEligibilityReason(order) === '';
}

