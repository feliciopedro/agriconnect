import api from './axios';

export interface Review {
  id: string;
  fromUserId: string;
  toUserId: string;
  orderId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  reviewer: {
    name: string;
    role: 'FARMER' | 'BUYER' | 'TRANSPORT_PROVIDER' | 'SUPERADMIN' | string;
  };
}

export interface ReviewsResponse {
  avgRating: number;
  totalReviews: number;
  reviews: Review[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const ReviewsApi = {
  /**
   * Submit a rating and review for a completed order.
   */
  createReview: async (
    toUserId: string,
    orderId: string,
    rating: number,
    comment?: string
  ): Promise<Review> => {
    const response = await api.post('/reviews', {
      toUserId,
      orderId,
      rating,
      comment,
    });
    return response.data;
  },

  /**
   * Fetch paginated list of reviews for a user.
   */
  getReviewsForUser: async (
    userId: string,
    params?: { page?: number; limit?: number }
  ): Promise<ReviewsResponse> => {
    const response = await api.get(`/reviews/user/${userId}`, { params });
    return response.data;
  },
};

export default ReviewsApi;
