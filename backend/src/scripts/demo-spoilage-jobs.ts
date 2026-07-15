import prisma from '../prisma/client';
import { SpoilageJobService } from '../services/flashsale/spoilageJob.service';
import { Role } from '../prisma/generated-client';

async function runDemo() {
  console.log('🏁 Starting Spoilage Scheduled Jobs Simulation...');

  // 1. Run risk scoring job
  console.log('\n--- Step 1: Run Risk Scoring Job ---');
  const scoringResult = await SpoilageJobService.runRiskScoringJob();
  console.log('✅ Risk Scoring Job completed!');
  console.log(`   Listings Scored: ${scoringResult.listingsScored}`);
  console.log(`   Band Changes Logged: ${scoringResult.bandChanges}`);
  console.log(`   Flash Sales Created: ${scoringResult.flashSalesCreated}`);
  console.log(`   Errors Encountered: ${scoringResult.errors.length}`);

  // 2. Fetch telemetry status
  console.log('\n--- Step 2: Get Telemetry Status ---');
  const status = await SpoilageJobService.getRiskScoringStatus();
  console.log('✅ Telemetry Status retrieved!');
  console.log(`   Last Scoring Run: ${status.lastRiskScoringRun}`);
  console.log(`   Listings At Risk: ${status.listingsAtRisk} (Critical: ${status.criticalCount}, High: ${status.highCount})`);
  console.log(`   Active Flash Sales: ${status.flashSalesActive}`);
  console.log(`   Pending Claims: ${status.claimsPending}`);

  // 3. Create a stale claim and stale flash sale to test expiry
  console.log('\n--- Step 3: Create Stale Records ---');
  const farmer = await prisma.user.findFirst({ where: { role: Role.FARMER } });
  const buyer = await prisma.user.findFirst({ where: { role: Role.BUYER } });

  if (!farmer || !buyer) {
    console.error('❌ Farmer or Buyer not found. Please run seed script first.');
    return;
  }

  // Create a listing that has expired
  const expiredListing = await prisma.produceListing.create({
    data: {
      farmerId: farmer.id,
      cropType: 'OKRA',
      quantityKg: 80,
      remainingKg: 80,
      pricePerKg: 6,
      harvestDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // harvested 5 days ago (shelf life = 4)
      status: 'AVAILABLE',
      latitude: farmer.latitude || 6.0945,
      longitude: farmer.longitude || -0.2591,
      batchCode: `BAT-STALE-${Date.now()}`,
    },
  });

  // 4. Run Expiry Job
  console.log('\n--- Step 4: Run Expiry Job ---');
  const expiryResult = await SpoilageJobService.runExpiryJob();
  console.log('✅ Expiry Job completed!');
  console.log(`   Stale Claims Expired: ${expiryResult.claimsExpired}`);
  console.log(`   Stale Flash Sales Expired: ${expiryResult.flashSalesExpired}`);
  console.log(`   Listings Marked Expired: ${expiryResult.listingsMarkedExpired}`);

  // Verify temp listing status is now EXPIRED
  const checkListing = await prisma.produceListing.findUnique({
    where: { id: expiredListing.id },
  });
  console.log(`✅ Stale listing auto-marked EXPIRED: ${checkListing?.status === 'EXPIRED'}`);

  console.log('\n🌟 Spoilage Scheduled Jobs Simulation Finished Successfully!');
}

runDemo()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
