import prisma from '../prisma/client';
import { createError } from '../utils/errors';
import { NotificationService } from './notification.service';
import { Role } from '../prisma/generated-client';

export class ReviewService {
  /**
   * Submits a rating and review for an order.
   * Asserts the order is delivered, limits reviewers to buyer/farmer, prevents duplicates,
   * updates recipient profile stats, and dispatches a notification.
   */
  public static async createReview(
    fromUserId: string,
    toUserId: string,
    orderId: string,
    rating: number,
    comment?: string
  ) {
    // 1. Validate rating bounds
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw createError('Rating must be an integer between 1 and 5', 'INVALID_RATING', 400);
    }

    // 2. Retrieve order context
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        listing: true,
      },
    });

    if (!order) {
      throw createError('Order not found', 'ORDER_NOT_FOUND', 404);
    }

    // Assert status is DELIVERED
    if (order.status !== 'DELIVERED') {
      throw createError('Order must be delivered before submitting a review', 'ORDER_NOT_DELIVERED', 400);
    }

    // Assert reviewer is buyer or farmer on this order
    const isBuyer = order.buyerId === fromUserId;
    const isFarmer = order.listing.farmerId === fromUserId;

    if (!isBuyer && !isFarmer) {
      throw createError(
        'Access forbidden: you are not authorized to review this order',
        'FORBIDDEN_REVIEWER',
        403
      );
    }

    // Check duplicate reviews
    const existing = await prisma.review.findUnique({
      where: {
        fromUserId_orderId: {
          fromUserId,
          orderId,
        },
      },
    });

    if (existing) {
      throw createError('You have already reviewed this order', 'DUPLICATE_REVIEW', 409);
    }

    return await prisma.$transaction(async (tx) => {
      // Create review record
      const review = await tx.review.create({
        data: {
          fromUserId,
          toUserId,
          orderId,
          rating,
          comment: comment || null,
        },
      });

      // Recalculate recipient profile rating stats
      const recipient = await tx.user.findUnique({
        where: { id: toUserId },
        include: {
          farmerProfile: true,
          buyerProfile: true,
          transportProfile: true,
        },
      });

      if (!recipient) {
        throw createError('Recipient user profile not found', 'RECIPIENT_NOT_FOUND', 404);
      }

      let currentAvg = 0;
      let totalReviews = 0;
      let profileId = '';
      let profileModel: any = null;

      if (recipient.role === Role.FARMER) {
        if (recipient.farmerProfile) {
          currentAvg = recipient.farmerProfile.avgRating;
          totalReviews = recipient.farmerProfile.totalReviews;
          profileId = recipient.farmerProfile.id;
          profileModel = tx.farmerProfile;
        }
      } else if (recipient.role === Role.BUYER) {
        if (recipient.buyerProfile) {
          currentAvg = recipient.buyerProfile.avgRating;
          totalReviews = recipient.buyerProfile.totalReviews;
          profileId = recipient.buyerProfile.id;
          profileModel = tx.buyerProfile;
        }
      } else if (recipient.role === Role.TRANSPORT) {
        if (recipient.transportProfile) {
          currentAvg = recipient.transportProfile.avgRating;
          totalReviews = recipient.transportProfile.totalReviews;
          profileId = recipient.transportProfile.id;
          profileModel = tx.transportProfile;
        }
      }

      if (profileModel && profileId) {
        const newTotal = totalReviews + 1;
        const newAvg = parseFloat(((currentAvg * totalReviews + rating) / newTotal).toFixed(2));

        await profileModel.update({
          where: { id: profileId },
          data: {
            avgRating: newAvg,
            totalReviews: newTotal,
          },
        });
      }

      // Notify recipient
      const reviewer = await tx.user.findUnique({ where: { id: fromUserId } });
      const reviewerName = reviewer?.name || 'A user';

      await NotificationService.createNotification(
        toUserId,
        'NEW_REVIEW',
        `${reviewerName} left you a ${rating}-star review`,
        false,
        tx
      );

      return review;
    });
  }

  /**
   * Retrieves review feed for a user, showing average stats and total review counts.
   */
  public static async getReviewsForUser(
    userId: string,
    pagination: { page?: number; limit?: number }
  ) {
    const page = Math.max(1, pagination.page || 1);
    const limit = Math.min(100, Math.max(1, pagination.limit || 20));
    const skip = (page - 1) * limit;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        farmerProfile: true,
        buyerProfile: true,
        transportProfile: true,
      },
    });

    if (!user) {
      throw createError('User not found', 'USER_NOT_FOUND', 404);
    }

    let avgRating = 0;
    let totalReviews = 0;

    if (user.role === Role.FARMER && user.farmerProfile) {
      avgRating = user.farmerProfile.avgRating;
      totalReviews = user.farmerProfile.totalReviews;
    } else if (user.role === Role.BUYER && user.buyerProfile) {
      avgRating = user.buyerProfile.avgRating;
      totalReviews = user.buyerProfile.totalReviews;
    } else if (user.role === Role.TRANSPORT && user.transportProfile) {
      avgRating = user.transportProfile.avgRating;
      totalReviews = user.transportProfile.totalReviews;
    }

    const reviews = await prisma.review.findMany({
      where: { toUserId: userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        fromUser: {
          select: {
            name: true,
            role: true,
          },
        },
      },
    });

    return {
      avgRating,
      totalReviews,
      reviews: reviews.map((r) => ({
        id: r.id,
        fromUserId: r.fromUserId,
        toUserId: r.toUserId,
        orderId: r.orderId,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        reviewer: {
          name: r.fromUser.name,
          role: r.fromUser.role,
        },
      })),
      pagination: {
        page,
        limit,
        total: totalReviews,
        totalPages: Math.ceil(totalReviews / limit),
      },
    };
  }
}
