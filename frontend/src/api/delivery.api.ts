import api from './axios';
import type { DeliveryRequest } from '../types';

export interface EstimateCostResponse {
  baseFee: number;
  distanceFee: number;
  weightFee: number;
  totalCost: number;
}

export const DeliveryApi = {
  /**
   * Fetch all available delivery requests in the system.
   */
  getAvailableDeliveryRequests: async (): Promise<DeliveryRequest[]> => {
    const response = await api.get('/delivery-requests/available');
    return response.data;
  },

  /**
   * Fetch matched/assigned delivery requests for the transporter.
   */
  getMyJobs: async (): Promise<DeliveryRequest[]> => {
    const response = await api.get('/delivery-requests/my-jobs');
    return response.data;
  },

  /**
   * Accept an available delivery request.
   */
  acceptDeliveryRequest: async (id: string): Promise<DeliveryRequest> => {
    const response = await api.post(`/delivery-requests/${id}/accept`);
    return response.data;
  },

  /**
   * Update the active delivery status, optionally sending coordinates.
   */
  updateDeliveryStatus: async (
    id: string,
    status: 'REQUESTED' | 'MATCHED' | 'PICKED_UP' | 'DELIVERED',
    lat?: number,
    lon?: number
  ): Promise<DeliveryRequest> => {
    const response = await api.patch(`/delivery-requests/${id}/status`, {
      status,
      ...(lat !== undefined && { latitude: lat }),
      ...(lon !== undefined && { longitude: lon }),
    });
    return response.data;
  },

  /**
   * Fetch a single delivery request by UUID.
   */
  getDeliveryRequest: async (id: string): Promise<DeliveryRequest> => {
    const response = await api.get(`/delivery-requests/${id}`);
    return response.data;
  },

  /**
   * Fetch price cost estimations for a delivery request.
   */
  estimateDeliveryCost: async (id: string): Promise<EstimateCostResponse> => {
    const response = await api.get(`/delivery-requests/${id}/estimate`);
    return response.data;
  },
};

export default DeliveryApi;
