export interface User {
  id: string;
  email: string;
  name: string;
  role: 'FARMER' | 'BUYER' | 'TRANSPORTER';
  phone?: string;
  location?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  quantity: number; // in kg
  price: number; // in GHS (Ghana Cedis)
  farmerId: string;
  farmer?: User;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  buyerId: string;
  buyer?: User;
  productId: string;
  product?: Product;
  quantity: number;
  totalPrice: number;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
}

export interface Delivery {
  id: string;
  orderId: string;
  order?: Order;
  transporterId: string;
  transporter?: User;
  status: 'ASSIGNED' | 'IN_TRANSIT' | 'DELIVERED';
  cost: number; // Delivery fee in GHS
  createdAt: string;
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
