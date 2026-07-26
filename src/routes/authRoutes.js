import { Router } from 'express';
import {
  changePassword,
  login,
  refresh,
  logout,
  me,
  register,
  updateProfile,
} from '../controllers/authController.js';
import authenticate from '../middleware/authenticate.js';
import authRateLimiter from '../middleware/authRateLimiter.js';
import validateRequest from '../middleware/validateRequest.js';
import {
  changePasswordValidator,
  loginValidator,
  registerValidator,
  updateProfileValidator,
} from '../validators/authValidators.js';

const router = Router();

router.post('/register', authRateLimiter, registerValidator, validateRequest, register);
router.post('/login', authRateLimiter, loginValidator, validateRequest, login);
router.post('/refresh', authRateLimiter, refresh);
router.post('/logout', logout);
router.get('/me', authenticate, me);
router.patch('/profile', authenticate, updateProfileValidator, validateRequest, updateProfile);
router.patch(
  '/change-password',
  authenticate,
  authRateLimiter,
  changePasswordValidator,
  validateRequest,
  changePassword,
);

export default router;
