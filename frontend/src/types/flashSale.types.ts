export interface FlashSale {
  id: string;
  listingId: string;
  farmerId: string;
  originalPricePerKg: number;
  discountPercent: number;
  flashPricePerKg: number;
  quantityKg: number;
  soldKg: number;
  availableKg: number;           // quantityKg - soldKg
  riskBand: 'HIGH' | 'CRITICAL';
  riskScore: number;
  status: 'ACTIVE' | 'SOLD' | 'EXPIRED' | 'CANCELLED';
  expiresAt: string;             // ISO datetime
  secondsRemaining: number;      // calculated by backend
  soldPercent: number;           // (soldKg / quantityKg) * 100
  farmerApproved: boolean;
  notificationsSent: number;
  buyersClaimed: number;
  listing: {
    cropType: string;
    images: string[];
    qualityGrade: string;
    harvestDate: string;
    farmer: { name: string; avgRating: number; region: string };
    latitude: number;
    longitude: number;
    batchCode: string;
  };
  createdAt: string;
}

export interface FlashSaleClaim {
  id: string;
  flashSaleId: string;
  quantityKg: number;
  pricePerKg: number;
  totalPrice: number;
  status: 'PENDING' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED';
  expiresAt: string;
  secondsRemaining: number;
  orderId?: string;
  flashSale: FlashSale;
}
