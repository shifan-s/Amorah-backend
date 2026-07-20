import assert from 'node:assert/strict';
import test from 'node:test';
import env from '../src/config/env.js';
import { buildInvoiceData } from '../src/services/invoiceDataService.js';
import { createInvoiceFilename, generateInvoicePdf } from '../src/services/invoiceService.js';
import { canGenerateInvoice, getInvoiceEligibilityReason } from '../src/utils/invoiceEligibility.js';
import { formatInvoiceNumber } from '../src/utils/invoiceNumber.js';

function sampleOrder(overrides = {}) {
  return {
    orderNumber: 'AMR-2026-000123',
    createdAt: new Date('2026-07-18T10:00:00.000Z'),
    paymentStatus: 'paid',
    orderStatus: 'confirmed',
    paymentMethod: 'razorpay',
    total: 3299,
    subtotal: 3200,
    shippingCharge: 99,
    tax: 0,
    currency: 'INR',
    razorpay: {
      paymentId: 'pay_test_123',
      checkoutSignatureVerified: true,
      webhookVerified: false,
    },
    paymentCompletedAt: new Date('2026-07-18T10:02:00.000Z'),
    invoice: {
      number: 'AMR-INV-2026-000001',
      documentType: 'receipt',
      issuedAt: new Date('2026-07-18T10:03:00.000Z'),
    },
    shippingAddress: {
      fullName: 'Asha Mehta',
      mobile: '9876543210',
      addressLine1: '12 Lotus Lane',
      addressLine2: '',
      landmark: 'Near City Mall',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400001',
      country: 'India',
    },
    billingAddress: {
      fullName: 'Asha Mehta',
      mobile: '9876543210',
      addressLine1: '12 Lotus Lane',
      addressLine2: '',
      landmark: '',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400001',
      country: 'India',
    },
    items: [
      {
        productName: 'Ivory Chanderi Kurta Set',
        sku: '',
        colourName: 'Ivory',
        size: 'M',
        quantity: 1,
        unitPrice: 3200,
        lineTotal: 3200,
      },
    ],
    refundSummary: {
      status: 'none',
      amount: 0,
    },
    ...overrides,
  };
}

const originalInvoiceType = env.invoiceDocumentType;
const originalBusinessLegalName = env.businessLegalName;
const originalInvoiceLogoUrl = env.invoiceLogoUrl;
const originalInvoicePrefix = env.invoicePrefix;

test.afterEach(() => {
  env.invoiceDocumentType = originalInvoiceType;
  env.businessLegalName = originalBusinessLegalName;
  env.invoiceLogoUrl = originalInvoiceLogoUrl;
  env.invoicePrefix = originalInvoicePrefix;
});

test('allows invoices for verified paid orders with stored snapshots', () => {
  const order = sampleOrder();

  assert.equal(canGenerateInvoice(order), true);
  assert.equal(getInvoiceEligibilityReason(order), '');
});

test('rejects unpaid and failed-payment orders', () => {
  assert.match(getInvoiceEligibilityReason(sampleOrder({ paymentStatus: 'pending' })), /paid or refunded/);
  assert.match(getInvoiceEligibilityReason(sampleOrder({ paymentStatus: 'failed', orderStatus: 'payment_failed' })), /paid or refunded/);
});

test('rejects orders missing essential snapshots', () => {
  assert.match(getInvoiceEligibilityReason(sampleOrder({ items: [] })), /item snapshots/);
  assert.match(getInvoiceEligibilityReason(sampleOrder({ shippingAddress: { fullName: 'Asha' } })), /address snapshots/);
});

test('keeps invoice data tied to stored order snapshots and totals', () => {
  env.invoiceDocumentType = 'receipt';
  const order = sampleOrder({
    items: [
      {
        productName: 'Stored Product Name',
        sku: 'SNAP-001',
        colourName: 'Sage',
        size: 'L',
        quantity: 2,
        unitPrice: 1500,
        lineTotal: 3000,
      },
    ],
    subtotal: 3000,
    shippingCharge: 0,
    tax: 0,
    total: 3000,
  });
  const data = buildInvoiceData(order);

  assert.equal(data.items[0].productName, 'Stored Product Name');
  assert.equal(data.items[0].unitPrice, 1500);
  assert.equal(data.totals.total, 3000);
  assert.equal(data.customer.shippingAddress.addressLine1, '12 Lotus Lane');
});

test('receipt mode works without GST configuration and tax invoice mode is protected', () => {
  env.invoiceDocumentType = 'receipt';
  assert.equal(buildInvoiceData(sampleOrder()).business.heading, 'Order Receipt');

  env.invoiceDocumentType = 'tax_invoice';
  env.businessLegalName = '';
  assert.throws(() => buildInvoiceData(sampleOrder()), /Tax Invoice mode requires complete business/);
});

test('refunded orders remain eligible and include refund information', () => {
  const order = sampleOrder({
    paymentStatus: 'refunded',
    orderStatus: 'refunded',
    refundSummary: {
      status: 'processed',
      amount: 3299,
      initiatedAt: new Date('2026-07-19T10:00:00.000Z'),
      processedAt: new Date('2026-07-20T10:00:00.000Z'),
      acquirerReference: 'ARN123',
    },
  });

  assert.equal(canGenerateInvoice(order), true);
  const data = buildInvoiceData(order);
  assert.equal(data.refund.refunded, true);
  assert.equal(data.refund.amount, 3299);
});

test('formats invoice numbers with prefix, year and atomic-counter sequence value', () => {
  env.invoicePrefix = 'AMR-INV';

  assert.equal(formatInvoiceNumber(7, new Date('2026-07-18T10:00:00.000Z')), 'AMR-INV-2026-000007');
});

test('generates an in-memory PDF with safe filename and logo fallback', async () => {
  env.invoiceDocumentType = 'receipt';
  env.invoiceLogoUrl = 'not-a-local-file-path';
  const data = buildInvoiceData(sampleOrder());
  const buffer = await generateInvoicePdf(data);

  assert.equal(buffer.subarray(0, 4).toString(), '%PDF');
  assert.equal(createInvoiceFilename(data.order.invoice.number), 'Amorah-Invoice-AMR-INV-2026-000001.pdf');
  assert.ok(buffer.length > 1000);
});
