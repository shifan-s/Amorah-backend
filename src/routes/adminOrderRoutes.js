import rateLimit from 'express-rate-limit';
import { Router } from 'express';
import { downloadAdminInvoice } from '../controllers/adminInvoiceController.js';
import {
  getRefundEligibilityForOrder,
  initiateOrderRefund,
} from '../controllers/adminRefundController.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import validateRequest from '../middleware/validateRequest.js';
import {
  initiateRefundValidator,
  orderRefundEligibilityValidator,
} from '../validators/refundValidators.js';
import { invoiceOrderNumberValidator } from '../validators/invoiceValidators.js';
import {
  cancelOrder,
  confirmOrder,
  deliverOrder,
  dispatchOrder,
  getAdminOrder,
  getAdminOrderStats,
  listAdminOrders,
  outForDeliveryOrder,
  packOrder,
  retryOrderNotification,
} from '../controllers/adminOrderController.js';

const router = Router();

const refundWriteLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

router.use(authenticate, authorize('admin'));

router.get('/', listAdminOrders);
router.get('/stats', getAdminOrderStats);
router.get('/:orderNumber/invoice', invoiceOrderNumberValidator, validateRequest, downloadAdminInvoice);
router.get('/:orderNumber/refund-eligibility', orderRefundEligibilityValidator, validateRequest, getRefundEligibilityForOrder);
router.post('/:orderNumber/refund', refundWriteLimiter, initiateRefundValidator, validateRequest, initiateOrderRefund);
router.get('/:orderId', getAdminOrder);
router.patch('/:orderId/confirm', confirmOrder);
router.patch('/:orderId/pack', packOrder);
router.patch('/:orderId/dispatch', dispatchOrder);
router.patch('/:orderId/out-for-delivery', outForDeliveryOrder);
router.patch('/:orderId/deliver', deliverOrder);
router.patch('/:orderId/cancel', cancelOrder);
router.post('/:orderId/retry-notification', retryOrderNotification);

export default router;
