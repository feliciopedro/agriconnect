import { z } from 'zod';

// Roles matching schema enums
const RoleEnum = z.enum(['FARMER', 'BUYER', 'TRANSPORT', 'ADMIN']);

export const RequestOtpSchema = z.object({
  phone: z.string().min(8, 'Phone number must be at least 8 characters long'),
});

export const VerifyOtpSchema = z.object({
  phone: z.string().min(8, 'Phone number must be at least 8 characters long'),
  code: z.string().length(6, 'OTP code must be exactly 6 characters long'),
  role: RoleEnum.optional(),
});

export const UpdateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters long').optional(),
  region: z.string().min(1, 'Region cannot be empty').optional(),
  district: z.string().min(1, 'District cannot be empty').optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  vehicleType: z.string().optional(),
  capacityKg: z.number().optional(),
  serviceRadiusKm: z.number().optional(),
  businessType: z.string().optional(),
});
