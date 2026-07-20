import env from '../config/env.js';

export default function maintenanceMode(req, res, next) {
  if (!env.maintenanceMode) {
    next();
    return;
  }

  res.status(503).json({
    success: false,
    message: 'Checkout is temporarily paused for maintenance. Please try again shortly.',
    errors: [],
  });
}

