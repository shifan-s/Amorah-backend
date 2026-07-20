import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { hashPassword } from '../utils/password.js';
import { signAuthToken } from '../utils/jwt.js';

const invalidLoginMessage = 'Invalid email or password.';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeMobile(mobile) {
  if (mobile === undefined || mobile === null || mobile === '') {
    return undefined;
  }

  return String(mobile).replace(/\D/g, '');
}

async function assertMobileAvailable(mobile, currentUserId) {
  const normalizedMobile = normalizeMobile(mobile);

  if (!normalizedMobile) {
    return normalizedMobile;
  }

  const query = { mobile: normalizedMobile };

  if (currentUserId) {
    query._id = { $ne: currentUserId };
  }

  const existingUser = await User.findOne(query).select('_id');

  if (existingUser) {
    throw new ApiError(409, 'Mobile number is already registered');
  }

  return normalizedMobile;
}

function ensureActiveUser(user) {
  if (!user || user.status === 'disabled') {
    throw new ApiError(401, 'Authentication required');
  }
}

export async function registerCustomer(payload) {
  const email = normalizeEmail(payload.email);
  const existingEmail = await User.findOne({ email }).select('_id');

  if (existingEmail) {
    throw new ApiError(409, 'Email is already registered');
  }

  const mobile = await assertMobileAvailable(payload.mobile);
  const passwordHash = await hashPassword(payload.password);

  const user = await User.create({
    fullName: payload.fullName,
    email,
    mobile,
    passwordHash,
    role: 'customer',
    status: 'active',
  });

  const token = signAuthToken(user);

  return {
    user: user.toSafeObject(),
    token,
  };
}

export async function loginCustomer(payload) {
  const email = normalizeEmail(payload.email);
  const user = await User.findOne({ email }).select('+passwordHash');

  if (!user) {
    throw new ApiError(401, invalidLoginMessage);
  }

  if (user.status === 'disabled') {
    throw new ApiError(403, 'Account is disabled');
  }

  const isPasswordValid = await user.comparePassword(payload.password);

  if (!isPasswordValid) {
    throw new ApiError(401, invalidLoginMessage);
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = signAuthToken(user);

  return {
    user: user.toSafeObject(),
    token,
  };
}

export async function getCurrentUser(userId) {
  const user = await User.findById(userId);
  ensureActiveUser(user);

  return user.toSafeObject();
}

export async function updateCustomerProfile(userId, payload) {
  const user = await User.findById(userId);
  ensureActiveUser(user);

  if (Object.prototype.hasOwnProperty.call(payload, 'fullName')) {
    user.fullName = payload.fullName;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'mobile')) {
    user.mobile = await assertMobileAvailable(payload.mobile, user._id);
  }

  await user.save();

  return user.toSafeObject();
}

export async function changeCustomerPassword(userId, payload) {
  const user = await User.findById(userId).select('+passwordHash');
  ensureActiveUser(user);

  const isPasswordValid = await user.comparePassword(payload.currentPassword);

  if (!isPasswordValid) {
    throw new ApiError(400, 'Current password is incorrect');
  }

  user.passwordHash = await hashPassword(payload.newPassword);
  await user.save();

  const token = signAuthToken(user);

  return {
    user: user.toSafeObject(),
    token,
  };
}
