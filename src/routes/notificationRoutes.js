import { Router } from 'express';
import { param } from 'express-validator';
import { listMyNotifications, readAllNotifications, readNotification } from '../controllers/notificationController.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import validateRequest from '../middleware/validateRequest.js';

const router = Router();
router.use(authenticate, authorize('customer'));
router.get('/', listMyNotifications);
router.patch('/read-all', readAllNotifications);
router.patch(
  '/:notificationId/read',
  param('notificationId').isMongoId().withMessage('Notification ID is invalid'),
  validateRequest,
  readNotification,
);
export default router;
