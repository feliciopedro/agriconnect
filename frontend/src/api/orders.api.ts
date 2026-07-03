import api from './axios';
import type { Order } from '../types';

export interface OrderFilters {
  status?: string;
  page?: number;
  limit?: number;
}

export interface OrdersResponse {
  data: Order[];
  total: number;
  page: number;
  totalPages: number;
}

export const OrdersApi = {
  /**
   * Create a new purchase order.
   */
  createOrder: async (data: { listingId: string; quantityKg: number }): Promise<Order> => {
    const response = await api.post('/orders', data);
    return response.data;
  },

  /**
   * Fetch paginated orders scoped by user role.
   */
  getOrders: async (filters?: OrderFilters): Promise<OrdersResponse> => {
    const response = await api.get('/orders', { params: filters });
    return response.data;
  },

  /**
   * Retrieve order details by UUID.
   */
  getOrderById: async (id: string): Promise<Order> => {
    const response = await api.get(`/orders/${id}`);
    return response.data;
  },

  /**
   * Cancel a pending order.
   */
  cancelOrder: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.patch(`/orders/${id}/cancel`);
    return response.data;
  },
};

export default OrdersApi;
