import api from './axios';

export interface TraceEvent {
  eventType: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  notes: string | null;
}

export interface TraceResponse {
  id: string;
  status: string;
  batchCode: string;
  cropType: string;
  qualityGrade: string;
  farmer: {
    name: string;
    region: string;
    district: string;
  };
  latitude: number;
  longitude: number;
  harvestDate: string;
  plantingDate: string | null;
  inputsUsed: string[];
  timeline: TraceEvent[];
  deliveryInfo?: {
    deliveredAt: string;
    buyerType: string;
  };
}

export const TraceApi = {
  /**
   * Public retrieval of crop batch traceability details.
   */
  getTraceByBatchCode: async (batchCode: string): Promise<TraceResponse> => {
    const response = await api.get(`/trace/${batchCode}`);
    return response.data;
  },
};

export default TraceApi;
