import { z } from 'zod';
import { CropType } from '../prisma/generated-client';

const CropTypeEnum = z.nativeEnum(CropType);

export const CreatePlantingLogSchema = z
  .object({
    cropType: CropTypeEnum,
    acreage: z.preprocess(
      (val) => (typeof val === 'string' ? parseFloat(val) : val),
      z.number().positive('Acreage must be greater than zero')
    ),
    plantingDate: z.string().datetime({ message: 'plantingDate must be a valid ISO date string' }),
    expectedHarvestDate: z.string().datetime({ message: 'expectedHarvestDate must be a valid ISO date string' }),
    notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional(),
  })
  .refine(
    (data) => new Date(data.expectedHarvestDate) > new Date(data.plantingDate),
    {
      message: 'expectedHarvestDate must be after plantingDate',
      path: ['expectedHarvestDate'],
    }
  );

export const AddInputSchema = z.object({
  type: z.enum(['FERTILIZER', 'PESTICIDE', 'IRRIGATION', 'OTHER'], {
    errorMap: () => ({ message: 'Type must be FERTILIZER, PESTICIDE, IRRIGATION, or OTHER' }),
  }),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  quantity: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val) : val),
    z.number().positive('Quantity must be greater than zero').optional()
  ),
  unit: z.string().min(1, 'Unit must be specified when quantity is provided').optional(),
  appliedAt: z.string().datetime().optional(),
});

export const HarvestLogSchema = z
  .object({
    actualYieldKg: z.preprocess(
      (val) => (typeof val === 'string' ? parseFloat(val) : val),
      z.number().positive('Actual yield must be greater than zero')
    ),
    actualHarvestDate: z.string().datetime({ message: 'actualHarvestDate must be a valid ISO date string' }),
  });

export const PredictYieldQuerySchema = z.object({
  cropType: CropTypeEnum,
  acreage: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val) : val),
    z.number().positive('Acreage must be greater than zero')
  ),
});

export const FarmLogIdParamSchema = z.object({
  id: z.string().uuid('Invalid planting log identifier. Must be a valid UUID.'),
});
