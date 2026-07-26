import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import ApiError from './ApiError.js';

export function signAuthToken(user) {
  return jwt.sign(
    {
      userId: user.id || user._id.toString(),
      role: user.role,
      type: 'access',
    },
    env.jwtSecret,
    {
      expiresIn: env.jwtExpiresIn,
    },
  );
}

export function verifyAuthToken(token) {
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    if (payload.type !== 'access') {
      throw new Error('Invalid token type');
    }
    return payload;
  } catch {
    throw new ApiError(401, 'Invalid or expired authentication token');
  }
}

export function signRefreshToken(user) {
  return jwt.sign(
    {
      userId: user.id || user._id.toString(),
      role: user.role,
      type: 'refresh',
    },
    env.jwtRefreshSecret,
    { expiresIn: env.jwtRefreshExpiresIn },
  );
}

export function verifyRefreshToken(token) {
  try {
    const payload = jwt.verify(token, env.jwtRefreshSecret);
    if (payload.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    return payload;
  } catch {
    throw new ApiError(401, 'Authentication required');
  }
}
