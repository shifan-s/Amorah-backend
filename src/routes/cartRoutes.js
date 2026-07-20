import { Router } from 'express';
import {
  addItem,
  clearCart,
  getCart,
  mergeCart,
  removeItem,
  updateItem,
} from '../controllers/cartController.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import validateRequest from '../middleware/validateRequest.js';
import {
  addCartItemValidator,
  cartItemIdValidator,
  mergeCartValidator,
  updateCartItemValidator,
} from '../validators/cartValidators.js';

const router = Router();

router.use(authenticate, authorize('customer'));

router.get('/', getCart);
router.post('/items', addCartItemValidator, validateRequest, addItem);
router.patch('/items/:itemId', updateCartItemValidator, validateRequest, updateItem);
router.delete('/items/:itemId', cartItemIdValidator, validateRequest, removeItem);
router.delete('/', clearCart);
router.post('/merge', mergeCartValidator, validateRequest, mergeCart);

export default router;
