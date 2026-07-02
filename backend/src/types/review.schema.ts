import { z } from 'zod';

export const CreateReviewSchema = z.object({
  toUserId: z.string().uuid('Invalid recipient user identifier. Must be a valid UUID.'),
  orderId: z.string().uuid('Invalid order identifier. Must be a valid UUID.'),
  rating: z.preprocess(
    (val) => (typeof val === 'string' ? parseInt(val) : val),
    z.number().int().min(1, 'Rating must be at least 1').max(5, 'Rating cannot exceed 5')
  ),
  comment: z.string().max(1000, 'Comment cannot exceed 1000 characters').optional(),
});

export const ReviewUserParamsSchema = z.object({
  userId: z.string().uuid('Invalid user identifier. Must be a valid UUID.'),
});
