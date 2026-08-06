import {
  createRazorpayPaymentOrder,
  getPaymentStatus,
  verifyRazorpayPayment,
} from '../services/paymentService.js';
import asyncHandler from '../utils/asyncHandler.js';

export const createPaymentOrder = asyncHandler(async (req, res) => {
  const payment = await createRazorpayPaymentOrder(req.user, req.body);

  res.status(201).json({
    success: true,
    message: 'Secure payment order created successfully',
    keyId: payment.keyId,
    order: payment.order,
    data: {
      payment,
    },
  });
});

export const verifyPayment = asyncHandler(async (req, res) => {
  const order = await verifyRazorpayPayment(req.user.id, req.body);

  res.status(200).json({
    success: true,
    message:
      order.paymentStatus === 'paid' && order.orderStatus === 'confirmed'
        ? 'Payment verified successfully'
        : order.message,
    data: {
      order,
    },
  });
});

export const getRazorpayPaymentStatus = asyncHandler(async (req, res) => {
  const payment = await getPaymentStatus(req.user.id, req.params.orderNumber);

  res.status(200).json({
    success: true,
    message: 'Payment status retrieved successfully',
    data: {
      payment,
    },
  });
});
