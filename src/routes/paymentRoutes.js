import rateLimit from 'express-rate-limit';
import { Router } from 'express';
import {
  createPaymentOrder,
  getRazorpayPaymentStatus,
  verifyPayment,
} from '../controllers/paymentController.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import maintenanceMode from '../middleware/maintenanceMode.js';
import validateRequest from '../middleware/validateRequest.js';
import {
  createRazorpayOrderValidator,
  razorpayStatusValidator,
  verifyRazorpayPaymentValidator,
} from '../validators/paymentValidators.js';

const router = Router();

const paymentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 40,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

router.use(authenticate, authorize('customer'), paymentLimiter);

router.post('/razorpay/create-order', maintenanceMode, createRazorpayOrderValidator, validateRequest, createPaymentOrder);
router.post('/razorpay/verify', verifyRazorpayPaymentValidator, validateRequest, verifyPayment);
router.get('/razorpay/status/:orderNumber', razorpayStatusValidator, validateRequest, getRazorpayPaymentStatus);

export default router;
