import { Router } from 'express';
import {
  getProduct,
  listBestSellers,
  listFeaturedProducts,
  listNewArrivals,
  listProducts,
  listRelatedProducts,
} from '../controllers/productController.js';
import validateRequest from '../middleware/validateRequest.js';
import {
  productSlugValidator,
  publicProductListValidator,
} from '../validators/productValidators.js';

const router = Router();

router.get('/', publicProductListValidator, validateRequest, listProducts);
router.get('/featured', publicProductListValidator, validateRequest, listFeaturedProducts);
router.get('/new-arrivals', publicProductListValidator, validateRequest, listNewArrivals);
router.get('/best-sellers', publicProductListValidator, validateRequest, listBestSellers);
router.get('/:slug/related', productSlugValidator, validateRequest, listRelatedProducts);
router.get('/:slug', productSlugValidator, validateRequest, getProduct);

export default router;
