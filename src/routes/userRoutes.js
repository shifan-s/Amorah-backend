import { Router } from 'express';
import { param } from 'express-validator';
import { getMe, updateMe } from '../controllers/userController.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import validateRequest from '../middleware/validateRequest.js';
import { updateProfileValidator } from '../validators/authValidators.js';

const router = Router();
router.use(authenticate, authorize('customer'));
router.get('/me', getMe);
router.patch('/me', updateProfileValidator, validateRequest, updateMe);
export default router;
