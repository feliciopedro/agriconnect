import api from './axios';

export const flashSaleApi = {
  getActiveFlashSales: (filters?: any) =>
    api.get('/flash-sales', { params: filters }),

  getFlashSaleById: (id: string) =>
    api.get(`/flash-sales/${id}`),

  claimFlashSale: (id: string, quantityKg: number) =>
    api.post(`/flash-sales/${id}/claim`, { quantityKg }),

  confirmClaim: (claimId: string) =>
    api.post(`/flash-sales/claims/${claimId}/confirm`),

  releaseClaim: (claimId: string) =>
    api.post(`/flash-sales/claims/${claimId}/release`),


  createFlashSale: (listingId: string, discountPercent: number) =>
    api.post('/flash-sales', { listingId, discountPercent }),

  approveFlashSale: (id: string) =>
    api.post(`/flash-sales/${id}/approve`),

  cancelFlashSale: (id: string, reason?: string) =>
    api.post(`/flash-sales/${id}/cancel`, { reason }),

  getMyFlashSalesAsFarmer: () =>
    api.get('/flash-sales/my/farmer'),

  getMyClaimsAsBuyer: () =>
    api.get('/flash-sales/my/buyer'),

  getAdminStats: () =>
    api.get('/admin/flash-sales/stats'),
};
