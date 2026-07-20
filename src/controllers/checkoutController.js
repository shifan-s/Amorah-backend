import { buildCheckoutPreview } from '../services/checkoutService.js';
import asyncHandler from '../utils/asyncHandler.js';

export const createCheckoutPreview = asyncHandler(async (req, res) => {
  const preview = await buildCheckoutPreview(req.user, req.body);

  res.status(200).json({
    success: true,
    message: 'Checkout preview created successfully',
    data: {
      preview,
    },
  });
});
