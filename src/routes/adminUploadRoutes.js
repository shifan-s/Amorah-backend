import { Router } from 'express';
import { deleteAdminImage, uploadAdminImages } from '../controllers/uploadController.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import { multipleImagesUpload } from '../middleware/upload.js';
import validateRequest from '../middleware/validateRequest.js';
import { deleteImageValidator, uploadImagesValidator } from '../validators/uploadValidators.js';

const router = Router();

router.post(
  '/images',
  authenticate,
  authorize('admin'),
  multipleImagesUpload,
  uploadImagesValidator,
  validateRequest,
  uploadAdminImages,
);

router.delete('/images', authenticate, authorize('admin'), deleteImageValidator, validateRequest, deleteAdminImage);

export default router;
