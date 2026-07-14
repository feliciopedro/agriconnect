import prisma from '../prisma/client';
import { CoOpService } from '../services/coop.service';
import { Role, CropType, CreationSource } from '../prisma/generated-client';

async function run() {
  console.log('🚀 Starting Co-operative Group Buying Simulation...');

  // 1. Setup Farmer
  const farmer = await prisma.user.upsert({
    where: { phone: '+233550000100' },
    update: {},
    create: {
      phone: '+233550000100',
      name: 'Farmer Joseph',
      role: Role.FARMER,
      latitude: 5.6200, // Accra Mall
      longitude: -0.1730,
      isVerified: true,
    },
  });

  await prisma.farmerProfile.upsert({
    where: { userId: farmer.id },
    update: {},
    create: {
      userId: farmer.id,
      farmSizeAcres: 5.5,
      primaryCrops: ['OKRA'],
    },
  });

  // 2. Setup 3 Buyers (within Accra, close enough for logistics carpooling)
  const buyer1 = await prisma.user.upsert({
    where: { phone: '+233550000201' },
    update: { latitude: 5.6080, longitude: -0.1710 }, // Airport Area
    create: {
      phone: '+233550000201',
      name: 'Buyer Abena (Airport)',
      role: Role.BUYER,
      latitude: 5.6080,
      longitude: -0.1710,
      isVerified: true,
    },
  });
  await prisma.buyerProfile.upsert({ where: { userId: buyer1.id }, update: {}, create: { userId: buyer1.id, businessType: 'RESTAURANT' } });

  const buyer2 = await prisma.user.upsert({
    where: { phone: '+233550000202' },
    update: { latitude: 5.6220, longitude: -0.1900 }, // Dzorwulu
    create: {
      phone: '+233550000202',
      name: 'Buyer Kwesi (Dzorwulu)',
      role: Role.BUYER,
      latitude: 5.6220,
      longitude: -0.1900,
      isVerified: true,
    },
  });
  await prisma.buyerProfile.upsert({ where: { userId: buyer2.id }, update: {}, create: { userId: buyer2.id, businessType: 'RETAILER' } });

  const buyer3 = await prisma.user.upsert({
    where: { phone: '+233550000203' },
    update: { latitude: 5.6100, longitude: -0.1800 }, // Roman Ridge
    create: {
      phone: '+233550000203',
      name: 'Buyer Yaa (Roman Ridge)',
      role: Role.BUYER,
      latitude: 5.6100,
      longitude: -0.1800,
      isVerified: true,
    },
  });
  await prisma.buyerProfile.upsert({ where: { userId: buyer3.id }, update: {}, create: { userId: buyer3.id, businessType: 'HOUSEHOLD' } });

  // 3. Create Wholesale Produce Listing (Okra)
  // Clear previous runs
  await prisma.order.deleteMany({ where: { buyerId: { in: [buyer1.id, buyer2.id, buyer3.id] } } });
  await prisma.produceListing.deleteMany({ where: { farmerId: farmer.id } });

  const listing = await prisma.produceListing.create({
    data: {
      farmerId: farmer.id,
      cropType: CropType.OKRA,
      quantityKg: 800,
      remainingKg: 800,
      pricePerKg: 10.0,
      harvestDate: new Date(),
      expiryEstimate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      latitude: farmer.latitude!,
      longitude: farmer.longitude!,
      batchCode: `BAT-OKRA-COOP-${Date.now().toString().slice(-4)}`,
      status: 'AVAILABLE',
      source: CreationSource.WEB,
    },
  });

  console.log(`📦 Created Okra Listing: ${listing.batchCode} (Stock: 800kg, GHS 10/kg)`);

  // 4. Buyer 1 starts Co-Op Group Buy targeting 500kg, contributing 100kg
  console.log('\n🎬 Buyer 1 starts a Co-Op Group Buy targeting 500kg...');
  const coOp = await CoOpService.createCoOp(buyer1.id, listing.id, 500, 100);
  console.log(`✅ Co-Op Group Buy Created! ID: ${coOp!.id}`);
  console.log(`   - Target: ${coOp!.targetQuantity} kg`);
  console.log(`   - Creator contribution: 100 kg (Status: AWAITING_CONTRIBUTIONS)`);

  // 5. Buyer 2 joins the Co-Op, contributing 150kg
  console.log('\n➕ Buyer 2 joins the Co-Op group...');
  const member2 = await CoOpService.joinCoOp(buyer2.id, coOp!.id, 150);
  console.log(`✅ Buyer 2 joined! Added 150 kg (Allocated: 250/500 kg)`);

  // 6. Buyer 3 joins the Co-Op, contributing 250kg
  console.log('\n➕ Buyer 3 joins the Co-Op group...');
  const member3 = await CoOpService.joinCoOp(buyer3.id, coOp!.id, 250);
  console.log(`✅ Buyer 3 joined! Added 250 kg (Allocated: 500/500 kg - Group buy is FULL)`);

  // 7. Simulating payment callbacks (confirming payment in sequence)
  console.log('\n💳 Simulating Paystack Webhook payment completions...');
  
  // Find creator member record
  const creatorMember = coOp!.members.find((m: any) => m.buyerId === buyer1.id)!;
  
  console.log(`   - Confirming payment for Buyer 1 (Abena)...`);
  await CoOpService.confirmMemberPayment(creatorMember.id, `PAY-DEMO-B1-${Date.now()}`);

  console.log(`   - Confirming payment for Buyer 2 (Kwesi)...`);
  await CoOpService.confirmMemberPayment(member2.id, `PAY-DEMO-B2-${Date.now()}`);

  console.log(`   - Confirming payment for Buyer 3 (Yaa) -> Reaching Target...`);
  const finalMember = await CoOpService.confirmMemberPayment(member3.id, `PAY-DEMO-B3-${Date.now()}`);

  // 8. Fetch updated Co-Op Group and verify results
  const finishedCoOp = await CoOpService.getCoOpById(coOp!.id);
  console.log('\n====================================');
  console.log(`📊 Co-Op Group Final Status: ${finishedCoOp.status}`);
  console.log(`   - Total Target Quantity: ${finishedCoOp.targetQuantity} kg`);
  console.log(`   - Current Paid Quantity: ${finishedCoOp.currentQuantity} kg`);
  console.log('====================================');

  // Verify stock deduction
  const updatedListing = await prisma.produceListing.findUnique({ where: { id: listing.id } });
  console.log(`🌾 Produce Listing Stock Update:`);
  console.log(`   - Remaining stock: ${updatedListing!.remainingKg} kg (Expected: 300 kg)`);
  console.log(`   - Status: ${updatedListing!.status}`);

  // Fetch individual orders created
  const orders = await prisma.order.findMany({
    where: {
      listingId: listing.id,
      buyerId: { in: [buyer1.id, buyer2.id, buyer3.id] }
    },
    include: {
      buyer: true,
      deliveryRequest: true,
    }
  });

  console.log(`\n🛍️ Generated Orders and Delivery Requests:`);
  for (const order of orders) {
    console.log(`   👤 Customer: ${order.buyer.name}`);
    console.log(`      - Quantity: ${order.quantityKg} kg (Paid GHS ${order.totalPrice})`);
    console.log(`      - Order Status: ${order.status} (Payment: ${order.paymentStatus})`);
    console.log(`      - Delivery ID: ${order.deliveryRequest?.id || 'None'}`);
    console.log(`      - Carpool Group: ${order.deliveryRequest?.routeGroupId || 'None'}`);
    console.log(`      - Carpool Split Cost: GHS ${order.deliveryRequest?.carpoolSplitCost || 'None'}`);
  }

  console.log('\n✨ Co-operative Group Buying Simulation Finished Successfully!');
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
