import { getCustomerOrderByNumber, getCustomerOrders } from '../services/orderService.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

export const listMyOrders = asyncHandler(async (req, res) => {
  const result = await getCustomerOrders(req.user.id, req.query);

  res.status(200).json({
    success: true,
    message: 'Orders retrieved successfully',
    data: result,
  });
});

export const getMyOrderByNumber = asyncHandler(async (req, res) => {
  const order = await getCustomerOrderByNumber(req.user.id, req.params.orderNumber);

  if (!order) {
    throw new ApiError(404, 'Order not found', []);
  }

  res.status(200).json({
    success: true,
    message: 'Order retrieved successfully',
    data: {
      order,
    },
  });
});
