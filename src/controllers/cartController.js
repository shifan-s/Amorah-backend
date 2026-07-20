import asyncHandler from '../utils/asyncHandler.js';
import {
  addCartItem,
  clearCustomerCart,
  getCustomerCart,
  mergeGuestCart,
  removeCartItem,
  updateCartItemQuantity,
} from '../services/cartService.js';

export const getCart = asyncHandler(async (req, res) => {
  const cart = await getCustomerCart(req.user.id);

  res.status(200).json({
    success: true,
    message: 'Cart retrieved successfully',
    data: {
      cart,
    },
  });
});

export const addItem = asyncHandler(async (req, res) => {
  const { cart, created } = await addCartItem(req.user.id, req.body);

  res.status(created ? 201 : 200).json({
    success: true,
    message: 'Product added to cart',
    data: {
      cart,
    },
  });
});

export const updateItem = asyncHandler(async (req, res) => {
  const cart = await updateCartItemQuantity(req.user.id, req.params.itemId, req.body.quantity);

  res.status(200).json({
    success: true,
    message: 'Cart quantity updated',
    data: {
      cart,
    },
  });
});

export const removeItem = asyncHandler(async (req, res) => {
  const cart = await removeCartItem(req.user.id, req.params.itemId);

  res.status(200).json({
    success: true,
    message: 'Product removed from cart',
    data: {
      cart,
    },
  });
});

export const clearCart = asyncHandler(async (req, res) => {
  const cart = await clearCustomerCart(req.user.id);

  res.status(200).json({
    success: true,
    message: 'Cart cleared successfully',
    data: {
      cart,
    },
  });
});

export const mergeCart = asyncHandler(async (req, res) => {
  const { cart, warnings } = await mergeGuestCart(req.user.id, req.body.items);

  res.status(200).json({
    success: true,
    message: 'Guest cart merged successfully',
    data: {
      cart,
      warnings,
    },
  });
});
