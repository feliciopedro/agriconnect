import { ProduceListing, SpoilageRiskBand } from '../../prisma/generated-client';
import { CROP_SHELF_LIFE_DAYS, SPOILAGE_CONFIG } from '../../config/spoilage.config';

export interface RiskAssessment {
  score: number;
  band: SpoilageRiskBand;
  hoursUntilExpiry: number;
  shouldTriggerFlashSale: boolean;
  suggestedDiscountPercent: number;
  flashSaleWindowHours: number;
}

export class SpoilageRiskService {
  /**
   * Pure function to calculate the spoilage risk score and band for a listing.
   * Accepting a custom mock date parameter enables clean unit testing.
   */
  public static calculateRiskScore(
    listing: Pick<ProduceListing, 'cropType' | 'quantityKg' | 'remainingKg' | 'harvestDate' | 'expiryEstimate' | 'status'>,
    now: Date = new Date()
  ): RiskAssessment {
    const nowTime = now.getTime();

    // 1. Calculate hours until expiry
    let hoursUntilExpiry: number;
    if (listing.expiryEstimate) {
      hoursUntilExpiry = (new Date(listing.expiryEstimate).getTime() - nowTime) / 3600000;
    } else {
      const baseShelfLifeHours = (CROP_SHELF_LIFE_DAYS[listing.cropType] || CROP_SHELF_LIFE_DAYS.OTHER) * 24;
      const hoursSinceHarvest = (nowTime - new Date(listing.harvestDate).getTime()) / 3600000;
      hoursUntilExpiry = baseShelfLifeHours - hoursSinceHarvest;
    }
    
    // Cap at 0 minimum
    hoursUntilExpiry = Math.max(0, hoursUntilExpiry);

    // 2. Time component (0–100)
    // Every day of shelf life remaining reduces the score by 20 points
    const timeScore = Math.max(0, 100 - (hoursUntilExpiry / 24) * 20);

    // 3. Remaining quantity component (0–100)
    let qtyScore = 20;
    if (listing.remainingKg >= listing.quantityKg * 0.8) {
      qtyScore = 80;
    } else if (listing.remainingKg >= listing.quantityKg * 0.5) {
      qtyScore = 50;
    }

    // 4. Crop type component (0–100)
    const cropScores: Record<string, number> = {
      OKRA: 90,
      LEAFY_GREENS: 85,
      TOMATO: 70,
      GARDEN_EGG: 55,
      PEPPER: 45,
      OTHER: 60
    };
    const cropScore = cropScores[listing.cropType] || cropScores.OTHER;

    // 5. Final weighted average score
    const scoreSum = 
      (timeScore * SPOILAGE_CONFIG.SCORE_WEIGHT_TIME) +
      (qtyScore * SPOILAGE_CONFIG.SCORE_WEIGHT_REMAINING) +
      (cropScore * SPOILAGE_CONFIG.SCORE_WEIGHT_CROP_TYPE);
    
    const score = parseFloat(scoreSum.toFixed(1));

    // 6. Determine risk band from score
    let band: SpoilageRiskBand = 'LOW';
    if (score >= 85) {
      band = 'CRITICAL';
    } else if (score >= 60) {
      band = 'HIGH';
    } else if (score >= 30) {
      band = 'MEDIUM';
    }

    // 7. Suggested discount and flash sale window hours
    let suggestedDiscountPercent = 0;
    let flashSaleWindowHours = 0;

    if (band === 'CRITICAL') {
      suggestedDiscountPercent = SPOILAGE_CONFIG.DISCOUNT_BY_BAND.CRITICAL;
      flashSaleWindowHours = SPOILAGE_CONFIG.FLASH_SALE_WINDOW_HOURS.CRITICAL;
    } else if (band === 'HIGH') {
      suggestedDiscountPercent = SPOILAGE_CONFIG.DISCOUNT_BY_BAND.HIGH;
      flashSaleWindowHours = SPOILAGE_CONFIG.FLASH_SALE_WINDOW_HOURS.HIGH;
    }

    // 8. Determine if flash sale is triggered
    const shouldTriggerFlashSale =
      (band === 'HIGH' || band === 'CRITICAL') &&
      listing.remainingKg >= SPOILAGE_CONFIG.MIN_REMAINING_KG &&
      listing.status === 'AVAILABLE';

    return {
      score,
      band,
      hoursUntilExpiry: parseFloat(hoursUntilExpiry.toFixed(2)),
      shouldTriggerFlashSale,
      suggestedDiscountPercent,
      flashSaleWindowHours
    };
  }
}
