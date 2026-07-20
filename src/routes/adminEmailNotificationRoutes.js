import { Router } from 'express';
import {
  listEmailNotifications,
  retryEmailNotification,
} from '../controllers/adminEmailNotificationController.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import validateRequest from '../middleware/validateRequest.js';
import {
  listEmailNotificationsValidator,
  retryEmailNotificationValidator,
} from '../validators/emailNotificationValidators.js';

const router = Router();

router.use(authenticate, authorize('admin'));

router.get('/', listEmailNotificationsValidator, validateRequest, listEmailNotifications);
router.post('/:notificationId/retry', retryEmailNotificationValidator, validateRequest, retryEmailNotification);

export default router;
