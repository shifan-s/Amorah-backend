import Order from '../models/Order.js';
import { buildInvoiceData } from '../services/invoiceDataService.js';
import { createInvoiceFilename, generateInvoicePdf } from '../services/invoiceService.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { getInvoiceEligibilityReason } from '../utils/invoiceEligibility.js';
import { getOrCreateInvoiceNumber } from '../utils/invoiceNumber.js';

async function downloadInvoiceForOrder(res, order) {
  const eligibilityReason = getInvoiceEligibilityReason(order);

  if (eligibilityReason) {
    throw new ApiError(400, eligibilityReason, []);
  }

  await getOrCreateInvoiceNumber(order);
  const freshOrder = await Order.findById(order._id);

  if (!freshOrder) {
    throw new ApiError(404, 'Order not found', []);
  }

  const data = buildInvoiceData(freshOrder);
  const buffer = await generateInvoicePdf(data);
  freshOrder.invoice.generatedAt = new Date();
  await freshOrder.save();

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${createInvoiceFilename(freshOrder.invoice.number)}"`,
    'Content-Length': buffer.length,
    'Cache-Control': 'private, no-store, max-age=0',
    Pragma: 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(buffer);
}

export const downloadCustomerInvoice = asyncHandler(async (req, res) => {
  const order = await Order.findOne({
    customer: req.user.id,
    orderNumber: String(req.params.orderNumber || '').trim().toUpperCase(),
  });

  if (!order) {
    throw new ApiError(404, 'Order not found', []);
  }

  await downloadInvoiceForOrder(res, order);
});

export { downloadInvoiceForOrder };

