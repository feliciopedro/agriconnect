import { Router } from 'express';
import { ReviewController } from '../controllers/review.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Submit review (requires authentication)
router.post('/', authenticateToken, ReviewController.createReview);

// Public query endpoint (unauthenticated)
router.get('/user/:userId', ReviewController.getReviews);

export default router;
