import { processRazorpayWebhook } from '../services/paymentService.js';
import env from '../config/env.js';
import asyncHandler from '../utils/asyncHandler.js';

export const handleRazorpayWebhook = asyncHandler(async (req, res) => {
  try {
    const result = await processRazorpayWebhook(req.body, req.headers);

    if (env.nodeEnv === 'development') {
      const duplicateLabel = result?.duplicate ? ' (duplicate acknowledged)' : '';
      console.info(`[Razorpay Webhook] Processed successfully${duplicateLabel} — HTTP 200`);
    }

    res.status(200).json({
      success: true,
    });
  } catch (error) {
    if (env.nodeEnv === 'development') {
      console.error(
        `[Razorpay Webhook] Processing failed — HTTP ${error?.statusCode || 500}`,
      );
    }
    throw error;
  }
});
