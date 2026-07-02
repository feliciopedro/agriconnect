import { Router } from 'express';
import { ReviewController } from '../controllers/review.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { CreateReviewSchema, ReviewUserParamsSchema } from '../types/review.schema';

const router = Router();

// Submit review (requires authentication)
router.post('/', authenticateToken, validate(CreateReviewSchema), ReviewController.createReview);

// Public query endpoint (unauthenticated)
router.get('/user/:userId', validate(ReviewUserParamsSchema, 'params'), ReviewController.getReviews);

export default router;
