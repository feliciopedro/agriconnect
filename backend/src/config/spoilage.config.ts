import { CropType } from '../prisma/generated-client';

export const CROP_SHELF_LIFE_DAYS: Record<CropType, number> = {
  TOMATO:       5,
  PEPPER:       8,
  GARDEN_EGG:   7,
  OKRA:         4,
  LEAFY_GREENS: 3,
  OTHER:        6
};

export const SPOILAGE_CONFIG = {
  RISK_BANDS: {
    LOW:      { minHours: 72,  score: 0  },
    MEDIUM:   { minHours: 48,  score: 30 },
    HIGH:     { minHours: 24,  score: 60 },
    CRITICAL: { minHours: 0,   score: 85 }
  },
  DISCOUNT_BY_BAND: {
    HIGH:     15,
    CRITICAL: 30
  },
  FLASH_SALE_WINDOW_HOURS: {
    HIGH:     8,
    CRITICAL: 3
  },
  NOTIFICATION_RADIUS_KM:    25,
  MIN_REMAINING_KG:          5,
  CLAIM_EXPIRY_MINUTES:      15,
  SCORE_WEIGHT_TIME:         0.5,
  SCORE_WEIGHT_REMAINING:    0.3,
  SCORE_WEIGHT_CROP_TYPE:    0.2,
};
