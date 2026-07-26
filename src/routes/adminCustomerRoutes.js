import { Router } from 'express';
import { param } from 'express-validator';
import { getCustomer, listCustomers } from '../controllers/userController.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import validateRequest from '../middleware/validateRequest.js';

const router = Router();
router.use(authenticate, authorize('admin'));
router.get('/', listCustomers);
router.get('/:customerId', param('customerId').isMongoId().withMessage('Customer ID is invalid'), validateRequest, getCustomer);
export default router;
