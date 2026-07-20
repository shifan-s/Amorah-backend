import asyncHandler from '../utils/asyncHandler.js';
import {
  getBestSellerProducts,
  getFeaturedProducts,
  getNewArrivalProducts,
  getPublicProductBySlug,
  getPublicProducts,
  getRelatedProducts,
} from '../services/productService.js';

export const listProducts = asyncHandler(async (req, res) => {
  const result = await getPublicProducts(req.query);

  res.status(200).json({
    success: true,
    message: 'Products retrieved successfully',
    data: result,
  });
});

export const getProduct = asyncHandler(async (req, res) => {
  const product = await getPublicProductBySlug(req.params.slug);

  res.status(200).json({
    success: true,
    message: 'Product retrieved successfully',
    data: {
      product,
      breadcrumbs: [
        { name: 'Home', path: '/' },
        { name: 'Shop', path: '/shop' },
        ...(product.mainCategory ? [{ name: product.mainCategory.name, slug: product.mainCategory.slug }] : []),
        ...(product.subcategory ? [{ name: product.subcategory.name, slug: product.subcategory.slug }] : []),
        { name: product.name, slug: product.slug },
      ],
    },
  });
});

export const listFeaturedProducts = asyncHandler(async (req, res) => {
  const result = await getFeaturedProducts(req.query);

  res.status(200).json({
    success: true,
    message: 'Featured products retrieved successfully',
    data: result,
  });
});

export const listNewArrivals = asyncHandler(async (req, res) => {
  const result = await getNewArrivalProducts(req.query);

  res.status(200).json({
    success: true,
    message: 'New arrival products retrieved successfully',
    data: result,
  });
});

export const listBestSellers = asyncHandler(async (req, res) => {
  const result = await getBestSellerProducts(req.query);

  res.status(200).json({
    success: true,
    message: 'Best seller products retrieved successfully',
    data: result,
  });
});

export const listRelatedProducts = asyncHandler(async (req, res) => {
  const products = await getRelatedProducts(req.params.slug, req.query);

  res.status(200).json({
    success: true,
    message: 'Related products retrieved successfully',
    data: {
      products,
    },
  });
});
