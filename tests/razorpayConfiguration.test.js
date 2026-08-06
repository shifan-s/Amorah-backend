import assert from 'node:assert/strict';
import test from 'node:test';
import env from '../src/config/env.js';
import { validateRazorpayPaymentConfiguration } from '../src/services/paymentService.js';

function withRazorpayConfig(keyId, keySecret, callback) {
  const previousKeyId = env.razorpayKeyId;
  const previousKeySecret = env.razorpayKeySecret;

  try {
    env.razorpayKeyId = keyId;
    env.razorpayKeySecret = keySecret;
    callback();
  } finally {
    env.razorpayKeyId = previousKeyId;
    env.razorpayKeySecret = previousKeySecret;
  }
}

test('accepts valid Razorpay test and live credential formats', () => {
  withRazorpayConfig('rzp_test_abc123', 'test_secret', () => {
    assert.doesNotThrow(validateRazorpayPaymentConfiguration);
  });
  withRazorpayConfig('rzp_live_xyz789', 'live_secret', () => {
    assert.doesNotThrow(validateRazorpayPaymentConfiguration);
  });
});

test('reports a missing Razorpay Key ID without exposing configuration values', () => {
  withRazorpayConfig('', 'server_secret', () => {
    assert.throws(validateRazorpayPaymentConfiguration, (error) => {
      assert.equal(error.statusCode, 500);
      assert.equal(error.message, 'Razorpay Key ID is not configured on the server');
      assert.doesNotMatch(error.message, /server_secret/);
      return true;
    });
  });
});

test('reports a missing Razorpay Key Secret without exposing the Key ID', () => {
  withRazorpayConfig('rzp_live_public123', '', () => {
    assert.throws(validateRazorpayPaymentConfiguration, (error) => {
      assert.equal(error.statusCode, 500);
      assert.equal(error.message, 'Razorpay Key Secret is not configured on the server');
      assert.doesNotMatch(error.message, /rzp_live_public123/);
      return true;
    });
  });
});

test('rejects an invalid Razorpay Key ID format', () => {
  withRazorpayConfig('invalid_key', 'server_secret', () => {
    assert.throws(validateRazorpayPaymentConfiguration, /invalid format/);
  });
});
