import { Request, Response } from 'express';
import { ReviewService } from '../services/review.service';
import { createError } from '../utils/errors';

export class ReviewController {
  /**
   * Submits a rating and review for a completed order.
   */
  public static async createReview(req: Request, res: Response): Promise<void> {
    const fromUserId = req.user!.userId;
    const { toUserId, orderId, rating, comment } = req.body;

    if (!toUserId || !orderId || rating === undefined) {
      throw createError(
        'Missing required fields in request body: toUserId, orderId, rating',
        'MISSING_FIELDS',
        400
      );
    }

    const review = await ReviewService.createReview(
      fromUserId,
      toUserId,
      orderId,
      parseInt(rating),
      comment
    );

    res.status(201).json(review);
  }

  /**
   * Fetches the reviews left for a user. Public endpoint.
   */
  public static async getReviews(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    const page = req.query.page ? parseInt(req.query.page as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

    const result = await ReviewService.getReviewsForUser(userId, {
      page,
      limit,
    });

    res.status(200).json(result);
  }
}
