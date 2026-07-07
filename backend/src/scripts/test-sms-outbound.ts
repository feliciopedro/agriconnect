import prisma from '../prisma/client';
import { SmsOutboundService } from '../services/ussd/smsOutbound.service';
import { OrderService } from '../services/order.service';
import { DeliveryService } from '../services/delivery.service';
import { PreOrderListingService } from '../services/preOrderListing.service';
import { DemandSignalService } from '../services/demandSignal.service';
import { Role, CropType, ListingStatus } from '../prisma/generated-client';

async function runSmsOutboundTests() {
  console.log('🧪 Starting USSD Outbound SMS & Proactive Triggers tests...\n');

  const farmerPhone = '+233241112222';
  const buyerPhone = '+233241113333';
  const transporterPhone = '+233241114444';

  // 1. Cleanup old test data
  await prisma.ussdShortMessage.deleteMany({
    where: { toPhone: { in: [farmerPhone, buyerPhone, transporterPhone] } }
  });
  await prisma.deliveryRequest.deleteMany({
    where: { order: { buyer: { phone: buyerPhone } } }
  });
  await prisma.order.deleteMany({
    where: { buyer: { phone: buyerPhone } }
  });
  await prisma.preOrder.deleteMany({
    where: { buyer: { phone: buyerPhone } }
  });
  await prisma.produceListing.deleteMany({
    where: { farmer: { phone: farmerPhone } }
  });
  await prisma.user.deleteMany({
    where: { phone: { in: [farmerPhone, buyerPhone, transporterPhone] } }
  });

  console.log('🧹 Cleaned up old database records.');

  // 2. Create Farmer, Buyer, and Transporter Users
  const farmer = await prisma.user.create({
    data: {
      phone: farmerPhone,
      name: 'Farmer Kwame',
      role: Role.FARMER,
      isVerified: true,
      preferredLanguage: 'en',
      latitude: 6.0940,
      longitude: -0.2590
    }
  });

  const buyer = await prisma.user.create({
    data: {
      phone: buyerPhone,
      name: 'Buyer Abena',
      role: Role.BUYER,
      isVerified: true,
      preferredLanguage: 'tw', // Preferred language is Twi!
      latitude: 6.0950,
      longitude: -0.2580
    }
  });

  const transporter = await prisma.user.create({
    data: {
      phone: transporterPhone,
      name: 'Transporter Kofi',
      role: Role.TRANSPORT,
      isVerified: true,
      preferredLanguage: 'en',
      latitude: 6.0945,
      longitude: -0.2585,
      transportProfile: {
        create: {
          vehicleType: 'Tricycle',
          capacityKg: 500
        }
      }
    }
  });

  console.log('👤 Setup Farmer, Buyer, and Transporter.');

  // --- Test 1: Order Placement & Farmer/Buyer Outbound Alerts ---
  console.log('\n--- Test 1: Order Creation Triggers ---');
  // Create an available listing
  const listing = await prisma.produceListing.create({
    data: {
      farmerId: farmer.id,
      cropType: CropType.TOMATO,
      quantityKg: 100,
      remainingKg: 100,
      pricePerKg: 5,
      harvestDate: new Date(),
      status: ListingStatus.AVAILABLE,
      latitude: 6.0940,
      longitude: -0.2590,
      batchCode: 'BAT-SMS-101'
    }
  });

  // Buyer places order for 50kg
  const order = await OrderService.createOrder(buyer.id, listing.id, 50);
  console.log(`Placed order: ${order.id}`);

  // Assert order_received_farmer sent to farmer (English)
  const farmerSms = await prisma.ussdShortMessage.findFirst({
    where: { toPhone: farmerPhone, triggerAction: 'order_received_farmer' }
  });
  if (!farmerSms || !farmerSms.message.includes('New order for 50kg')) {
    throw new Error('Test 1 failed: order_received_farmer SMS not found or incorrect');
  }
  console.log('✅ farmer SMS:', farmerSms.message);

  // Assert order_placed_buyer sent to buyer (Twi)
  const buyerSms = await prisma.ussdShortMessage.findFirst({
    where: { toPhone: buyerPhone, triggerAction: 'order_placed_buyer' }
  });
  if (!buyerSms || !buyerSms.message.includes('Wɔahyɛ oda')) {
    throw new Error('Test 1 failed: order_placed_buyer SMS not found or incorrect language');
  }
  console.log('✅ buyer SMS:', buyerSms.message);

  // --- Test 2: Delivery Matched & Route Stop Summary Triggers ---
  console.log('\n--- Test 2: Delivery Matched Triggers ---');
  // Create delivery request explicitly
  await DeliveryService.createDeliveryRequest(order.id);
  
  // Fetch delivery request
  const deliveryReq = await prisma.deliveryRequest.findUnique({
    where: { orderId: order.id }
  });
  if (!deliveryReq) throw new Error('Delivery request was not created for order');

  // Accept delivery request
  await DeliveryService.acceptDeliveryRequest(deliveryReq.id, transporter.id);

  // Assert delivery_matched sent to farmer
  const farmerMatchedSms = await prisma.ussdShortMessage.findFirst({
    where: { toPhone: farmerPhone, triggerAction: 'delivery_matched' }
  });
  if (!farmerMatchedSms || !farmerMatchedSms.message.includes('Transport matched')) {
    throw new Error('Test 2 failed: delivery_matched SMS not found for farmer');
  }
  console.log('✅ farmer matched SMS:', farmerMatchedSms.message);

  // Assert delivery_matched sent to buyer
  const buyerMatchedSms = await prisma.ussdShortMessage.findFirst({
    where: { toPhone: buyerPhone, triggerAction: 'delivery_matched' }
  });
  if (!buyerMatchedSms || !buyerMatchedSms.message.includes('Akwanhyɛfo wɔ hɔ')) {
    throw new Error('Test 2 failed: delivery_matched SMS not found for buyer in Twi');
  }
  console.log('✅ buyer matched SMS:', buyerMatchedSms.message);

  // --- Test 3: Pickup Confirmed & Delivery Completed Alerts ---
  console.log('\n--- Test 3: Delivery Status Change Triggers ---');
  // Set to PICKED_UP
  await DeliveryService.updateDeliveryStatus(deliveryReq.id, 'PICKED_UP', transporter.id);

  // Assert pickup_confirmed to buyer
  const pickupSms = await prisma.ussdShortMessage.findFirst({
    where: { toPhone: buyerPhone, triggerAction: 'pickup_confirmed' }
  });
  if (!pickupSms || !pickupSms.message.includes('Wo 50kg TOMATO wɔfae')) {
    throw new Error('Test 3 failed: pickup_confirmed SMS not found for buyer in Twi');
  }
  console.log('✅ pickup confirmed SMS:', pickupSms.message);

  // Set to DELIVERED
  await DeliveryService.updateDeliveryStatus(deliveryReq.id, 'DELIVERED', transporter.id);

  // Assert delivery_confirmed_farmer to farmer
  const deliveryFarmerSms = await prisma.ussdShortMessage.findFirst({
    where: { toPhone: farmerPhone, triggerAction: 'delivery_confirmed_farmer' }
  });
  if (!deliveryFarmerSms || !deliveryFarmerSms.message.includes('50kg TOMATO delivered')) {
    throw new Error('Test 3 failed: delivery_confirmed_farmer SMS not found');
  }
  console.log('✅ farmer delivery confirmed SMS:', deliveryFarmerSms.message);

  // Assert delivery_confirmed_buyer to buyer
  const deliveryBuyerSms = await prisma.ussdShortMessage.findFirst({
    where: { toPhone: buyerPhone, triggerAction: 'delivery_confirmed_buyer' }
  });
  if (!deliveryBuyerSms || (!deliveryBuyerSms.message.includes('dze mɔ') && !deliveryBuyerSms.message.includes('abrɛ wo'))) {
    throw new Error('Test 3 failed: delivery_confirmed_buyer SMS not found in Twi/Ewe');
  }
  console.log('✅ buyer delivery confirmed SMS:', deliveryBuyerSms.message);

  // --- Test 4: Demand Signal matching & deposit threshold met ---
  console.log('\n--- Test 4: Pre-Order & Demand Signal Triggers ---');
  // Create open demand signal from buyer
  const demandSignal = await DemandSignalService.createDemandSignal(buyer.id, {
    cropType: CropType.PEPPER,
    quantityKg: 200,
    harvestWindowEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    maxPricePerKg: 10
  });

  // Farmer creates and publishes planting plan for Pepper
  const planListing = await PreOrderListingService.createPreOrderListing(farmer.id, {
    cropType: CropType.PEPPER,
    quantityKg: 200,
    pricePerKg: 8,
    harvestDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    minimumKg: 50
  });
  await PreOrderListingService.publishPreOrderListing(planListing.id);

  // Assert demand_signal_matched to buyer
  const demandSms = await prisma.ussdShortMessage.findFirst({
    where: { toPhone: buyerPhone, triggerAction: 'demand_signal_matched' }
  });
  if (!demandSms || !demandSms.message.includes('Farmer bi bɛdua PEPPER')) {
    throw new Error('Test 4 failed: demand_signal_matched SMS not found for buyer in Twi');
  }
  console.log('✅ buyer demand signal matched SMS:', demandSms.message);

  // Assert deposit_threshold_met to farmer
  const thresholdSms = await prisma.ussdShortMessage.findFirst({
    where: { toPhone: farmerPhone, triggerAction: 'deposit_threshold_met' }
  });
  if (!thresholdSms || !thresholdSms.message.includes('plan reached its funding target')) {
    throw new Error('Test 4 failed: deposit_threshold_met SMS not found');
  }
  console.log('✅ farmer deposit threshold met SMS:', thresholdSms.message);

  // --- Test 5: Spoilage Alert Job ---
  console.log('\n--- Test 5: Spoilage Alert Job ---');
  // Create a listing about to expire in 12 hours (critical)
  const expiringListing = await prisma.produceListing.create({
    data: {
      farmerId: farmer.id,
      cropType: CropType.OKRA,
      quantityKg: 80,
      remainingKg: 80,
      pricePerKg: 4,
      harvestDate: new Date(),
      expiryEstimate: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours from now
      status: ListingStatus.AVAILABLE,
      latitude: 6.0940,
      longitude: -0.2590,
      batchCode: 'BAT-SMS-EXP'
    }
  });

  const alertsCount = await SmsOutboundService.runSpoilageAlertJob();
  console.log(`Spoilage alerts dispatched: ${alertsCount}`);
  if (alertsCount !== 1) throw new Error('Expected exactly 1 critical spoilage alert to be dispatched');

  const spoilageSms = await prisma.ussdShortMessage.findFirst({
    where: { toPhone: farmerPhone, triggerAction: 'spoilage_alert' }
  });
  if (!spoilageSms || !spoilageSms.message.includes('expires in 12h')) {
    throw new Error('Test 5 failed: spoilage_alert SMS not found or incorrect expiry hours');
  }
  console.log('✅ spoilage alert SMS:', spoilageSms.message);

  // --- Test 6: Retry Failed SMS ---
  console.log('\n--- Test 6: Retry Stale SMS Job ---');
  const failedSms = await prisma.ussdShortMessage.create({
    data: {
      toPhone: buyerPhone,
      message: 'Failed message to retry',
      triggerAction: 'test_retry',
      status: 'FAILED',
      attemptCount: 1
    }
  });

  const retryResult = await SmsOutboundService.retryStaleSms();
  console.log('Retry result:', retryResult);
  if (retryResult.retried !== 1 || retryResult.succeeded !== 1) {
    throw new Error('Expected 1 retried and 1 succeeded retry job');
  }

  const updatedSms = await prisma.ussdShortMessage.findUnique({
    where: { id: failedSms.id }
  });
  if (!updatedSms || updatedSms.status !== 'SENT' || updatedSms.attemptCount !== 2) {
    throw new Error('Retry job did not update UssdShortMessage status or attemptCount correctly');
  }
  console.log('✅ retry stale SMS status updated successfully.');

  console.log('\n🎉 All Outbound SMS & Proactive Triggers tests passed successfully!');
  process.exit(0);
}

runSmsOutboundTests().catch((err) => {
  console.error('❌ SMS Outbound Test Failed:', err);
  process.exit(1);
});
