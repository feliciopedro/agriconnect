import api from './axios';
import type { User, Role } from '../types';

export interface VerifyOtpResponse {
  token: string;
  user: User;
}

export const AuthApi = {
  /**
   * Request an OTP code to be sent to the specified phone number.
   */
  requestOtp: async (phone: string): Promise<{ message: string }> => {
    const response = await api.post('/auth/request-otp', { phone });
    return response.data;
  },

  /**
   * Verify the received 6-digit OTP code.
   */
  verifyOtp: async (phone: string, code: string, role?: Role): Promise<VerifyOtpResponse> => {
    const response = await api.post('/auth/verify-otp', { phone, code, role });
    return response.data;
  },

  /**
   * Fetch the current logged-in user profile details.
   */
  getMe: async (): Promise<User> => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  /**
   * Update the user profile attributes (name, location, region, district, vehicle details).
   */
  updateProfile: async (data: {
    name?: string;
    region?: string;
    district?: string;
    latitude?: number;
    longitude?: number;
    vehicleType?: string;
    capacityKg?: number;
    serviceRadiusKm?: number;
    businessType?: string;
  }): Promise<User> => {
    const response = await api.patch('/auth/profile', data);
    return response.data;
  },
};
export default AuthApi;
