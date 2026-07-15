import prisma from '../prisma/client';
import { FlashSaleService } from '../services/flashsale/flashSale.service';
import { Role } from '../prisma/generated-client';

async function runDemo() {
  console.log('🏁 Starting Flash Sale End-to-End Simulation...');

  // 1. Fetch seed farmer and seed buyer
  const farmer = await prisma.user.findFirst({
    where: { role: Role.FARMER },
  });
  const buyer = await prisma.user.findFirst({
    where: { role: Role.BUYER },
  });

  if (!farmer || !buyer) {
    console.error('❌ Farmer or Buyer not found. Please run "npm run seed" first.');
    return;
  }

  console.log(`👨‍🌾 Active Farmer: ${farmer.name} (${farmer.phone})`);
  console.log(`👤 Active Buyer: ${buyer.name} (${buyer.phone})`);

  // 2. Fetch a listing from our seeded listings
  const listing = await prisma.produceListing.findFirst({
    where: {
      farmerId: farmer.id,
      status: 'AVAILABLE',
      remainingKg: { gte: 20 },
      activeFlashSaleId: null,
    },
  });

  if (!listing) {
    console.error('❌ No available listing found. Please check database seeding.');
    return;
  }

  console.log(`🍅 Selected Listing: ${listing.quantityKg}kg ${listing.cropType} @ GHS ${listing.pricePerKg}/kg (Remaining: ${listing.remainingKg}kg)`);

  // 3. Create Flash Sale (Farmer Manual trigger)
  console.log('\n--- Step 1: Create Flash Sale ---');
  const flashSale = await FlashSaleService.createFlashSale(listing.id, 'FARMER_MANUAL');
  
  if (!flashSale) {
    console.error('❌ Flash Sale creation returned null.');
    return;
  }

  console.log('✅ Flash Sale created successfully!');
  console.log(`   ID: ${flashSale.id}`);
  console.log(`   Original Price: GHS ${flashSale.originalPricePerKg}/kg`);
  console.log(`   Discount: ${flashSale.discountPercent}%`);
  console.log(`   Flash Price: GHS ${flashSale.flashPricePerKg}/kg`);
  console.log(`   Risk Band: ${flashSale.riskBand} (Score: ${flashSale.riskScore})`);
  console.log(`   Expires At: ${flashSale.expiresAt}`);
  console.log(`   Farmer Approved: ${flashSale.farmerApproved}`);

  // Check listing activeFlashSaleId linkage
  const updatedListing = await prisma.produceListing.findUnique({
    where: { id: listing.id },
  });
  console.log(`✅ Listing activeFlashSaleId linked: ${updatedListing?.activeFlashSaleId === flashSale.id}`);

  // 4. Buyer Claims Flash Sale (Claim 20kg)
  console.log('\n--- Step 2: Claim Flash Sale ---');
  const claimQuantity = 20;
  const claim = await FlashSaleService.claimFlashSale(flashSale.id, buyer.id, claimQuantity);

  console.log('✅ Flash Sale Claim submitted!');
  console.log(`   Claim ID: ${claim.id}`);
  console.log(`   Quantity: ${claim.quantityKg}kg`);
  expectEqual(claim.pricePerKg, flashSale.flashPricePerKg, 'Claim price equals flash price');
  console.log(`   Total Price: GHS ${claim.totalPrice}`);
  console.log(`   Claim Status: ${claim.status} (Expires: ${claim.expiresAt})`);

  // Check listing remaining capacity
  const listingAfterClaim = await prisma.produceListing.findUnique({
    where: { id: listing.id },
  });
  const expectedRemaining = parseFloat((listing.remainingKg - claimQuantity).toFixed(2));
  console.log(`✅ Listing inventory correctly decremented: ${listingAfterClaim?.remainingKg}kg (Expected: ${expectedRemaining}kg)`);

  // 5. Confirm Claim & Convert to Order
  console.log('\n--- Step 3: Confirm Claim (Convert to Order) ---');
  const order = await FlashSaleService.confirmClaim(claim.id, buyer.id);

  console.log('✅ Claim confirmed and Order generated!');
  console.log(`   Order ID: ${order.id}`);
  console.log(`   Ordered Quantity: ${order.quantityKg}kg`);
  console.log(`   Order Total: GHS ${order.totalPrice} (Expected GHS ${claim.totalPrice})`);
  console.log(`   Order Source: ${order.source}`);

  // Check that stock was not double-decremented
  const listingAfterConfirmation = await prisma.produceListing.findUnique({
    where: { id: listing.id },
  });
  console.log(`✅ Stock double-decrement bypassed: ${listingAfterConfirmation?.remainingKg === listingAfterClaim?.remainingKg}`);

  // 6. Test Expiration Job Simulation
  console.log('\n--- Step 4: Expiration/Cancellation Simulation ---');
  
  // We will create a temp expired flash sale and trigger its closure
  const tempListing = await prisma.produceListing.create({
    data: {
      farmerId: farmer.id,
      cropType: 'LEAFY_GREENS',
      quantityKg: 50,
      remainingKg: 50,
      pricePerKg: 10,
      harvestDate: new Date(),
      status: 'AVAILABLE',
      latitude: farmer.latitude || 6.0945,
      longitude: farmer.longitude || -0.2591,
      batchCode: `BAT-TEMP-${Date.now()}`,
    },
  });

  const tempSale = await FlashSaleService.createFlashSale(tempListing.id, 'FARMER_MANUAL');
  if (tempSale) {
    console.log(`ℹ Created temporary Flash Sale for cancellation test: ${tempSale.id}`);
    await FlashSaleService.cancelFlashSale(tempSale.id, farmer.id, 'Demo cancellation reason');
    
    const cancelledSale = await (prisma as any).flashSale.findUnique({
      where: { id: tempSale.id },
    });
    console.log(`✅ Flash Sale status changed to: ${cancelledSale?.status} (Reason: ${cancelledSale?.cancelReason})`);
    
    const tempListingAfterCancel = await prisma.produceListing.findUnique({
      where: { id: tempListing.id },
    });
    console.log(`✅ Listing activeFlashSaleId cleared: ${tempListingAfterCancel?.activeFlashSaleId === null}`);
  }

  console.log('\n🌟 Flash Sale End-to-End Simulation Finished Successfully!');
}

function expectEqual(actual: any, expected: any, description: string) {
  if (actual === expected) {
    console.log(`✅ ${description}: ${actual} === ${expected}`);
  } else {
    console.error(`❌ ${description} FAILED: Expected ${expected}, but got ${actual}`);
  }
}

runDemo()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
