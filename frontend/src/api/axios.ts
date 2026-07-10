import axios, { AxiosError } from 'axios';

export class AppError extends Error {
  public override message: string;
  public status?: number;
  public originalError?: any;

  constructor(message: string, status?: number, originalError?: any) {
    super(message);
    this.message = message;
    this.status = status;
    this.originalError = originalError;
    this.name = 'AppError';
  }
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor to inject the Auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(new AppError('Failed to prepare request', undefined, error));
  }
);

// Response Interceptor to capture token expirations and network anomalies
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data as any;

      if (status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('role');
        // Do not redirect if already on login page
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }

      let message = 'An error occurred on the server';
      if (data) {
        if (typeof data.message === 'string') {
          message = data.message;
        } else if (data.error) {
          if (typeof data.error === 'string') {
            message = data.error;
          } else if (typeof data.error === 'object' && typeof data.error.message === 'string') {
            message = data.error.message;
          }
        }
      }
      return Promise.reject(new AppError(message, status, error));
    } else if (error.request) {
      return Promise.reject(new AppError('No response received from the server. Check your network.', undefined, error));
    } else {
      return Promise.reject(new AppError(error.message || 'Network request failed', undefined, error));
    }
  }
);

export default api;
