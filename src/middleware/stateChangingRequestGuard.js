import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';

const guardedMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function originFromReferer(value = '') {
  if (!value) {
    return '';
  }

  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
}

export default function stateChangingRequestGuard(req, res, next) {
  if (!guardedMethods.has(req.method)) {
    next();
    return;
  }

  const origin = req.get('origin') || originFromReferer(req.get('referer') || '');

  if (!origin) {
    next();
    return;
  }

  if (!env.allowedOrigins.includes(origin)) {
    next(new ApiError(403, 'Request origin not allowed'));
    return;
  }

  next();
}

