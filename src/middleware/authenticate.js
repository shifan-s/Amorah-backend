import env from '../config/env.js';
import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';
import { verifyAuthToken } from '../utils/jwt.js';

function sendAuthenticationError(res) {
  return res.status(401).json({
    success: false,
    message: 'Authentication required',
    errors: [],
  });
}

const authenticate = asyncHandler(async (req, res, next) => {
  const authorization = req.get('authorization') || '';
  const bearerToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const token = bearerToken;

  if (!token) {
    sendAuthenticationError(res);
    return;
  }

  let payload;

  try {
    payload = verifyAuthToken(token);
  } catch {
    sendAuthenticationError(res);
    return;
  }

  const user = await User.findById(payload.userId);

  if (!user || user.status === 'disabled') {
    sendAuthenticationError(res);
    return;
  }

  req.user = user.toSafeObject();
  next();
});

export default authenticate;
