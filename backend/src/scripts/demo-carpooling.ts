import prisma from '../prisma/client';
import { DeliveryService } from '../services/delivery.service';
import { Role, CropType, CreationSource } from '../prisma/generated-client';

async function run() {
  console.log('🚀 Starting Logistical Co-sharing (Carpooling) Simulation...');

  // 1. Setup/Retrieve Farmer
  const farmer = await prisma.user.upsert({
    where: { phone: '+233550000001' },
    update: {},
    create: {
      phone: '+233550000001',
      name: 'Farmer Kofi',
      role: Role.FARMER,
      latitude: 5.6200, // Accra Mall area
      longitude: -0.1730,
      isVerified: true,
      preferredLanguage: 'en',
    },
  });

  await prisma.farmerProfile.upsert({
    where: { userId: farmer.id },
    update: {},
    create: {
      userId: farmer.id,
      farmSizeAcres: 10,
      primaryCrops: ['TOMATO'],
    },
  });

  // 2. Setup/Retrieve Buyers
  const buyer1 = await prisma.user.upsert({
    where: { phone: '+233550000002' },
    update: {
      latitude: 5.6080, // Airport Residential (~1.3km away)
      longitude: -0.1710,
    },
    create: {
      phone: '+233550000002',
      name: 'Buyer Ama (Airport)',
      role: Role.BUYER,
      latitude: 5.6080,
      longitude: -0.1710,
      isVerified: true,
    },
  });

  await prisma.buyerProfile.upsert({
    where: { userId: buyer1.id },
    update: {},
    create: {
      userId: buyer1.id,
      businessType: 'RESTAURANT',
    },
  });

  const buyer2 = await prisma.user.upsert({
    where: { phone: '+233550000003' },
    update: {
      latitude: 5.6220, // Dzorwulu (~2.0km away)
      longitude: -0.1900,
    },
    create: {
      phone: '+233550000003',
      name: 'Buyer Kwame (Dzorwulu)',
      role: Role.BUYER,
      latitude: 5.6220,
      longitude: -0.1900,
      isVerified: true,
    },
  });

  await prisma.buyerProfile.upsert({
    where: { userId: buyer2.id },
    update: {},
    create: {
      userId: buyer2.id,
      businessType: 'PROCESSOR',
    },
  });

  // 3. Create Listing
  const harvestDate = new Date();
  harvestDate.setDate(harvestDate.getDate() + 1);
  const expiryEstimate = new Date();
  expiryEstimate.setDate(expiryEstimate.getDate() + 7);

  // Clear previous runs to avoid uniqueness conflicts if any
  await prisma.order.deleteMany({
    where: {
      buyerId: { in: [buyer1.id, buyer2.id] }
    }
  });

  await prisma.produceListing.deleteMany({
    where: {
      farmerId: farmer.id
    }
  });

  const listing = await prisma.produceListing.create({
    data: {
      farmerId: farmer.id,
      cropType: CropType.TOMATO,
      quantityKg: 1000,
      remainingKg: 1000,
      pricePerKg: 15.0,
      harvestDate,
      expiryEstimate,
      latitude: farmer.latitude!,
      longitude: farmer.longitude!,
      batchCode: `BAT-TOM-DEMO-${Date.now().toString().slice(-4)}`,
      status: 'AVAILABLE',
      source: CreationSource.WEB,
    },
  });

  console.log(`📦 Created Produce Listing: ${listing.batchCode}`);

  // 4. Create Orders
  const order1 = await prisma.order.create({
    data: {
      buyerId: buyer1.id,
      listingId: listing.id,
      quantityKg: 200,
      totalPrice: 3000.0,
      status: 'PENDING',
      paymentStatus: 'UNPAID',
    },
  });

  const order2 = await prisma.order.create({
    data: {
      buyerId: buyer2.id,
      listingId: listing.id,
      quantityKg: 300,
      totalPrice: 4500.0,
      status: 'PENDING',
      paymentStatus: 'UNPAID',
    },
  });

  console.log(`🛒 Created Order 1 (Ama): GHS 3000 (200kg)`);
  console.log(`🛒 Created Order 2 (Kwame): GHS 4500 (300kg)`);

  // 5. Create Delivery Requests
  const req1 = await DeliveryService.createDeliveryRequest(order1.id);
  const req2 = await DeliveryService.createDeliveryRequest(order2.id);

  console.log(`🚚 Created Delivery Request 1 (Est Cost: GHS ${req1.estimatedCost})`);
  console.log(`🚚 Created Delivery Request 2 (Est Cost: GHS ${req2.estimatedCost})`);

  // 6. Trigger Route Grouping (Logistical Co-sharing)
  console.log('\n🔄 Optimizing routes and grouping nearby deliveries...');
  const groupingResult = await DeliveryService.groupNearbyRequests();
  console.log(`📊 Optimizer Result: Created ${groupingResult.groupsCreated} route groups, matching ${groupingResult.requestsGrouped} requests.`);

  // 7. Fetch updated requests and log details
  const updatedReqs = await prisma.deliveryRequest.findMany({
    where: { id: { in: [req1.id, req2.id] } },
    include: {
      order: {
        include: {
          buyer: true,
        },
      },
    },
  });

  console.log('\n🏆 Carpool Optimization Analysis:');
  console.log('====================================');
  
  for (const req of updatedReqs) {
    const original = req.estimatedCost || 0;
    const split = req.carpoolSplitCost || 0;
    const savings = original - split;
    const pct = original > 0 ? (savings / original) * 100 : 0;

    console.log(`👤 Customer: ${req.order.buyer.name}`);
    console.log(`   - Status: ${req.isCarpool ? '✅ Shared Carpool Active' : '❌ Single Delivery'}`);
    console.log(`   - Route Group ID: ${req.routeGroupId}`);
    console.log(`   - Direct Individual Cost: GHS ${original.toFixed(2)}`);
    console.log(`   - Split Carpool Cost:    GHS ${split.toFixed(2)}`);
    console.log(`   - Total Savings:         GHS ${savings.toFixed(2)} (${pct.toFixed(1)}% OFF!)`);
    console.log('------------------------------------');
  }

  // Get the route sequence
  const leadRequest = updatedReqs.find(r => r.routeSequence !== null);
  if (leadRequest && leadRequest.routeSequence) {
    console.log('🗺️ Optimized Route Stop Sequence:');
    const sequence = leadRequest.routeSequence as any[];
    sequence.forEach((stop, index) => {
      console.log(`  Stop ${index + 1}: ${stop.type} at [${stop.latitude.toFixed(4)}, ${stop.longitude.toFixed(4)}] (${stop.requestId === req1.id ? 'Buyer Ama' : stop.requestId === req2.id ? 'Buyer Kwame' : 'Farmer Kofi'})`);
    });
  }

  console.log('\n✨ Logistical Co-sharing Simulation Finished Successfully!');
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
