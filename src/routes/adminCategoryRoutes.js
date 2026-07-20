import { Router } from 'express';
import {
  changeCategory,
  listAdminCategories,
  removeCategory,
  showAdminCategory,
  storeCategory,
} from '../controllers/categoryController.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import validateRequest from '../middleware/validateRequest.js';
import {
  categoryIdOnlyValidator,
  createCategoryValidator,
  listCategoryValidator,
  updateCategoryValidator,
} from '../validators/categoryValidators.js';

const router = Router();

router.use(authenticate, authorize('admin'));

router.get('/', listCategoryValidator, validateRequest, listAdminCategories);
router.post('/', createCategoryValidator, validateRequest, storeCategory);
router.get('/:categoryId', categoryIdOnlyValidator, validateRequest, showAdminCategory);
router.patch('/:categoryId', updateCategoryValidator, validateRequest, changeCategory);
router.delete('/:categoryId', categoryIdOnlyValidator, validateRequest, removeCategory);

export default router;
