import asyncHandler from '../utils/asyncHandler.js';
import {
  createCategory,
  deactivateCategory,
  getAdminCategories,
  getAdminCategory,
  getPublicCategories,
  getPublicCategoryBySlug,
  updateCategory,
} from '../services/categoryService.js';

export const listAdminCategories = asyncHandler(async (req, res) => {
  const result = await getAdminCategories(req.query);

  res.status(200).json({
    success: true,
    message: 'Categories retrieved successfully',
    data: result,
  });
});

export const showAdminCategory = asyncHandler(async (req, res) => {
  const category = await getAdminCategory(req.params.categoryId);

  res.status(200).json({
    success: true,
    message: 'Category retrieved successfully',
    data: {
      category,
    },
  });
});

export const storeCategory = asyncHandler(async (req, res) => {
  const category = await createCategory(req.body);

  res.status(201).json({
    success: true,
    message: 'Category created successfully',
    data: {
      category,
    },
  });
});

export const changeCategory = asyncHandler(async (req, res) => {
  const category = await updateCategory(req.params.categoryId, req.body);

  res.status(200).json({
    success: true,
    message: 'Category updated successfully',
    data: {
      category,
    },
  });
});

export const removeCategory = asyncHandler(async (req, res) => {
  const category = await deactivateCategory(req.params.categoryId);

  res.status(200).json({
    success: true,
    message: 'Category deactivated successfully',
    data: {
      category,
    },
  });
});

export const listPublicCategories = asyncHandler(async (req, res) => {
  const categories = await getPublicCategories(req.query);

  res.status(200).json({
    success: true,
    message: 'Categories retrieved successfully',
    data: {
      categories,
    },
  });
});

export const showPublicCategory = asyncHandler(async (req, res) => {
  const category = await getPublicCategoryBySlug(req.params.slug);

  res.status(200).json({
    success: true,
    message: 'Category retrieved successfully',
    data: {
      category,
    },
  });
});
