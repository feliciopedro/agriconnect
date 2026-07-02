import { z } from 'zod';
import { CropType, ListingStatus, QualityGrade } from '../prisma/generated-client';

const CropTypeEnum = z.nativeEnum(CropType);
const ListingStatusEnum = z.nativeEnum(ListingStatus);
const QualityGradeEnum = z.nativeEnum(QualityGrade);

/**
 * Validator schema for creating a produce listing.
 * Includes preprocessing for form-data string-to-number coercions.
 */
export const CreateListingSchema = z.object({
  cropType: CropTypeEnum,
  quantityKg: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val) : val),
    z.number().positive('Quantity must be greater than zero')
  ),
  pricePerKg: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val) : val),
    z.number().positive('Price must be greater than zero')
  ),
  harvestDate: z.string().transform((str) => new Date(str)),
  expiryEstimate: z
    .string()
    .transform((str) => new Date(str))
    .optional(),
  latitude: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val) : val),
    z.number().min(-90).max(90)
  ),
  longitude: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val) : val),
    z.number().min(-180).max(180)
  ),
  qualityGrade: QualityGradeEnum.optional().default(QualityGrade.UNGRADED),
  qualityGradeSource: z.string().optional().default('UNGRADED'),
});

/**
 * Validator schema for updating a produce listing.
 */
export const UpdateListingSchema = z.object({
  quantityKg: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val) : val),
    z.number().positive('Quantity must be greater than zero')
  ).optional(),
  remainingKg: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val) : val),
    z.number().nonnegative('Remaining inventory cannot be negative')
  ).optional(),
  pricePerKg: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val) : val),
    z.number().positive('Price must be greater than zero')
  ).optional(),
  status: ListingStatusEnum.optional(),
  harvestDate: z
    .string()
    .transform((str) => new Date(str))
    .optional(),
  expiryEstimate: z
    .string()
    .transform((str) => new Date(str))
    .optional(),
  qualityGrade: QualityGradeEnum.optional(),
  qualityGradeSource: z.string().optional(),
});
