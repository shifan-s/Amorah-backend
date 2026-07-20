import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import { getInvoiceEligibilityReason } from '../utils/invoiceEligibility.js';

function clean(value = '') {
  return String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
}

function requireFields(fields, message) {
  if (fields.some((field) => !clean(field))) {
    throw new ApiError(503, message, []);
  }
}

function hasStoredTaxBreakdown(order) {
  return Array.isArray(order.taxBreakdown) && order.taxBreakdown.length > 0;
}

export function buildBusinessDetails(order) {
  if (!env.invoiceEnabled) {
    throw new ApiError(503, 'Invoice generation is currently disabled.', []);
  }

  const documentType = env.invoiceDocumentType;
  const address = {
    line1: clean(env.businessAddressLine1),
    line2: clean(env.businessAddressLine2),
    city: clean(env.businessCity),
    state: clean(env.businessState),
    postalCode: clean(env.businessPostalCode),
    country: clean(env.businessCountry || 'India'),
  };

  if (documentType === 'invoice') {
    requireFields(
      [env.businessLegalName || env.businessDisplayName, address.line1, address.city, address.state, address.postalCode, address.country],
      'Invoice mode requires complete business name and address configuration.',
    );
  }

  if (documentType === 'tax_invoice') {
    requireFields(
      [
        env.businessLegalName,
        address.line1,
        address.city,
        address.state,
        address.postalCode,
        address.country,
        env.businessGstin,
        env.businessStateCode,
      ],
      'Tax Invoice mode requires complete business legal, address, GSTIN and state-code configuration. Use receipt or invoice mode until tax details are finalized.',
    );

    if (!hasStoredTaxBreakdown(order)) {
      throw new ApiError(
        503,
        'Tax Invoice mode requires stored order tax breakdown and taxable product information. Use receipt or invoice mode until tax details are finalized.',
        [],
      );
    }
  }

  return {
    documentType,
    heading: documentType === 'tax_invoice' ? 'Tax Invoice' : documentType === 'invoice' ? 'Invoice' : 'Order Receipt',
    legalName: clean(env.businessLegalName),
    displayName: clean(env.businessDisplayName || 'Amorah'),
    brandLine: 'BY N-ZAN DESIGNS',
    address,
    email: clean(env.businessEmail || env.supportEmail),
    phone: clean(env.businessPhone),
    website: clean(env.businessWebsite || env.frontendUrl),
    gstin: clean(env.businessGstin),
    pan: clean(env.businessPan),
    stateCode: clean(env.businessStateCode),
    logoUrl: clean(env.invoiceLogoUrl),
    footerText: clean(env.invoiceFooterText),
  };
}

export function buildCustomerDetails(order) {
  return {
    billingAddress: { ...order.billingAddress },
    shippingAddress: { ...order.shippingAddress },
  };
}

export function buildInvoiceItems(order) {
  return (order.items || []).map((item) => ({
    productName: clean(item.productName),
    sku: clean(item.sku),
    colourName: clean(item.colourName),
    size: clean(item.size),
    quantity: Number(item.quantity) || 0,
    unitPrice: Number(item.unitPrice) || 0,
    lineTotal: Number(item.lineTotal) || 0,
  }));
}

export function buildInvoiceTotals(order) {
  return {
    subtotal: Number(order.subtotal) || 0,
    shippingCharge: Number(order.shippingCharge) || 0,
    tax: Number(order.tax) || 0,
    total: Number(order.total) || 0,
    currency: order.currency || 'INR',
  };
}

export function buildRefundDetails(order) {
  const refund = order.refundSummary || {};
  const refunded = order.paymentStatus === 'refunded' || order.orderStatus === 'refunded' || refund.status === 'processed';

  return {
    applicable: ['required', 'initiating', 'pending', 'processed', 'failed'].includes(refund.status) || refunded,
    refunded,
    status: refund.status || (refunded ? 'processed' : 'none'),
    amount: Number(refund.amount) || (refunded ? Number(order.total) || 0 : 0),
    initiatedAt: refund.initiatedAt || null,
    processedAt: refund.processedAt || null,
    acquirerReference: clean(refund.acquirerReference),
  };
}

export function buildInvoiceData(order) {
  const reason = getInvoiceEligibilityReason(order);

  if (reason) {
    throw new ApiError(400, reason, []);
  }

  return {
    business: buildBusinessDetails(order),
    order: {
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      invoice: {
        number: order.invoice?.number || '',
        documentType: order.invoice?.documentType || env.invoiceDocumentType,
        issuedAt: order.invoice?.issuedAt || null,
        generatedAt: order.invoice?.generatedAt || null,
      },
    },
    customer: buildCustomerDetails(order),
    items: buildInvoiceItems(order),
    totals: buildInvoiceTotals(order),
    refund: buildRefundDetails(order),
  };
}

