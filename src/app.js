import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import env from './config/env.js';
import errorHandler from './middleware/errorHandler.js';
import notFound from './middleware/notFound.js';
import stateChangingRequestGuard from './middleware/stateChangingRequestGuard.js';
import apiRoutes from './routes/index.js';
import razorpayWebhookRoutes from './routes/razorpayWebhookRoutes.js';
import ApiError from './utils/ApiError.js';

const app = express();

app.disable('x-powered-by');

if (env.trustProxy) {
  app.set('trust proxy', env.trustProxy);
}

const corsOptions = {
  origin(origin, callback) {
    if (!origin || env.allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new ApiError(403, 'CORS origin not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  optionsSuccessStatus: 204,
};

app.use(helmet());
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(compression());
app.use('/api/payments/razorpay/webhook', express.raw({ type: 'application/json', limit: '1mb' }), razorpayWebhookRoutes);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(stateChangingRequestGuard);
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  }),
);

if (env.nodeEnv === 'development') {
  app.use(morgan('dev'));
}

app.use('/api', apiRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
