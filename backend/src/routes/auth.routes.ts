import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  RequestOtpSchema,
  VerifyOtpSchema,
  UpdateProfileSchema,
  LoginPasswordSchema,
} from '../types/auth.schema';

const router = Router();

// Public routes
router.post('/request-otp', validate(RequestOtpSchema), AuthController.requestOtp);
router.post('/verify-otp', validate(VerifyOtpSchema), AuthController.verifyOtp);
router.post('/login-password', validate(LoginPasswordSchema), AuthController.loginPassword);

// Authenticated routes
router.get('/me', authenticateToken, AuthController.getMe);
router.patch('/profile', authenticateToken, validate(UpdateProfileSchema), AuthController.updateProfile);

export default router;
