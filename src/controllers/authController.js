import { clearAuthCookieOptions, getAuthCookieOptions } from '../config/authCookie.js';
import env from '../config/env.js';
import asyncHandler from '../utils/asyncHandler.js';
import {
  changeCustomerPassword,
  getCurrentUser,
  loginCustomer,
  refreshCustomerSession,
  revokeCustomerSession,
  registerCustomer,
  updateCustomerProfile,
} from '../services/authService.js';

function setAuthCookie(res, token) {
  res.cookie(env.authCookieName, token, getAuthCookieOptions());
}

export const register = asyncHandler(async (req, res) => {
  const { user, token, refreshToken } = await registerCustomer(req.body);

  setAuthCookie(res, refreshToken);

  res.status(201).json({
    success: true,
    message: 'Account created successfully',
    data: {
      user,
      accessToken: token,
    },
  });
});

export const login = asyncHandler(async (req, res) => {
  const { user, token, refreshToken } = await loginCustomer(req.body);

  setAuthCookie(res, refreshToken);

  res.status(200).json({
    success: true,
    message: 'Logged in successfully',
    data: {
      user,
      accessToken: token,
    },
  });
});

export const refresh = asyncHandler(async (req, res) => {
  const currentRefreshToken = req.cookies?.[env.authCookieName];
  const { user, token, refreshToken } = await refreshCustomerSession(currentRefreshToken);
  setAuthCookie(res, refreshToken);

  res.status(200).json({
    success: true,
    message: 'Session refreshed',
    data: { user, accessToken: token },
  });
});

export const logout = asyncHandler(async (req, res) => {
  await revokeCustomerSession(req.cookies?.[env.authCookieName]);
  res.clearCookie(env.authCookieName, clearAuthCookieOptions());

  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
});

export const me = asyncHandler(async (req, res) => {
  const user = await getCurrentUser(req.user.id);

  res.status(200).json({
    success: true,
    message: 'Authenticated user retrieved successfully',
    data: {
      user,
    },
  });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await updateCustomerProfile(req.user.id, req.body);

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user,
    },
  });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { user, token } = await changeCustomerPassword(req.user.id, req.body);

  res.status(200).json({
    success: true,
    message: 'Password changed successfully',
    data: {
      user,
    },
  });
});
