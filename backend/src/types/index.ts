import { z } from 'zod';

// Shared JWT authentication token payload interface
export interface JWTPayload {
  userId: string;
  role: 'FARMER' | 'BUYER' | 'TRANSPORT' | 'ADMIN' | 'SUPERADMIN';
  impersonatedBy?: string;
}

// Registration Zod schema validator
export const RegisterUserSchema = z.object({
  phone: z.string().min(9, 'Phone number must be at least 9 characters long'),
  name: z.string().min(2, 'Name must be at least 2 characters long'),
  role: z.enum(['FARMER', 'BUYER', 'TRANSPORT', 'ADMIN', 'SUPERADMIN']),
  region: z.string().min(1, 'Region is required'),
  district: z.string().min(1, 'District is required'),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});
