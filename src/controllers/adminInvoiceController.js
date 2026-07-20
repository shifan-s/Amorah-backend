import Order from '../models/Order.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { downloadInvoiceForOrder } from './invoiceController.js';

export const downloadAdminInvoice = asyncHandler(async (req, res) => {
  const order = await Order.findOne({
    orderNumber: String(req.params.orderNumber || '').trim().toUpperCase(),
  });

  if (!order) {
    throw new ApiError(404, 'Order not found', []);
  }

  await downloadInvoiceForOrder(res, order);
});

