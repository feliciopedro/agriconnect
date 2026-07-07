import { CropType } from '../prisma/generated-client';

export class ForecastService {
  /**
   * Retrieves the market suggested average price per kg for a given crop type.
   * This is cached or statically configured to prevent blocking database lookups.
   */
  public static async getSuggestedPrice(cropType: CropType): Promise<number> {
    const suggestedPrices: Record<CropType, number> = {
      [CropType.TOMATO]: 5.5,
      [CropType.PEPPER]: 8.0,
      [CropType.GARDEN_EGG]: 3.5,
      [CropType.OKRA]: 5.0,
      [CropType.LEAFY_GREENS]: 2.5,
      [CropType.OTHER]: 10.0,
    };
    return suggestedPrices[cropType] || 5.0;
  }
}
