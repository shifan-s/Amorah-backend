import assert from 'node:assert/strict';
import test from 'node:test';
import { detectRazorpayKeyMode, maskRazorpayKeyId } from '../src/utils/razorpayMode.js';

test('detects Razorpay test and live key modes without reading secrets', () => {
  assert.equal(detectRazorpayKeyMode('rzp_test_abc123'), 'test');
  assert.equal(detectRazorpayKeyMode('rzp_live_xyz789'), 'live');
  assert.equal(detectRazorpayKeyMode('unexpected_key'), 'unknown');
  assert.equal(detectRazorpayKeyMode(''), 'missing');
});

test('masks Razorpay Key ID for safe warnings', () => {
  const masked = maskRazorpayKeyId('rzp_live_1234567890');

  assert.match(masked, /^rzp_live\./);
  assert.ok(!masked.includes('1234567890'));
});

