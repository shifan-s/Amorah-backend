import { Router } from 'express';
import { downloadCustomerInvoice } from '../controllers/invoiceController.js';
import { getMyOrderByNumber, listMyOrders } from '../controllers/orderController.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import validateRequest from '../middleware/validateRequest.js';
import { invoiceOrderNumberValidator } from '../validators/invoiceValidators.js';
import { myOrdersQueryValidator, orderNumberValidator } from '../validators/orderValidators.js';

const router = Router();

router.use(authenticate, authorize('customer'));

router.get('/my', myOrdersQueryValidator, validateRequest, listMyOrders);
router.get('/:orderNumber/invoice', invoiceOrderNumberValidator, validateRequest, downloadCustomerInvoice);
router.get('/:orderNumber', orderNumberValidator, validateRequest, getMyOrderByNumber);

export default router;
