import api from './axios';

export interface InitializePaymentResponse {
  authorizationUrl: string;
  reference: string;
}

export interface VerifyPaymentResponse {
  verified: boolean;
  status: string;
}

export const PaymentsApi = {
  /**
   * Initializes a Paystack payment session for an order.
   * Returns an authorizationUrl to redirect the buyer to Paystack checkout.
   */
  initializePayment: async (orderId: string): Promise<InitializePaymentResponse> => {
    const response = await api.post('/payments/initialize', { orderId });
    return response.data;
  },

  /**
   * Manually verifies a payment status against Paystack for the given order.
   * Called after returning from the Paystack callback URL.
   */
  verifyPayment: async (orderId: string): Promise<VerifyPaymentResponse> => {
    const response = await api.get(`/payments/${orderId}/verify`);
    return response.data;
  },
};

export default PaymentsApi;
