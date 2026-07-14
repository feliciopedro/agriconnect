import api from './axios';

export interface BuyerCropAlert {
  id: string;
  buyerId: string;
  cropType: string;
  minQuantityKg: number | null;
  maxPricePerKg: number | null;
  region: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const CropAlertApi = {
  /**
   * Configure/Create a crop match alert.
   */
  createAlert: async (data: {
    cropType: string;
    minQuantityKg?: number;
    maxPricePerKg?: number;
    region?: string;
  }): Promise<BuyerCropAlert> => {
    const response = await api.post<BuyerCropAlert>('/crop-alerts', data);
    return response.data;
  },

  /**
   * Get all crop alerts for the authenticated buyer.
   */
  getMyAlerts: async (): Promise<BuyerCropAlert[]> => {
    const response = await api.get<BuyerCropAlert[]>('/crop-alerts');
    return response.data;
  },

  /**
   * Toggle a crop alert on/off.
   */
  toggleAlert: async (alertId: string, isActive: boolean): Promise<BuyerCropAlert> => {
    const response = await api.patch<{ result: BuyerCropAlert }>(
      `/crop-alerts/${alertId}/toggle`,
      { isActive }
    );
    return response.result;
  },
};
