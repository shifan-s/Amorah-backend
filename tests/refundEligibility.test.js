import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateFullRefundAmount,
  canInitiateFullRefund,
  getRefundEligibilityReason,
} from '../src/utils/refundEligibility.js';

function paidRefundRequiredOrder(overrides = {}) {
  return {
    paymentMethod: 'razorpay',
    paymentStatus: 'paid',
    orderStatus: 'cancelled',
    total: 3499,
    razorpay: {
      paymentId: 'pay_test_123',
    },
    cancellation: {
      status: 'refund_required',
    },
    refundSummary: {
      status: 'required',
    },
    ...overrides,
  };
}

test('allows a full refund only after paid Razorpay cancellation approval', () => {
  const order = paidRefundRequiredOrder();

  assert.equal(canInitiateFullRefund(order), true);
  assert.equal(getRefundEligibilityReason(order), '');
});

test('calculates the full refund amount from the stored order total', () => {
  const order = paidRefundRequiredOrder({ total: 4275.5 });

  assert.equal(calculateFullRefundAmount(order), 4275.5);
});

test('rejects unpaid or pending payment orders', () => {
  const order = paidRefundRequiredOrder({ paymentStatus: 'pending' });

  assert.equal(canInitiateFullRefund(order), false);
  assert.match(getRefundEligibilityReason(order), /Only paid orders/);
});

test('rejects orders without a stored Razorpay payment ID', () => {
  const order = paidRefundRequiredOrder({ razorpay: {} });

  assert.equal(canInitiateFullRefund(order), false);
  assert.match(getRefundEligibilityReason(order), /payment ID is missing/);
});

test('rejects duplicate active or processed refunds', () => {
  const order = paidRefundRequiredOrder();

  assert.equal(canInitiateFullRefund(order, [{ status: 'pending' }]), false);
  assert.match(getRefundEligibilityReason(order, [{ status: 'processed' }]), /already in progress or complete/);
});

test('rejects delivered orders until a return workflow exists', () => {
  const order = paidRefundRequiredOrder({ orderStatus: 'delivered' });

  assert.equal(canInitiateFullRefund(order), false);
  assert.match(getRefundEligibilityReason(order), /return workflow/);
});

test('allows payment review refunds only when marked refund required', () => {
  const order = paidRefundRequiredOrder({
    orderStatus: 'payment_review',
    cancellation: { status: 'refund_required' },
  });

  assert.equal(canInitiateFullRefund(order), true);
});
