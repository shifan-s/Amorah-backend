import { processRazorpayWebhook } from '../services/paymentService.js';
import asyncHandler from '../utils/asyncHandler.js';

export const handleRazorpayWebhook = asyncHandler(async (req, res) => {
  await processRazorpayWebhook(req.body, req.headers);

  res.status(200).json({
    success: true,
  });
});
