import api from './axios';

// ─── Response Types ───────────────────────────────────────────────────────────

export interface UserCountEntry {
  role: string;
  _count: { id: number };
}

export interface OrderCountEntry {
  status: string;
  _count: { id: number };
}

export interface TopCropEntry {
  cropType: string;
  totalQuantity: number;
}

export interface PlatformStats {
  userCounts: UserCountEntry[];
  listingCounts: { status: string; cropType: string; _count: { id: number } }[];
  orderCounts: OrderCountEntry[];
  totalGMV: number;
  topCrops: TopCropEntry[];
  spoilageRisk: number;
}

export interface AdminUser {
  id: string;
  name: string;
  phone: string;
  role: string;
  region?: string;
  district?: string;
  isVerified: boolean;
  createdAt: string;
  farmerProfile?: { avgRating: number; totalReviews: number } | null;
  buyerProfile?: { avgRating: number; totalReviews: number } | null;
  transportProfile?: { avgRating: number; totalReviews: number } | null;
}

export interface AdminUsersResponse {
  users: AdminUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AdminTraceEvent {
  eventType: string;
  timestamp: string;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
}

export interface AdminTraceResponse {
  batchCode: string;
  cropType: string;
  qualityGrade: string;
  farmer: {
    name: string;
    phone: string;
    region?: string;
    district?: string;
  };
  harvestDate: string;
  plantingDate?: string | null;
  inputsUsed: string[];
  timeline: AdminTraceEvent[];
  deliveryInfo?: {
    deliveredAt: string;
    buyerType?: string | null;
    buyerName?: string | null;
    buyerPhone?: string | null;
  };
}

export interface AtRiskListing {
  id: string;
  batchCode: string;
  cropType: string;
  quantityKg: number;
  expiryEstimate: string;
  farmer?: { name: string };
}

export interface AdminUsersFilters {
  role?: string;
  isVerified?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

// ─── API Methods ──────────────────────────────────────────────────────────────

export const AdminApi = {
  /**
   * Fetches aggregated platform statistics for the admin dashboard.
   */
  getStats: async (): Promise<PlatformStats> => {
    const response = await api.get('/admin/stats');
    return response.data;
  },

  /**
   * Fetches paginated, filtered user list for admin management.
   */
  getUsers: async (filters?: AdminUsersFilters): Promise<AdminUsersResponse> => {
    const response = await api.get('/admin/users', { params: filters });
    return response.data;
  },

  /**
   * Marks a user account as verified.
   */
  verifyUser: async (id: string): Promise<{ success: boolean; user: AdminUser }> => {
    const response = await api.patch(`/admin/users/${id}/verify`);
    return response.data;
  },

  /**
   * Fetches full unredacted traceability record including farmer/buyer contacts.
   */
  getAdminTrace: async (batchCode: string): Promise<AdminTraceResponse> => {
    const response = await api.get(`/admin/trace/${batchCode}`);
    return response.data;
  },

  /**
   * Triggers the delivery route grouping algorithm manually.
   */
  triggerGrouping: async (): Promise<{ grouped: number; message: string }> => {
    const response = await api.post('/admin/delivery-requests/group');
    return response.data;
  },

  /**
   * Fetches AVAILABLE listings expiring within 48 hours for the spoilage risk table.
   */
  getAtRiskListings: async (): Promise<{ data: AtRiskListing[] }> => {
    const cutoff = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const response = await api.get('/listings', {
      params: { status: 'AVAILABLE', expiryBefore: cutoff, limit: 50 },
    });
    return response.data;
  },
};

export default AdminApi;
