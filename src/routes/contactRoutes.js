import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { createContactEnquiry } from '../controllers/contactController.js';
import validateRequest from '../middleware/validateRequest.js';
import { createContactEnquiryValidator } from '../validators/contactValidators.js';

const router = Router();

const enquiryRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many enquiries were sent. Please wait before trying again.',
    errors: [],
  },
});

router.post(
  '/enquiries',
  enquiryRateLimiter,
  createContactEnquiryValidator,
  validateRequest,
  createContactEnquiry,
);

export default router;
