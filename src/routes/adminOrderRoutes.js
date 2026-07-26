import { Router } from 'express';
import { downloadAdminInvoice } from '../controllers/adminInvoiceController.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import validateRequest from '../middleware/validateRequest.js';
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
  processOrder,
  retryOrderNotification,
  updateOrderStatus,
  updatePaymentStatus,
} from '../controllers/adminOrderController.js';

const router = Router();

router.use(authenticate, authorize('admin'));

router.get('/', listAdminOrders);
router.get('/stats', getAdminOrderStats);
router.get('/:orderNumber/invoice', invoiceOrderNumberValidator, validateRequest, downloadAdminInvoice);
router.get('/:orderId', getAdminOrder);
router.patch('/:orderId/confirm', confirmOrder);
router.patch('/:orderId/process', processOrder);
router.patch('/:orderId/pack', packOrder);
router.patch('/:orderId/dispatch', dispatchOrder);
router.patch('/:orderId/out-for-delivery', outForDeliveryOrder);
router.patch('/:orderId/deliver', deliverOrder);
router.patch('/:orderId/order-status', updateOrderStatus);
router.patch('/:orderId/payment-status', updatePaymentStatus);
router.patch('/:orderId/cancel', cancelOrder);
router.post('/:orderId/retry-notification', retryOrderNotification);

export default router;
