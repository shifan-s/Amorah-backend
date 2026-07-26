import { Router } from 'express';
import { getAdminOrderStats } from '../controllers/adminOrderController.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';

const router = Router();
router.get('/', authenticate, authorize('admin'), getAdminOrderStats);
export default router;
