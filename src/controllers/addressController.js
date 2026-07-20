import asyncHandler from '../utils/asyncHandler.js';
import {
  addAddress,
  deleteAddress,
  getAddresses,
  setDefaultAddress,
  updateAddress,
} from '../services/addressService.js';

export const listAddresses = asyncHandler(async (req, res) => {
  const addresses = await getAddresses(req.user.id);

  res.status(200).json({
    success: true,
    message: 'Addresses retrieved successfully',
    data: {
      addresses,
    },
  });
});

export const createAddress = asyncHandler(async (req, res) => {
  const result = await addAddress(req.user.id, req.body);

  res.status(201).json({
    success: true,
    message: 'Address added successfully',
    data: result,
  });
});

export const editAddress = asyncHandler(async (req, res) => {
  const addresses = await updateAddress(req.user.id, req.params.addressId, req.body);

  res.status(200).json({
    success: true,
    message: 'Address updated successfully',
    data: {
      addresses,
    },
  });
});

export const removeAddress = asyncHandler(async (req, res) => {
  const addresses = await deleteAddress(req.user.id, req.params.addressId);

  res.status(200).json({
    success: true,
    message: 'Address deleted successfully',
    data: {
      addresses,
    },
  });
});

export const makeDefaultAddress = asyncHandler(async (req, res) => {
  const addresses = await setDefaultAddress(req.user.id, req.params.addressId);

  res.status(200).json({
    success: true,
    message: 'Default address updated successfully',
    data: {
      addresses,
    },
  });
});
