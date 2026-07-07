import api from './axios';

export interface UssdSimulatePayload {
  sessionId: string;
  phoneNumber: string;
  text: string;
  serviceCode: string;
}

export interface UssdStatsResponse {
  activeSessions: number;
  sessionsToday: number;
  sessionsByMenu: Record<string, number>;
  avgSessionDurationSeconds: number;
  smsQueuedToday: number;
  smsSentToday: number;
  smsFailedToday: number;
  languageBreakdown: Record<string, number>;
  topMenuPaths: Array<{ path: string; count: number }>;
}

export interface UssdSessionDetail {
  id: string;
  sessionId: string;
  phone: string;
  userId: string | null;
  language: string;
  currentMenu: string;
  currentStep: string;
  menuStack: any;
  tempData: any;
  inputHistory: string[];
  startedAt: string;
  lastActivityAt: string;
  isActive: boolean;
  endedAt: string | null;
  endReason: string | null;
  user?: any;
  auditLogs?: any[];
}

export const UssdApi = {
  /**
   * Post to /ussd using Africa's Talking format
   */
  simulateUssd: async (
    sessionId: string,
    phone: string,
    text: string,
    lang?: string
  ): Promise<string> => {
    // Map lang code to the corresponding dial serviceCode
    let serviceCode = '*920*11#';
    if (lang === 'tw') serviceCode = '*920*11*99#';
    else if (lang === 'ew') serviceCode = '*920*11*98#';
    else if (lang === 'ha') serviceCode = '*920*11*97#';
    else if (lang === 'en') serviceCode = '*920*11*96#';

    const response = await api.post<string>('/ussd', {
      sessionId,
      phoneNumber: phone,
      text,
      serviceCode
    }, {
      headers: {
        'Accept': 'text/plain',
        'Content-Type': 'application/json'
      },
      responseType: 'text'
    });
    
    return response.data;
  },

  /**
   * Get overall stats
   */
  getUssdStats: async (): Promise<UssdStatsResponse> => {
    const response = await api.get<UssdStatsResponse>('/superadmin/ussd/stats');
    return response.data;
  },

  /**
   * Get sessions list
   */
  getUssdSessions: async (filters?: Record<string, any>): Promise<any[]> => {
    const response = await api.get<any[]>('/superadmin/ussd/sessions', { params: filters });
    return response.data;
  },

  /**
   * Get full details of a session
   */
  getSessionDetails: async (sessionId: string): Promise<UssdSessionDetail> => {
    const response = await api.get<UssdSessionDetail>(`/superadmin/ussd/sessions/${sessionId}`);
    return response.data;
  },

  /**
   * Get audit logs
   */
  getUssdAuditLog: async (filters?: Record<string, any>): Promise<any[]> => {
    const response = await api.get<any[]>('/superadmin/ussd/audit', { params: filters });
    return response.data;
  },

  /**
   * Get SMS queue
   */
  getSmsQueue: async (filters?: Record<string, any>): Promise<any[]> => {
    const response = await api.get<any[]>('/superadmin/ussd/sms-queue', { params: filters });
    return response.data;
  },

  /**
   * Trigger retry manually
   */
  retrySmsQueue: async (): Promise<{ retried: number; succeeded: number }> => {
    const response = await api.post<{ retried: number; succeeded: number }>('/superadmin/ussd/sms-queue/retry');
    return response.data;
  }
};

export default UssdApi;
