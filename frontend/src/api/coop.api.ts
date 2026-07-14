import api from './axios';

export interface CoOpGroup {
  id: string;
  listingId: string;
  creatorId: string;
  targetQuantity: number;
  currentQuantity: number;
  deadline: string;
  status: 'AWAITING_CONTRIBUTIONS' | 'SUCCESSFUL' | 'EXPIRED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
  members: CoOpMember[];
  listing?: {
    id: string;
    cropType: string;
    pricePerKg: number;
    batchCode: string;
    farmer?: {
      name: string;
      phone: string;
    };
  };
  creator?: {
    name: string;
  };
}

export interface CoOpMember {
  id: string;
  coOpGroupId: string;
  buyerId: string;
  quantityKg: number;
  paidAmount: number;
  paymentStatus: 'UNPAID' | 'PAID' | 'REFUNDED';
  paystackRef?: string;
  orderId?: string;
  createdAt: string;
  buyer?: {
    name: string;
    phone: string;
  };
}

export const CoOpApi = {
  /**
   * Fetch active co-op groups, optionally filtered by listing ID.
   */
  getActiveCoOps: async (listingId?: string): Promise<CoOpGroup[]> => {
    const response = await api.get<CoOpGroup[]>('/coops', {
      params: { listingId },
    });
    return response.data;
  },

  /**
   * Fetch a single co-op group buy by ID.
   */
  getCoOpById: async (id: string): Promise<CoOpGroup> => {
    const response = await api.get<CoOpGroup>(`/coops/${id}`);
    return response.data;
  },

  /**
   * Start a new co-op group buy for a listing.
   */
  createCoOp: async (
    listingId: string,
    targetQuantity: number,
    creatorContributionKg: number,
    durationHours?: number
  ): Promise<CoOpGroup> => {
    const response = await api.post<CoOpGroup>('/coops', {
      listingId,
      targetQuantity,
      creatorContributionKg,
      durationHours,
    });
    return response.data;
  },

  /**
   * Join an active co-op group buy.
   */
  joinCoOp: async (
    coOpGroupId: string,
    quantityKg: number
  ): Promise<CoOpMember & { coOpGroup: CoOpGroup }> => {
    const response = await api.post<CoOpMember & { coOpGroup: CoOpGroup }>(
      `/coops/${coOpGroupId}/join`,
      { quantityKg }
    );
    return response.data;
  },

  /**
   * Simulate a webhook payment confirmation to trigger auto-fulfillment.
   */
  simulatePayment: async (
    coOpMemberId: string,
    paystackRef?: string
  ): Promise<{ message: string; result: CoOpMember }> => {
    const response = await api.post<{ message: string; result: CoOpMember }>(
      '/coops/payment/simulate',
      { coOpMemberId, paystackRef }
    );
    return response.data;
  },
};
