const blockingRefundStatuses = ['initiating', 'pending', 'processed'];

export function calculateFullRefundAmount(order) {
  return Number(order?.total) || 0;
}

export function getRefundEligibilityReason(order, existingRefunds = []) {
  if (!order) {
    return 'Order not found.';
  }

  if (order.paymentMethod !== 'razorpay') {
    return 'Only Razorpay orders can be refunded.';
  }

  if (order.paymentStatus !== 'paid') {
    return 'Only paid orders can be refunded.';
  }

  if (!order.razorpay?.paymentId) {
    return 'Razorpay payment ID is missing.';
  }

  if (calculateFullRefundAmount(order) <= 0) {
    return 'Order total is not refundable.';
  }

  if (order.paymentStatus === 'refunded' || order.refundSummary?.status === 'processed') {
    return 'Order has already been refunded.';
  }

  if (existingRefunds.some((refund) => blockingRefundStatuses.includes(refund.status))) {
    return 'A refund is already in progress or complete for this order.';
  }

  const cancellationStatus = order.cancellation?.status || 'none';
  const refundRequired = cancellationStatus === 'refund_required' || order.refundSummary?.status === 'required';
  const paymentReviewApproved = order.orderStatus === 'payment_review' && refundRequired;

  if (order.orderStatus === 'delivered') {
    return 'Delivered orders require a separate return workflow before refund.';
  }

  if (!(order.orderStatus === 'cancelled' && refundRequired) && !paymentReviewApproved) {
    return 'Cancellation must be approved before a full refund can be initiated.';
  }

  return '';
}

export function canInitiateFullRefund(order, existingRefunds = []) {
  return getRefundEligibilityReason(order, existingRefunds) === '';
}
