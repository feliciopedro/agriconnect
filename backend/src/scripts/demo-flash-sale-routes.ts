import axios from 'axios';
import jwt from 'jsonwebtoken';
import prisma from '../prisma/client';
import { Role } from '../prisma/generated-client';
import { config } from '../config';

const BASE_URL = 'http://localhost:5000/api';

async function runDemo() {
  console.log('🏁 Starting Flash Sale Router/API verification...');

  // 1. Fetch users from seeded db to sign tokens
  const farmer = await prisma.user.findFirst({ where: { role: Role.FARMER } });
  const buyer = await prisma.user.findFirst({ where: { role: Role.BUYER } });
  
  // Fetch/Create a superadmin user for stats and oversight endpoints
  let superadmin = await prisma.user.findFirst({ where: { role: Role.SUPERADMIN } });
  if (!superadmin) {
    superadmin = await prisma.user.create({
      data: {
        name: 'Platform SuperAdmin',
        phone: '+233240000000',
        role: Role.SUPERADMIN,
        passwordHash: 'dummy',
      },
    });
  }

  if (!farmer || !buyer || !superadmin) {
    console.error('❌ Required seed users not found.');
    return;
  }

  const farmerToken = jwt.sign({ userId: farmer.id, role: Role.FARMER }, config.JWT_SECRET);
  const buyerToken = jwt.sign({ userId: buyer.id, role: Role.BUYER }, config.JWT_SECRET);
  const superadminToken = jwt.sign({ userId: superadmin.id, role: Role.SUPERADMIN }, config.JWT_SECRET);

  console.log('✅ Auth tokens generated successfully.');

  // 2. GET /api/flash-sales (Public)
  console.log('\n--- GET /api/flash-sales (Public) ---');
  const salesResponse = await axios.get(`${BASE_URL}/flash-sales`);
  console.log(`✅ Status: ${salesResponse.status}`);
  console.log(`   Count: ${salesResponse.data.length} active sales returned`);
  if (salesResponse.data.length > 0) {
    const fs = salesResponse.data[0];
    console.log(`   Sample Sale ID: ${fs.id}`);
    console.log(`   Crop: ${fs.cropType}`);
    console.log(`   Seconds Remaining: ${fs.secondsRemaining}`);
    console.log(`   Sold Percent: ${fs.soldPercent}%`);
  }

  // 3. Create a listing for Farmer Creation test
  const listing = await prisma.produceListing.create({
    data: {
      farmerId: farmer.id,
      cropType: 'TOMATO',
      quantityKg: 200,
      remainingKg: 200,
      pricePerKg: 10,
      harvestDate: new Date(),
      status: 'AVAILABLE',
      latitude: farmer.latitude || 6.0945,
      longitude: farmer.longitude || -0.2591,
      batchCode: `BAT-ROUTE-${Date.now()}`,
    },
  });

  // 4. POST /api/flash-sales (Farmer Manual Creation)
  console.log('\n--- POST /api/flash-sales (Farmer Create) ---');
  const createResponse = await axios.post(
    `${BASE_URL}/flash-sales`,
    { listingId: listing.id, discountPercent: 25 },
    { headers: { Authorization: `Bearer ${farmerToken}` } }
  );
  console.log(`✅ Status: ${createResponse.status}`);
  const manualSale = createResponse.data;
  console.log(`   Flash Sale Created ID: ${manualSale.id}`);
  console.log(`   Original Price: GHS 10/kg -> Flash Price: GHS ${manualSale.flashPricePerKg}/kg`);

  // 5. GET /api/flash-sales/:id (Public)
  console.log('\n--- GET /api/flash-sales/:id (Public Detail) ---');
  const detailResponse = await axios.get(`${BASE_URL}/flash-sales/${manualSale.id}`);
  console.log(`✅ Status: ${detailResponse.status}`);
  console.log(`   ID matches: ${detailResponse.data.id === manualSale.id}`);
  console.log(`   Farmer Rating: ${detailResponse.data.farmerRating}`);
  console.log(`   Available capacity: ${detailResponse.data.availableQuantity}kg`);

  // 6. POST /api/flash-sales/:id/claim (Buyer claim)
  console.log('\n--- POST /api/flash-sales/:id/claim (Buyer Claim) ---');
  const claimResponse = await axios.post(
    `${BASE_URL}/flash-sales/${manualSale.id}/claim`,
    { quantityKg: 50 },
    { headers: { Authorization: `Bearer ${buyerToken}` } }
  );
  console.log(`✅ Status: ${claimResponse.status}`);
  const claim = claimResponse.data;
  console.log(`   Claim ID: ${claim.id}`);
  console.log(`   Total Price: GHS ${claim.totalPrice}`);
  console.log(`   Claim Countdown Remaining: ${claim.secondsRemaining} seconds`);

  // 7. POST /api/flash-sales/claims/:claimId/confirm (Buyer confirm)
  console.log('\n--- POST /api/flash-sales/claims/:claimId/confirm (Buyer Confirm) ---');
  const confirmResponse = await axios.post(
    `${BASE_URL}/flash-sales/claims/${claim.id}/confirm`,
    {},
    { headers: { Authorization: `Bearer ${buyerToken}` } }
  );
  console.log(`✅ Status: ${confirmResponse.status}`);
  const order = confirmResponse.data;
  console.log(`   Order Generated ID: ${order.id}`);
  console.log(`   Order Total: GHS ${order.totalPrice}`);

  // 8. GET /api/flash-sales/my/farmer (Farmer records list)
  console.log('\n--- GET /api/flash-sales/my/farmer ---');
  const farmerRecords = await axios.get(`${BASE_URL}/flash-sales/my/farmer`, {
    headers: { Authorization: `Bearer ${farmerToken}` },
  });
  console.log(`✅ Status: ${farmerRecords.status}`);
  console.log(`   Farmer sales count: ${farmerRecords.data.length}`);

  // 9. GET /api/flash-sales/my/buyer (Buyer claims list)
  console.log('\n--- GET /api/flash-sales/my/buyer ---');
  const buyerRecords = await axios.get(`${BASE_URL}/flash-sales/my/buyer`, {
    headers: { Authorization: `Bearer ${buyerToken}` },
  });
  console.log(`✅ Status: ${buyerRecords.status}`);
  console.log(`   Buyer claims count: ${buyerRecords.data.length}`);

  // 10. GET /api/admin/flash-sales/stats (Admin stats)
  console.log('\n--- GET /api/admin/flash-sales/stats (Admin Metrics) ---');
  const adminStats = await axios.get(`${BASE_URL}/admin/flash-sales/stats`, {
    headers: { Authorization: `Bearer ${superadminToken}` },
  });
  console.log(`✅ Status: ${adminStats.status}`);
  console.log(`   Total Flash Sales count: ${adminStats.data.totalFlashSales}`);
  console.log(`   Total Kg Saved: ${adminStats.data.totalKgSaved}kg`);
  console.log(`   Averages: Discount: ${adminStats.data.avgDiscountPercent}%, Sold: ${adminStats.data.avgSoldPercent}%`);

  // 11. GET /api/superadmin/flash-sales (SuperAdmin dashboard audit)
  console.log('\n--- GET /api/superadmin/flash-sales (SuperAdmin List) ---');
  const superadminList = await axios.get(`${BASE_URL}/superadmin/flash-sales`, {
    headers: { Authorization: `Bearer ${superadminToken}` },
  });
  console.log(`✅ Status: ${superadminList.status}`);
  console.log(`   Total system-wide sales recorded: ${superadminList.data.length}`);

  console.log('\n🌟 Flash Sale Router/API Verification Finished Successfully!');
}

runDemo()
  .catch((err) => {
    console.error('❌ HTTP Error during route verification:');
    if (err.response) {
      console.error(`   Status: ${err.response.status}`);
      console.error(`   Data:`, err.response.data);
    } else {
      console.error(err);
    }
  });
