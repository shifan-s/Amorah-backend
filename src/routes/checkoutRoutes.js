import { Router } from 'express';
import { createCheckoutPreview } from '../controllers/checkoutController.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import maintenanceMode from '../middleware/maintenanceMode.js';
import validateRequest from '../middleware/validateRequest.js';
import { checkoutPreviewValidator } from '../validators/checkoutValidators.js';

const router = Router();

router.use(authenticate, authorize('customer'));

router.post('/preview', maintenanceMode, checkoutPreviewValidator, validateRequest, createCheckoutPreview);

export default router;
