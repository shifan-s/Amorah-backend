import cors from 'cors';
import env from './env.js';
import ApiError from '../utils/ApiError.js';

function isDevelopmentLoopbackOrigin(origin) {
  if (env.nodeEnv === 'production') {
    return false;
  }

  try {
    const url = new URL(origin);
    const isLoopbackHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

    return isLoopbackHost && (url.protocol === 'http:' || url.protocol === 'https:');
  } catch {
    return false;
  }
}

export const corsOptions = {
  origin(origin, callback) {
    if (!origin || env.allowedOrigins.includes(origin) || isDevelopmentLoopbackOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new ApiError(403, `CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 204,
};

const corsMiddleware = cors(corsOptions);

export default corsMiddleware;
