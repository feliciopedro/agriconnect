import { z } from 'zod';
import { CropType } from '../prisma/generated-client';

const CropTypeEnum = z.nativeEnum(CropType);

/**
 * Schema for creating a new pre-order.
 * Validates that harvest window is valid and quantities/prices are positive.
 */
export const CreatePreOrderSchema = z
  .object({
    cropType: CropTypeEnum,
    quantityKg: z.preprocess(
      (val) => (typeof val === 'string' ? parseFloat(val) : val),
      z.number().positive('Quantity must be greater than zero')
    ),
    maxPricePerKg: z.preprocess(
      (val) => (typeof val === 'string' ? parseFloat(val) : val),
      z.number().positive('Max price per kg must be greater than zero')
    ),
    preferredRegion: z.string().min(2, 'Region name must be at least 2 characters').optional(),
    harvestWindowStart: z.string().datetime({ message: 'harvestWindowStart must be a valid ISO date string' }),
    harvestWindowEnd: z.string().datetime({ message: 'harvestWindowEnd must be a valid ISO date string' }),
    notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional(),
  })
  .refine(
    (data) => new Date(data.harvestWindowEnd) > new Date(data.harvestWindowStart),
    {
      message: 'harvestWindowEnd must be after harvestWindowStart',
      path: ['harvestWindowEnd'],
    }
  )
  .refine(
    (data) => new Date(data.harvestWindowEnd) > new Date(),
    {
      message: 'harvestWindowEnd must be in the future',
      path: ['harvestWindowEnd'],
    }
  );

export const PreOrderIdParamSchema = z.object({
  id: z.string().uuid('Invalid pre-order identifier. Must be a valid UUID.'),
});

export const GetDemandSignalsSchema = z.object({
  cropType: CropTypeEnum.optional(),
  region: z.string().min(2).optional(),
});
