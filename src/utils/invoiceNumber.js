import env from '../config/env.js';
import Counter from '../models/Counter.js';
import Order from '../models/Order.js';

function safePrefix() {
  return String(env.invoicePrefix || 'AMR-INV')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'AMR-INV';
}

function invoiceCounterKey(year) {
  return `invoice:${safePrefix()}:${year}`;
}

export function formatInvoiceNumber(sequence, date = new Date()) {
  const year = date.getFullYear();
  return `${safePrefix()}-${year}-${String(sequence).padStart(6, '0')}`;
}

async function nextInvoiceNumber(date = new Date()) {
  const year = date.getFullYear();
  const counter = await Counter.findOneAndUpdate(
    { key: invoiceCounterKey(year) },
    { $inc: { sequence: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  return formatInvoiceNumber(counter.sequence, date);
}

export async function getOrCreateInvoiceNumber(order) {
  const orderId = order?._id;

  if (!orderId) {
    throw new Error('Order is required before assigning an invoice number.');
  }

  const existing = await Order.findById(orderId);

  if (!existing) {
    throw new Error('Order not found while assigning invoice number.');
  }

  if (existing.invoice?.number) {
    return existing.invoice.number;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const issuedAt = new Date();
    const number = await nextInvoiceNumber(issuedAt);

    try {
      const updated = await Order.findOneAndUpdate(
        {
          _id: orderId,
          $or: [
            { 'invoice.number': { $exists: false } },
            { 'invoice.number': '' },
            { 'invoice.number': null },
          ],
        },
        {
          $set: {
            'invoice.number': number,
            'invoice.documentType': env.invoiceDocumentType,
            'invoice.issuedAt': issuedAt,
            'invoice.version': existing.invoice?.version || 1,
          },
        },
        { new: true, runValidators: true },
      );

      if (updated?.invoice?.number) {
        return updated.invoice.number;
      }

      const reloaded = await Order.findById(orderId);
      if (reloaded?.invoice?.number) {
        return reloaded.invoice.number;
      }

      throw new Error('Order not found while assigning invoice number.');
    } catch (error) {
      if (error?.code !== 11000) {
        throw error;
      }
    }
  }

  const reloaded = await Order.findById(orderId);
  if (reloaded?.invoice?.number) {
    return reloaded.invoice.number;
  }

  throw new Error('Unable to assign a unique invoice number. Please try again.');
}
