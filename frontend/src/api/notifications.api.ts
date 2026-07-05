import api from './axios';

export interface Notification {
  id: string;
  userId: string;
  type: 'ORDER' | 'DELIVERY' | 'MESSAGE' | 'SYSTEM' | string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  unreadCount: number;
  notifications: Notification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const NotificationsApi = {
  /**
   * Fetch all notifications for the authenticated user.
   */
  getNotifications: async (): Promise<NotificationsResponse> => {
    const response = await api.get('/notifications');
    return response.data;
  },

  /**
   * Mark a single notification as read.
   */
  markAsRead: async (id: string): Promise<Notification> => {
    const response = await api.patch(`/notifications/${id}/read`);
    return response.data;
  },

  /**
   * Mark all notifications as read.
   */
  markAllRead: async (): Promise<{ success: boolean; count: number }> => {
    const response = await api.patch('/notifications/read-all');
    return response.data;
  },
};

export default NotificationsApi;
