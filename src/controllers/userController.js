import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { getCurrentUser, updateCustomerProfile } from '../services/authService.js';

export const getMe = asyncHandler(async (req, res) => {
  const user = await getCurrentUser(req.user.id);
  res.json({ success: true, message: 'Profile retrieved successfully', data: { user } });
});

export const updateMe = asyncHandler(async (req, res) => {
  const user = await updateCustomerProfile(req.user.id, req.body);
  res.json({ success: true, message: 'Profile updated successfully', data: { user } });
});

export const listCustomers = asyncHandler(async (req, res) => {
  const search = String(req.query.search || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const filter = { role: 'customer' };
  if (search) {
    const expression = new RegExp(search, 'i');
    filter.$or = [{ fullName: expression }, { email: expression }, { mobile: expression }];
  }
  const customers = await User.find(filter).sort({ createdAt: -1 }).limit(100);
  res.json({ success: true, message: 'Customers retrieved successfully', data: { customers: customers.map((user) => user.toSafeObject()) } });
});

export const getCustomer = asyncHandler(async (req, res) => {
  const customer = await User.findOne({ _id: req.params.customerId, role: 'customer' });
  if (!customer) throw new ApiError(404, 'Customer not found.', []);
  res.json({ success: true, message: 'Customer retrieved successfully', data: { customer: customer.toSafeObject() } });
});
