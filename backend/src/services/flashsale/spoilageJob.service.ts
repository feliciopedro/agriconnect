import prisma from '../../prisma/client';
import { SpoilageRiskService } from './spoilageRisk.service';
import { FlashSaleService } from './flashSale.service';
import { SPOILAGE_CONFIG, CROP_SHELF_LIFE_DAYS } from '../../config/spoilage.config';

export class SpoilageJobService {
  private static lastRiskScoringRun: Date | null = null;
  private static lastExpiryRun: Date | null = null;

  /**
   * Risk Scoring Job: Scans available listings, assesses risk, and triggers flash sales.
   * Recommended production schedule: every 2 hours (0 * / 2 * * *)
   */
  public static async runRiskScoringJob() {
    console.log('🌾 Running Risk Scoring Job...');
    const now = new Date();

    const listings = await prisma.produceListing.findMany({
      where: {
        status: 'AVAILABLE',
        remainingKg: { gte: SPOILAGE_CONFIG.MIN_REMAINING_KG },
      },
    });

    let listingsScored = 0;
    let bandChanges = 0;
    let flashSalesCreated = 0;
    const errors: string[] = [];

    for (const listing of listings) {
      try {
        listingsScored++;
        const risk = SpoilageRiskService.calculateRiskScore(listing, now);

        // Update band/score if changed
        if (risk.band !== listing.currentRiskBand) {
          bandChanges++;
          await prisma.$transaction(async (tx) => {
            // Log SpoilageRiskLog
            await (tx as any).spoilageRiskLog.create({
              data: {
                listingId: listing.id,
                previousBand: listing.currentRiskBand,
                newBand: risk.band,
                riskScore: risk.score,
                hoursUntilExpiry: risk.hoursUntilExpiry,
                remainingKg: listing.remainingKg,
                triggeredFlashSale: false,
              },
            });

            // Update Listing attributes
            await tx.produceListing.update({
              where: { id: listing.id },
              data: {
                currentRiskBand: risk.band,
                currentRiskScore: risk.score,
                lastRiskCalculatedAt: now,
              },
            });
          });
        }

        // Trigger flash sale if high/critical risk and no active sale exists
        if (risk.shouldTriggerFlashSale && !listing.activeFlashSaleId) {
          const sale = await FlashSaleService.createFlashSale(listing.id, 'AUTO_JOB');
          if (sale) {
            flashSalesCreated++;
          }
        }
      } catch (err: any) {
        console.error(`Error scoring listing ${listing.id}:`, err);
        errors.push(`Listing ${listing.id}: ${err.message || err}`);
      }
    }

    this.lastRiskScoringRun = now;

    return {
      listingsScored,
      bandChanges,
      flashSalesCreated,
      errors,
    };
  }

  /**
   * Expiry Job: Releases stale claims, expires flash sales, and flags fully spoiled listings.
   * Recommended production schedule: every 15 minutes (* / 15 * * * *)
   */
  public static async runExpiryJob() {
    console.log('🌾 Running Expiry Job...');
    const now = new Date();

    // 1. Expire stale claims
    const staleClaims = await prisma.flashSaleClaim.findMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: now },
      },
    });

    let claimsExpired = 0;
    for (const claim of staleClaims) {
      try {
        await FlashSaleService.expireClaim(claim.id);
        claimsExpired++;
      } catch (err) {
        console.error(`Failed to expire claim ${claim.id}:`, err);
      }
    }

    // 2. Expire stale flash sales
    const staleSales = await (prisma as any).flashSale.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { lt: now },
      },
    });

    let flashSalesExpired = 0;
    for (const sale of staleSales) {
      try {
        await FlashSaleService.expireFlashSale(sale.id);
        flashSalesExpired++;
      } catch (err) {
        console.error(`Failed to expire flash sale ${sale.id}:`, err);
      }
    }

    // 3. Auto-expire listings that have passed their shelf life window
    const expiredEstimateListings = await prisma.produceListing.findMany({
      where: {
        status: 'AVAILABLE',
        activeFlashSaleId: null,
        expiryEstimate: { lt: now },
      },
    });

    const harvestListings = await prisma.produceListing.findMany({
      where: {
        status: 'AVAILABLE',
        activeFlashSaleId: null,
        expiryEstimate: null,
      },
    });

    const expiredHarvestListings = harvestListings.filter((listing) => {
      const shelfLifeDays = CROP_SHELF_LIFE_DAYS[listing.cropType] || CROP_SHELF_LIFE_DAYS.OTHER;
      const shelfLifeMs = shelfLifeDays * 24 * 60 * 60 * 1000;
      return new Date(listing.harvestDate).getTime() + shelfLifeMs < now.getTime();
    });

    const allExpiredListings = [
      ...expiredEstimateListings,
      ...expiredHarvestListings,
    ];

    let listingsMarkedExpired = 0;
    for (const listing of allExpiredListings) {
      try {
        await prisma.produceListing.update({
          where: { id: listing.id },
          data: { status: 'EXPIRED' },
        });
        listingsMarkedExpired++;
      } catch (err) {
        console.error(`Failed to mark listing ${listing.id} as expired:`, err);
      }
    }

    this.lastExpiryRun = now;

    return {
      claimsExpired,
      flashSalesExpired,
      listingsMarkedExpired,
    };
  }

  /**
   * Retrieves current metrics for admin panels.
   */
  public static async getRiskScoringStatus() {
    const listingsAtRisk = await prisma.produceListing.count({
      where: {
        status: 'AVAILABLE',
        currentRiskBand: { in: ['HIGH', 'CRITICAL'] },
      },
    });

    const criticalCount = await prisma.produceListing.count({
      where: {
        status: 'AVAILABLE',
        currentRiskBand: 'CRITICAL',
      },
    });

    const highCount = await prisma.produceListing.count({
      where: {
        status: 'AVAILABLE',
        currentRiskBand: 'HIGH',
      },
    });

    const flashSalesActive = await (prisma as any).flashSale.count({
      where: { status: 'ACTIVE' },
    });

    const claimsPending = await prisma.flashSaleClaim.count({
      where: { status: 'PENDING' },
    });

    return {
      lastRiskScoringRun: this.lastRiskScoringRun,
      lastExpiryRun: this.lastExpiryRun,
      listingsAtRisk,
      criticalCount,
      highCount,
      flashSalesActive,
      claimsPending,
    };
  }
}
