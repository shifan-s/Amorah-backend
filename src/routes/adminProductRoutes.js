import { Router } from 'express';
import {
  archiveAdminProduct,
  createAdminProduct,
  getAdminProduct,
  listAdminProducts,
  updateAdminProduct,
  updateAdminProductStatus,
  updateAdminProductStock,
} from '../controllers/adminProductController.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import validateRequest from '../middleware/validateRequest.js';
import {
  adminProductListValidator,
  createProductValidator,
  productIdOnlyValidator,
  updateProductStatusValidator,
  updateProductStockValidator,
  updateProductValidator,
} from '../validators/productValidators.js';

const router = Router();

router.use(authenticate, authorize('admin'));

router.get('/', adminProductListValidator, validateRequest, listAdminProducts);
router.post('/', createProductValidator, validateRequest, createAdminProduct);
router.get('/:productId', productIdOnlyValidator, validateRequest, getAdminProduct);
router.patch('/:productId', updateProductValidator, validateRequest, updateAdminProduct);
router.patch('/:productId/status', updateProductStatusValidator, validateRequest, updateAdminProductStatus);
router.patch('/:productId/stock', updateProductStockValidator, validateRequest, updateAdminProductStock);
router.delete('/:productId', productIdOnlyValidator, validateRequest, archiveAdminProduct);

export default router;
