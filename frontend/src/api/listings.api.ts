import api from './axios';
import type { ProduceListing } from '../types';

export interface ListingsFilters {
  cropType?: string;
  status?: string;
  minQuantityKg?: number;
  maxPricePerKg?: number;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  page?: number;
  limit?: number;
  farmerId?: string;
}

export interface ListingsResponse {
  data: ProduceListing[];
  total: number;
  page: number;
  totalPages: number;
}

export interface DetailedListing extends ProduceListing {
  farmerName: string;
  farmerPhone: string;
  farmerRating: number;
  traceability?: {
    id: string;
    listingId: string;
    plantingDate?: string;
    inputsUsed: string[];
    qualityCheckImages: string[];
    createdAt: string;
    updatedAt: string;
  };
  traceEvents: {
    id: string;
    listingId: string;
    eventType: string;
    latitude?: number;
    longitude?: number;
    recordedByUserId?: string;
    notes?: string;
    timestamp: string;
  }[];
}

export const ListingsApi = {
  /**
   * Create a new produce listing.
   * Expects a FormData object containing images file array and text fields.
   */
  createListing: async (data: FormData): Promise<ProduceListing> => {
    const response = await api.post('/listings', data, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Search/fetch listings with optional filters.
   */
  getListings: async (filters?: ListingsFilters): Promise<ListingsResponse> => {
    const response = await api.get('/listings', { params: filters });
    return response.data;
  },

  /**
   * Retrieve listing details by UUID.
   */
  getListingById: async (id: string): Promise<DetailedListing> => {
    const response = await api.get(`/listings/${id}`);
    return response.data;
  },

  /**
   * Update listing details.
   */
  updateListing: async (id: string, data: any): Promise<ProduceListing> => {
    const response = await api.patch(`/listings/${id}`, data);
    return response.data;
  },

  /**
   * Delete listing or mark as EXPIRED.
   */
  deleteListing: async (id: string): Promise<{ success: boolean; action: 'DELETED' | 'EXPIRED' }> => {
    const response = await api.delete(`/listings/${id}`);
    return response.data;
  },

  /**
   * Fetch QR code for a listing as a PNG Blob.
   */
  getListingQrCode: async (id: string): Promise<Blob> => {
    const response = await api.get(`/listings/${id}/qrcode`, {
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Fetch PDF Traceability Label for a listing as a Blob.
   */
  getTraceLabelPdf: async (id: string): Promise<Blob> => {
    const response = await api.get(`/listings/${id}/trace-label`, {
      responseType: 'blob',
    });
    return response.data;
  },
};

export default ListingsApi;
