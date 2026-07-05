import api from './axios';

export interface ChatUser {
  id: string;
  name: string;
  role: 'FARMER' | 'BUYER' | 'TRANSPORT_PROVIDER' | 'SUPERADMIN' | string;
}

export interface Conversation {
  userId: string;
  name: string;
  role: 'FARMER' | 'BUYER' | 'TRANSPORT_PROVIDER' | 'SUPERADMIN' | string;
  lastMessage: {
    content: string;
    createdAt: string;
  } | null;
  unreadCount: number;
}

export interface Message {
  id: string;
  fromUserId: string;
  toUserId: string;
  content: string;
  orderId: string | null;
  isRead: boolean;
  createdAt: string;
  fromUser: ChatUser;
  toUser: ChatUser;
}

export const MessagesApi = {
  /**
   * Fetch list of active conversations for the current user.
   */
  getConversationsList: async (): Promise<Conversation[]> => {
    const response = await api.get('/messages/conversations');
    return response.data;
  },

  /**
   * Fetch message thread details with a specific user.
   */
  getConversation: async (
    otherUserId: string,
    params?: { page?: number; limit?: number }
  ): Promise<Message[]> => {
    const response = await api.get(`/messages/conversations/${otherUserId}`, { params });
    return response.data;
  },

  /**
   * Send a new message to a recipient.
   */
  sendMessage: async (
    toUserId: string,
    content: string,
    orderId?: string
  ): Promise<Message> => {
    const response = await api.post('/messages', {
      toUserId,
      content,
      orderId,
    });
    return response.data;
  },
};

export default MessagesApi;
