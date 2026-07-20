import asyncHandler from '../utils/asyncHandler.js';
import {
  archiveProduct,
  createProduct,
  getAdminProductById,
  getAdminProducts,
  updateProduct,
  updateProductStatus,
  updateVariantStock,
} from '../services/productService.js';

export const listAdminProducts = asyncHandler(async (req, res) => {
  const result = await getAdminProducts(req.query);

  res.status(200).json({
    success: true,
    message: 'Admin products retrieved successfully',
    data: result,
  });
});

export const getAdminProduct = asyncHandler(async (req, res) => {
  const product = await getAdminProductById(req.params.productId);

  res.status(200).json({
    success: true,
    message: 'Admin product retrieved successfully',
    data: {
      product,
    },
  });
});

export const createAdminProduct = asyncHandler(async (req, res) => {
  const product = await createProduct(req.body, req.user.id);

  res.status(201).json({
    success: true,
    message: 'Product created successfully',
    data: {
      product,
    },
  });
});

export const updateAdminProduct = asyncHandler(async (req, res) => {
  const product = await updateProduct(req.params.productId, req.body, req.user.id);

  res.status(200).json({
    success: true,
    message: 'Product updated successfully',
    data: {
      product,
    },
  });
});

export const updateAdminProductStatus = asyncHandler(async (req, res) => {
  const product = await updateProductStatus(req.params.productId, req.body.status, req.user.id);

  res.status(200).json({
    success: true,
    message: 'Product status updated successfully',
    data: {
      product,
    },
  });
});

export const updateAdminProductStock = asyncHandler(async (req, res) => {
  const result = await updateVariantStock(req.params.productId, req.body, req.user.id);

  res.status(200).json({
    success: true,
    message: 'Product stock updated successfully',
    data: result,
  });
});

export const archiveAdminProduct = asyncHandler(async (req, res) => {
  const product = await archiveProduct(req.params.productId, req.user.id);

  res.status(200).json({
    success: true,
    message: 'Product archived successfully',
    data: {
      product,
    },
  });
});
