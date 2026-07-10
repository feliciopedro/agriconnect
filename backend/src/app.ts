import 'express-async-errors'; // Essential for catching async thrown errors in Express 4
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import jwt from 'jsonwebtoken';
import apiRoutes from './routes';
import { errorHandler } from './middleware/error.middleware';
import { checkMaintenanceMode } from './middleware/auth.middleware';
import { config } from './config';
import { PaymentController } from './controllers/payment.controller';
import { rateLimit } from 'express-rate-limit';
import { JWTPayload } from './types';

const app = express();

// Security and core middleware
app.use(helmet());
app.use(
  cors({
    origin: config.FRONTEND_URL,
    credentials: true,
  })
);

// Helper to check if request is from a SUPERADMIN
const isSuperAdminReq = (req: express.Request): boolean => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
      const decoded = jwt.verify(token, config.JWT_SECRET) as JWTPayload;
      return decoded && decoded.role === 'SUPERADMIN';
    }
  } catch (error) {
    // Ignore invalid tokens at rate limiter level
  }
  return false;
};

// Global rate limiter (100 requests per 15 minutes)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
  skip: (req) => isSuperAdminReq(req),
});

// Stricter rate limiter for requesting OTPs (5 requests per 15 minutes)
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many OTP verification requests. Try again in 15 minutes.' },
  skip: (req) => isSuperAdminReq(req),
});

app.use(globalLimiter);
app.use('/api/auth/request-otp', otpLimiter);

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
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'AgriConnect API Hub is online'
  });
});

app.use(checkMaintenanceMode);
app.use('/api', apiRoutes);

// Mount global error handler (must be last)
app.use(errorHandler);

export default app;
