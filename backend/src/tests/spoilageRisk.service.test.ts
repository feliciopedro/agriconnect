import { SpoilageRiskService } from '../services/flashsale/spoilageRisk.service';
import { CropType, ListingStatus } from '../prisma/generated-client';

describe('SpoilageRiskService - Spoilage Risk Calculation Engine', () => {
  const mockNow = new Date('2026-07-15T12:00:00.000Z');

  // Test 1: Okra harvested 3.33 days (80 hours) ago, full quantity remaining -> CRITICAL
  test('Test 1: Okra harvested 3 days and 8 hours ago, full quantity remaining -> CRITICAL', () => {
    const listing = {
      cropType: CropType.OKRA,
      quantityKg: 100,
      remainingKg: 100,
      harvestDate: new Date(mockNow.getTime() - 80 * 60 * 60 * 1000), // 80 hours ago
      expiryEstimate: null,
      status: ListingStatus.AVAILABLE
    };

    const result = SpoilageRiskService.calculateRiskScore(listing, mockNow);
    expect(result.band).toBe('CRITICAL');
    expect(result.shouldTriggerFlashSale).toBe(true);
    expect(result.suggestedDiscountPercent).toBe(30);
    expect(result.flashSaleWindowHours).toBe(3);
  });

  // Test 2: Tomato harvested today, half sold -> LOW
  test('Test 2: Tomato harvested today, half sold -> LOW', () => {
    const listing = {
      cropType: CropType.TOMATO,
      quantityKg: 100,
      remainingKg: 50,
      harvestDate: mockNow,
      expiryEstimate: null,
      status: ListingStatus.AVAILABLE
    };

    const result = SpoilageRiskService.calculateRiskScore(listing, mockNow);
    expect(result.score).toBe(29.0);
    expect(result.band).toBe('LOW');
    expect(result.shouldTriggerFlashSale).toBe(false);
  });

  // Test 3: Leafy greens harvested 2 days ago, 80% remaining -> HIGH
  test('Test 3: Leafy greens harvested 2 days ago, 80% remaining -> HIGH', () => {
    const listing = {
      cropType: CropType.LEAFY_GREENS,
      quantityKg: 100,
      remainingKg: 80,
      harvestDate: new Date(mockNow.getTime() - 48 * 60 * 60 * 1000), // 2 days ago
      expiryEstimate: null,
      status: ListingStatus.AVAILABLE
    };

    const result = SpoilageRiskService.calculateRiskScore(listing, mockNow);
    expect(result.score).toBe(81.0);
    expect(result.band).toBe('HIGH');
    expect(result.shouldTriggerFlashSale).toBe(true);
    expect(result.suggestedDiscountPercent).toBe(15);
    expect(result.flashSaleWindowHours).toBe(8);
  });

  // Test 4: hoursUntilExpiry never goes below 0
  test('Test 4: hoursUntilExpiry never goes below 0', () => {
    const listing = {
      cropType: CropType.LEAFY_GREENS,
      quantityKg: 100,
      remainingKg: 100,
      harvestDate: new Date(mockNow.getTime() - 100 * 60 * 60 * 1000), // 100 hours ago
      expiryEstimate: null,
      status: ListingStatus.AVAILABLE
    };

    const result = SpoilageRiskService.calculateRiskScore(listing, mockNow);
    expect(result.hoursUntilExpiry).toBe(0);
    expect(result.score).toBe(91.0);
    expect(result.band).toBe('CRITICAL');
  });

  // Test 5: suggestedDiscount is 15% for HIGH, 30% for CRITICAL
  test('Test 5: suggestedDiscount is 15% for HIGH, 30% for CRITICAL', () => {
    const highListing = {
      cropType: CropType.TOMATO,
      quantityKg: 100,
      remainingKg: 90,
      harvestDate: new Date(mockNow.getTime() - 84 * 60 * 60 * 1000), // 84 hours ago
      expiryEstimate: null,
      status: ListingStatus.AVAILABLE
    };
    const highResult = SpoilageRiskService.calculateRiskScore(highListing, mockNow);
    expect(highResult.band).toBe('HIGH');
    expect(highResult.suggestedDiscountPercent).toBe(15);

    const criticalListing = {
      cropType: CropType.LEAFY_GREENS,
      quantityKg: 100,
      remainingKg: 100,
      harvestDate: new Date(mockNow.getTime() - 65 * 60 * 60 * 1000), // 65 hours ago
      expiryEstimate: null,
      status: ListingStatus.AVAILABLE
    };
    const criticalResult = SpoilageRiskService.calculateRiskScore(criticalListing, mockNow);
    expect(criticalResult.band).toBe('CRITICAL');
    expect(criticalResult.suggestedDiscountPercent).toBe(30);
  });

  // Test 6: shouldTriggerFlashSale is false if remainingKg < MIN_REMAINING_KG
  test('Test 6: shouldTriggerFlashSale is false if remainingKg < MIN_REMAINING_KG', () => {
    const listing = {
      cropType: CropType.LEAFY_GREENS,
      quantityKg: 100,
      remainingKg: 4, // less than 5kg
      harvestDate: new Date(mockNow.getTime() - 48 * 60 * 60 * 1000),
      expiryEstimate: null,
      status: ListingStatus.AVAILABLE
    };

    const result = SpoilageRiskService.calculateRiskScore(listing, mockNow);
    expect(result.band).toBe('HIGH');
    expect(result.shouldTriggerFlashSale).toBe(false);
  });
});
