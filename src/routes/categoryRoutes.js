import { Router } from 'express';
import {
  listPublicCategories,
  showPublicCategory,
} from '../controllers/categoryController.js';
import validateRequest from '../middleware/validateRequest.js';
import { listCategoryValidator } from '../validators/categoryValidators.js';

const router = Router();

router.get('/', listCategoryValidator, validateRequest, listPublicCategories);
router.get('/:slug', showPublicCategory);

export default router;
