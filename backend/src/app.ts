import 'express-async-errors'; // Essential for catching async thrown errors in Express 4
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import apiRoutes from './routes';
import { errorHandler } from './middleware/error.middleware';
import { config } from './config';
import { PaymentController } from './controllers/payment.controller';

const app = express();

// Security and core middleware
app.use(helmet());
app.use(
  cors({
    origin: config.FRONTEND_URL,
    credentials: true,
  })
);

// CRITICAL: Mount Paystack webhook before express.json() body parser middleware.
// This is because we need access to the unmodified, raw body Buffer of the webhook
// payload to securely perform SHA512 HMAC signature verification.
app.post(
  '/api/payments/webhook',
  express.raw({ type: 'application/json' }),
  PaymentController.webhook
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
const logFormat = config.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(logFormat));

// Mount main routing sub-routes
app.use('/api', apiRoutes);

// Mount global error handler (must be last)
app.use(errorHandler);

export default app;
