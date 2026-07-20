import rateLimit from 'express-rate-limit';
import { Router } from 'express';
import {
  getRefundDetails,
  getRefundEligibilityForOrder,
  initiateOrderRefund,
  listRefunds,
  reconcileAdminRefund,
  retryAdminRefund,
} from '../controllers/adminRefundController.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import validateRequest from '../middleware/validateRequest.js';
import {
  initiateRefundValidator,
  listRefundsValidator,
  orderRefundEligibilityValidator,
  refundIdValidator,
} from '../validators/refundValidators.js';

const router = Router();

const refundWriteLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

router.use(authenticate, authorize('admin'));

router.get('/', listRefundsValidator, validateRequest, listRefunds);
router.get('/order/:orderNumber/eligibility', orderRefundEligibilityValidator, validateRequest, getRefundEligibilityForOrder);
router.post('/order/:orderNumber', refundWriteLimiter, initiateRefundValidator, validateRequest, initiateOrderRefund);
router.get('/:refundId', refundIdValidator, validateRequest, getRefundDetails);
router.post('/:refundId/reconcile', refundWriteLimiter, refundIdValidator, validateRequest, reconcileAdminRefund);
router.post('/:refundId/retry', refundWriteLimiter, refundIdValidator, validateRequest, retryAdminRefund);

export default router;
