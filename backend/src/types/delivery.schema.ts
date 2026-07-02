import { z } from 'zod';
import { DeliveryStatus } from '../prisma/generated-client';

const DeliveryStatusEnum = z.nativeEnum(DeliveryStatus);

export const UpdateDeliveryStatusSchema = z.object({
  status: DeliveryStatusEnum,
  latitude: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val) : val),
    z.number().min(-90).max(90).optional()
  ),
  longitude: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val) : val),
    z.number().min(-180).max(180).optional()
  ),
});

export const GetCostEstimateSchema = z.object({
  pickupLatitude: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val) : val),
    z.number().min(-90).max(90)
  ),
  pickupLongitude: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val) : val),
    z.number().min(-180).max(180)
  ),
  dropoffLatitude: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val) : val),
    z.number().min(-90).max(90)
  ),
  dropoffLongitude: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val) : val),
    z.number().min(-180).max(180)
  ),
  weightKg: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val) : val),
    z.number().positive('Weight must be greater than zero')
  ),
});

export const DeliveryIdParamSchema = z.object({
  id: z.string().uuid('Invalid delivery request identifier. Must be a valid UUID.'),
});
