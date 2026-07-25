import compression from 'compression';
import cookieParser from 'cookie-parser';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import corsMiddleware from './config/cors.js';
import env from './config/env.js';
import errorHandler from './middleware/errorHandler.js';
import notFound from './middleware/notFound.js';
import stateChangingRequestGuard from './middleware/stateChangingRequestGuard.js';
import apiRoutes from './routes/index.js';
import razorpayWebhookRoutes from './routes/razorpayWebhookRoutes.js';

const app = express();

app.disable('x-powered-by');

if (env.trustProxy) {
  app.set('trust proxy', env.trustProxy);
}

app.use(helmet());
app.use(corsMiddleware);
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
