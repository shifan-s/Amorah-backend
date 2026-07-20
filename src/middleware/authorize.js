import ApiError from '../utils/ApiError.js';

export default function authorize(...allowedRoles) {
  return function authorizeRequest(req, res, next) {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      next(new ApiError(403, 'Insufficient permissions'));
      return;
    }

    next();
  };
}
