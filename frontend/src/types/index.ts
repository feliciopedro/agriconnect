export type Role = 'SUPERADMIN' | 'ADMIN' | 'FARMER' | 'BUYER' | 'TRANSPORT' | 'TRANSPORTER';

export interface TransportProfile {
  id: string;
  userId: string;
  vehicleType: string;
  capacityKg: number;
  serviceRadiusKm: number;
  isAvailable: boolean;
  avgRating: number;
  totalReviews: number;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone?: string;
  location?: string;
  isVerified: boolean;
  isBanned: boolean;
  region?: string;
  district?: string;
  preferredLanguage?: string;
  ussdPinSetAt?: string;
  transportProfile?: TransportProfile;
  createdAt: string;
  updatedAt: string;
}

export interface UserBan {
  id: string;
  userId: string;
  reason: string;
  expiresAt?: string;
  createdAt: string;
}

export interface ProduceListing {
  id: string;
  farmerId: string;
  farmer?: User;
  cropType: string;
  title: string;
  description: string;
  pricePerKg: number;
  remainingKg: number;
  quantityKg: number;
  images: string[];
  harvestDate: string;
  status: 'AVAILABLE' | 'RESERVED' | 'SOLD_OUT' | 'EXPIRED';
  qualityGrade?: string;
  qualityGradeSource?: string;
  batchCode: string;
  expiryEstimate: string;
  latitude: number;
  longitude: number;
  source?: 'WEB' | 'USSD' | 'SMS';
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  buyerId: string;
  buyer?: User;
  listingId: string;
  listing?: ProduceListing;
  quantityKg: number;
  totalPrice: number;
  status: 'PENDING' | 'CONFIRMED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
  paymentStatus: 'UNPAID' | 'PAID' | 'REFUNDED';
  paystackReference?: string;
  deliveryPreference: 'PICKUP' | 'DELIVERY';
  deliveryAddress?: string;
  deliveryLat?: number;
  deliveryLng?: number;
  deliveryRequest?: DeliveryRequest;
  source?: 'WEB' | 'USSD' | 'SMS';
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryRequest {
  id: string;
  orderId: string;
  order?: Order;
  transportProviderId?: string;
  transportProvider?: User;
  pickupLatitude: number;
  pickupLongitude: number;
  dropoffLatitude: number;
  dropoffLongitude: number;
  scheduledPickup?: string;
  scheduledDropoff?: string;
  estimatedCost?: number;
  status: 'REQUESTED' | 'MATCHED' | 'PICKED_UP' | 'DELIVERED' | 'CANCELLED';
  routeGroupId?: string;
  routeSequence?: any;
  eta?: string;
  currentLatitude?: number;
  currentLongitude?: number;
  routeDistanceKm?: number;
  routeDurationMin?: number;
  isCarpool?: boolean;
  carpoolSplitCost?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actor?: User;
  actorRole: Role;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

export interface SystemConfig {
  id: string;
  key: string;
  value: string;
  description?: string;
  updatedBy: string;
  updatedAt: string;
}

export interface HealthCheckResponse {
  status: 'OK' | 'DEGRADED';
  timestamp: string;
  uptime: number;
  services: {
    database: {
      status: 'CONNECTED' | 'DISCONNECTED' | 'UNKNOWN';
      error?: string;
    };
    api: {
      status: 'OK';
    };
  };
}
