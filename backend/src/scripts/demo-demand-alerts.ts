import prisma from '../prisma/client';
import { DemandAlertService } from '../services/demandAlert.service';
import { Role, CropType, CreationSource } from '../prisma/generated-client';

async function run() {
  console.log('🚀 Starting Automated "Demand-Match" Crop Alerts Simulation...');

  // 1. Setup Buyer Kofi
  const buyer = await prisma.user.upsert({
    where: { phone: '+233550000301' },
    update: { region: 'Eastern Region' },
    create: {
      phone: '+233550000301',
      name: 'Buyer Kofi (Eastern)',
      role: Role.BUYER,
      region: 'Eastern Region',
      isVerified: true,
    },
  });
  await prisma.buyerProfile.upsert({ where: { userId: buyer.id }, update: {}, create: { userId: buyer.id, businessType: 'RESTAURANT' } });

  // 2. Setup Farmer Ama
  const farmer = await prisma.user.upsert({
    where: { phone: '+233550000302' },
    update: { region: 'Eastern Region' },
    create: {
      phone: '+233550000302',
      name: 'Farmer Ama',
      role: Role.FARMER,
      region: 'Eastern Region',
      isVerified: true,
    },
  });
  await prisma.farmerProfile.upsert({ where: { userId: farmer.id }, update: {}, create: { userId: farmer.id, farmSizeAcres: 3 } });

  // Clear previous runs
  await (prisma as any).buyerCropAlert.deleteMany({ where: { buyerId: buyer.id } });
  await prisma.notification.deleteMany({ where: { userId: buyer.id } });
  await prisma.ussdShortMessage.deleteMany({ where: { toPhone: buyer.phone } });
  await prisma.produceListing.deleteMany({ where: { farmerId: farmer.id } });

  // 3. Register Alerts for Buyer Kofi
  console.log('\n📝 Registering Buyer Kofi crop alert preferences:');
  
  // Alert A: Tomatoes in Eastern Region, Max Price GHS 20
  const alertA = await DemandAlertService.createAlert(buyer.id, {
    cropType: CropType.TOMATO,
    maxPricePerKg: 20.0,
    region: 'Eastern Region',
  });
  console.log(`   ✅ Alert 1: TOMATO (Max Price: GHS 20, Region: Eastern Region) -> Created ID: ${alertA.id}`);

  // Alert B: Pepper anywhere (no region, no price cap)
  const alertB = await DemandAlertService.createAlert(buyer.id, {
    cropType: CropType.PEPPER,
  });
  console.log(`   ✅ Alert 2: PEPPER (Any Price, Any Region) -> Created ID: ${alertB.id}`);


  // 4. Test Case 1: Matching Tomato Listing (Price GHS 15, Region Eastern Region)
  console.log('\n🌾 Farmer Ama creates a listing matching Tomato alerts (Price: GHS 15)...');
  const listing1 = await prisma.produceListing.create({
    data: {
      farmerId: farmer.id,
      cropType: CropType.TOMATO,
      quantityKg: 100,
      remainingKg: 100,
      pricePerKg: 15.0,
      harvestDate: new Date(),
      expiryEstimate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      latitude: 6.0000,
      longitude: -0.2000,
      batchCode: 'BAT-TOM-MATCH',
      status: 'AVAILABLE',
      source: CreationSource.WEB,
    },
  });

  // Trigger match processor
  await DemandAlertService.processNewListingAlerts({
    id: listing1.id,
    cropType: listing1.cropType,
    quantityKg: listing1.quantityKg,
    pricePerKg: listing1.pricePerKg,
    region: farmer.region, // Eastern Region
    farmerId: farmer.id,
  });


  // 5. Test Case 2: Non-matching Tomato Listing (Price GHS 25 - Exceeds GHS 20 Ceiling)
  console.log('\n🌾 Farmer Ama creates a Tomato listing exceeding price cap (Price: GHS 25)...');
  const listing2 = await prisma.produceListing.create({
    data: {
      farmerId: farmer.id,
      cropType: CropType.TOMATO,
      quantityKg: 80,
      remainingKg: 80,
      pricePerKg: 25.0,
      harvestDate: new Date(),
      expiryEstimate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      latitude: 6.0000,
      longitude: -0.2000,
      batchCode: 'BAT-TOM-CAPEX',
      status: 'AVAILABLE',
      source: CreationSource.WEB,
    },
  });

  await DemandAlertService.processNewListingAlerts({
    id: listing2.id,
    cropType: listing2.cropType,
    quantityKg: listing2.quantityKg,
    pricePerKg: listing2.pricePerKg,
    region: farmer.region,
    farmerId: farmer.id,
  });


  // 6. Test Case 3: Match Pepper Listing (Ashanti Region, GHS 12)
  console.log('\n🌾 Farmer Ama creates a Pepper listing in Ashanti Region (Price: GHS 12)...');
  const listing3 = await prisma.produceListing.create({
    data: {
      farmerId: farmer.id,
      cropType: CropType.PEPPER,
      quantityKg: 200,
      remainingKg: 200,
      pricePerKg: 12.0,
      harvestDate: new Date(),
      latitude: 6.2000,
      longitude: -1.6000,
      batchCode: 'BAT-PEP-MATCH',
      status: 'AVAILABLE',
      source: CreationSource.WEB,
    },
  });

  await DemandAlertService.processNewListingAlerts({
    id: listing3.id,
    cropType: listing3.cropType,
    quantityKg: listing3.quantityKg,
    pricePerKg: listing3.pricePerKg,
    region: 'Ashanti Region',
    farmerId: farmer.id,
  });


  // 7. Verify Results from DB
  console.log('\n====================================');
  console.log('📊 Verification Results:');
  console.log('====================================');

  const notifications = await prisma.notification.findMany({
    where: { userId: buyer.id },
  });

  const smsAlerts = await prisma.ussdShortMessage.findMany({
    where: { toPhone: buyer.phone },
  });

  console.log(`💬 Notifications Generated for Buyer Kofi: ${notifications.length} (Expected: 2)`);
  for (const n of notifications) {
    console.log(`   - [In-App Alert]: ${n.message}`);
  }

  console.log(`\n📱 Outbound SMS Alerts Dispatched: ${smsAlerts.length} (Expected: 2)`);
  for (const sms of smsAlerts) {
    console.log(`   - [SMS to ${sms.toPhone}]: ${sms.message}`);
  }

  console.log('\n✨ Crop Alerts Simulation Finished Successfully!');
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
