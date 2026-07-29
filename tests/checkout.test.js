import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import env from '../src/config/env.js';
import {
  calculateCheckoutSummary,
  resolveCheckoutAddress,
  sanitizeCustomerNotes,
  validateClientCartSelection,
} from '../src/services/checkoutService.js';
import { formatOrderNumber } from '../src/utils/orderNumber.js';

test('formats readable Amorah order numbers', () => {
  assert.equal(formatOrderNumber(2026, 1), 'AMR-2026-000001');
  assert.equal(formatOrderNumber(2026, 42), 'AMR-2026-000042');
});

test('calculates paid shipping below the free shipping threshold', () => {
  env.checkoutFreeShippingThreshold = 1499;
  env.checkoutShippingCharge = 99;

  const summary = calculateCheckoutSummary([{ quantity: 1, lineTotal: 1299 }]);

  assert.equal(summary.subtotal, 1299);
  assert.equal(summary.shippingCharge, 99);
  assert.equal(summary.tax, 0);
  assert.equal(summary.total, 1398);
  assert.equal(summary.paymentMethod, undefined);
});

test('calculates free shipping at the threshold and keeps tax zero', () => {
  env.checkoutFreeShippingThreshold = 1499;
  env.checkoutShippingCharge = 99;

  const summary = calculateCheckoutSummary([{ quantity: 2, lineTotal: 1500 }]);

  assert.equal(summary.itemCount, 2);
  assert.equal(summary.shippingCharge, 0);
  assert.equal(summary.tax, 0);
  assert.equal(summary.total, 1500);
  assert.equal(summary.currency, 'INR');
});

test('copies only addresses that belong to the authenticated user', () => {
  const shippingAddressId = new mongoose.Types.ObjectId().toString();
  const anotherUserAddressId = new mongoose.Types.ObjectId().toString();
  const user = {
    addresses: [
      {
        id: shippingAddressId,
        fullName: 'Nisha Rao',
        mobile: '9876543210',
        addressLine1: '12 Cotton Lane',
        addressLine2: '',
        landmark: 'Near Studio Square',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400001',
        country: 'India',
        addressType: 'Home',
      },
    ],
  };

  assert.throws(
    () =>
      resolveCheckoutAddress(user, {
        shippingAddressId,
        billingSameAsShipping: false,
        billingAddressId: anotherUserAddressId,
      }),
    /Billing address not found/,
  );

  const result = resolveCheckoutAddress(user, {
    shippingAddressId,
    billingSameAsShipping: true,
    billingAddressId: null,
  });

  assert.equal(result.shippingAddress.fullName, 'Nisha Rao');
  assert.equal(result.billingAddress.fullName, 'Nisha Rao');
});

test('rejects HTML in customer notes', () => {
  assert.equal(sanitizeCustomerNotes(' Please gift wrap '), 'Please gift wrap');
  assert.throws(() => sanitizeCustomerNotes('<script>alert(1)</script>'), /Order notes cannot include HTML/);
});

test('accepts only a client cart selection that matches the authenticated stored cart', () => {
  const productId = new mongoose.Types.ObjectId().toString();
  const variantId = new mongoose.Types.ObjectId().toString();
  const sizeId = new mongoose.Types.ObjectId().toString();
  const storedItems = [{ product: productId, variantId, sizeId, quantity: 2 }];

  assert.doesNotThrow(() =>
    validateClientCartSelection(
      [{ productId, variantId, sizeId, quantity: 2 }],
      storedItems,
    ),
  );
  assert.throws(
    () =>
      validateClientCartSelection(
        [{ productId, variantId, sizeId, quantity: 1 }],
        storedItems,
      ),
    /cart changed/i,
  );
});
