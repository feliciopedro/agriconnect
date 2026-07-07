import prisma from '../prisma/client';
import * as sessionEngine from '../services/ussd/sessionEngine.service';
import { Role, ListingStatus, OrderStatus, CropType, DeliveryStatus } from '../prisma/generated-client';

async function runTransporterMenuTests() {
  console.log('🧪 Starting USSD Transporter Menu Module tests...\n');

  const transporterPhone = '+233246666666';
  const farmerPhone = '+233248888888';
  const buyerPhone = '+233249999999';
  const sessionId = 'TRANSPORTER_TEST_SESSION_XYZ';

  // Cleanup past records
  await prisma.ussdAuditLog.deleteMany({ where: { sessionId } });
  await prisma.ussdShortMessage.deleteMany({ where: { toPhone: { in: [transporterPhone, farmerPhone, buyerPhone] } } });
  await prisma.deliveryRequest.deleteMany({ where: { order: { buyer: { phone: buyerPhone } } } });
  await prisma.order.deleteMany({ where: { buyer: { phone: buyerPhone } } });
  await prisma.preOrder.deleteMany({ where: { buyer: { phone: buyerPhone } } });
  await prisma.produceListing.deleteMany({ where: { farmer: { phone: farmerPhone } } });
  await prisma.ussdSession.deleteMany({ where: { sessionId } });
  await prisma.user.deleteMany({ where: { phone: { in: [transporterPhone, farmerPhone, buyerPhone] } } });

  console.log('🧹 Cleaned up old test records.');

  // Create Farmer User
  const farmer = await prisma.user.create({
    data: {
      phone: farmerPhone,
      name: 'Farmer Kwame',
      role: Role.FARMER,
      isVerified: true,
      latitude: 6.0945,
      longitude: -0.2591,
      region: 'Eastern',
      district: 'Koforidua',
      ussdPin: '$2b$10$dummyhashbcryptpin1234',
    }
  });

  // Create Buyer User
  const buyer = await prisma.user.create({
    data: {
      phone: buyerPhone,
      name: 'Buyer Joe',
      role: Role.BUYER,
      isVerified: true,
      latitude: 6.0950,
      longitude: -0.2590,
      region: 'Eastern',
      district: 'New Juaben',
      ussdPin: '$2b$10$dummyhashbcryptpin1234',
    }
  });

  // Create Transporter User with coordinates
  const transporter = await prisma.user.create({
    data: {
      phone: transporterPhone,
      name: 'Transporter Yaw',
      role: Role.TRANSPORT,
      isVerified: true,
      latitude: 6.0940,
      longitude: -0.2592,
      region: 'Eastern',
      ussdPin: '$2b$10$dummyhashbcryptpin1234',
      lastUssdActivity: new Date(),
      transportProfile: {
        create: {
          vehicleType: 'TRUCK',
          capacityKg: 1000,
          serviceRadiusKm: 50,
          isAvailable: true
        }
      }
    }
  });

  // Create a listing (Tomato)
  const listing = await prisma.produceListing.create({
    data: {
      farmerId: farmer.id,
      cropType: CropType.TOMATO,
      quantityKg: 100,
      remainingKg: 100,
      pricePerKg: 5,
      harvestDate: new Date(),
      qualityGrade: 'A',
      status: ListingStatus.AVAILABLE,
      latitude: 6.0945,
      longitude: -0.2591,
      batchCode: 'BAT-TOM-999',
    }
  });

  // Create Order and Delivery Request
  const order = await prisma.order.create({
    data: {
      buyerId: buyer.id,
      listingId: listing.id,
      quantityKg: 50,
      totalPrice: 250,
      status: OrderStatus.CONFIRMED,
      paymentStatus: 'PAID'
    }
  });

  const deliveryRequest = await prisma.deliveryRequest.create({
    data: {
      orderId: order.id,
      pickupLatitude: listing.latitude,
      pickupLongitude: listing.longitude,
      dropoffLatitude: buyer.latitude || 6.0950,
      dropoffLongitude: buyer.longitude || -0.2590,
      estimatedCost: 100,
      status: DeliveryStatus.REQUESTED,
      routeDistanceKm: 12,
      routeDurationMin: 20
    }
  });

  try {
    // 1. Initial Dialing (main menu)
    console.log('\n--- Test 1: Main Transporter Menu ---');
    let session = await sessionEngine.getOrCreateSession(sessionId, transporterPhone);
    session = await prisma.ussdSession.update({
      where: { id: session.id },
      data: { currentMenu: 'TRANSPORT_MENU', currentStep: 'START' },
      include: { user: true }
    });

    const menuResponse = await sessionEngine.dispatch(sessionId, transporterPhone, '');
    console.log('Main Menu Prompt:\n', menuResponse);
    if (!menuResponse.includes('Yaw') || !menuResponse.includes('Available Jobs (')) {
      throw new Error('Test 1 failed: Expected main menu response with transporter name and available jobs');
    }

    // 2. Path 1: Available Jobs & Accept Job
    console.log('\n--- Test 2: Available Jobs & Accept Job Flow ---');
    // Select option 1 (Available Jobs)
    const step1 = await sessionEngine.dispatch(sessionId, transporterPhone, '1');
    console.log('Step 1 (Jobs List) Response:\n', step1);
    if (!step1.toUpperCase().includes('JOBS NEAR YOU') || !step1.toUpperCase().includes('TOMATO')) throw new Error('Expected jobs list prompt');

    const lines = step1.split('\n');
    const tomatoLine = lines.find(line => line.toUpperCase().includes('TOMATO') && line.includes('GHS100'));
    if (!tomatoLine) throw new Error('Could not find Tomato job in available jobs');
    const optionChar = tomatoLine.trim()[0]; // e.g. '1' or '2'

    // Select job
    const step2 = await sessionEngine.dispatch(sessionId, transporterPhone, `1*${optionChar}`);
    console.log('Step 2 (Job Detail) Response:\n', step2);
    if (!step2.includes('Job detail') || !step2.includes('Earnings: GHS100')) throw new Error('Expected job details prompt');

    // Accept (1)
    const step3 = await sessionEngine.dispatch(sessionId, transporterPhone, `1*${optionChar}*1`);
    console.log('Step 3 (Job Accepted) Response:\n', step3);
    if (!step3.includes('accepted') || !step3.includes('SMS details sent')) throw new Error('Expected acceptance success prompt');

    // Check DB
    const acceptedReq = await prisma.deliveryRequest.findUnique({
      where: { id: deliveryRequest.id }
    });
    if (!acceptedReq || acceptedReq.status !== DeliveryStatus.MATCHED || acceptedReq.transportProviderId !== transporter.id) {
      throw new Error('Test 2 failed: Delivery status was not matched or transportProviderId mismatch');
    }
    console.log('Job accepted and matched in DB successfully.');

    // 3. Path 2: My Active Route - Arrived & Complete Stop
    console.log('\n--- Test 3: Active Route - Arrived & Complete Stop Flow ---');
    session = await prisma.ussdSession.update({
      where: { id: session.id },
      data: { currentMenu: 'TRANSPORT_ACTIVE_ROUTE', currentStep: 'VIEW', tempData: {}, isActive: true },
      include: { user: true }
    });

    const routePrompt = await sessionEngine.dispatch(sessionId, transporterPhone, '');
    console.log('Active Route Prompt:\n', routePrompt);
    if (!routePrompt.includes('Active route') || !routePrompt.includes('Stop 1/2') || !routePrompt.includes('Next: Pickup')) {
      throw new Error('Expected active route screen pointing to stop 1/2 pickup');
    }

    // I have arrived (1)
    const arrivedConfirm = await sessionEngine.dispatch(sessionId, transporterPhone, '1');
    console.log('Arrived Confirm Prompt:\n', arrivedConfirm);
    if (!arrivedConfirm.includes('Marked arrived') || !arrivedConfirm.includes('Mark as complete')) {
      throw new Error('Expected arrived confirmation prompt');
    }

    // Check DB arrived log
    const arrivedLog = await prisma.auditLog.findFirst({
      where: { actorId: transporter.id, action: 'ARRIVED' }
    });
    if (!arrivedLog) throw new Error('Arrived audit log entry not found in database');
    console.log('Arrived status logged in DB successfully.');

    // Mark complete (1)
    const completeConfirm = await sessionEngine.dispatch(sessionId, transporterPhone, '1*1');
    console.log('Complete Confirm Prompt:\n', completeConfirm);
    if (!completeConfirm.includes('Confirm completing PICKUP')) throw new Error('Expected complete confirmation prompt');

    // Confirm (1)
    const pickupConfirmed = await sessionEngine.dispatch(sessionId, transporterPhone, '1*1*1');
    console.log('Pickup Confirmed Response:\n', pickupConfirmed);
    if (!pickupConfirmed.includes('Pickup confirmed') || !pickupConfirmed.includes('Next: Dropoff')) {
      throw new Error('Expected pickup confirmed prompt showing next dropoff stop');
    }

    // Check DB delivery status is PICKED_UP
    const pickedUpReq = await prisma.deliveryRequest.findUnique({
      where: { id: deliveryRequest.id }
    });
    if (!pickedUpReq || pickedUpReq.status !== DeliveryStatus.PICKED_UP) {
      throw new Error('Delivery status was not updated to PICKED_UP in DB');
    }
    console.log('Pickup marked PICKED_UP in DB successfully.');

    // 4. Path 3: Toggle Availability
    console.log('\n--- Test 4: Toggle Availability ---');
    session = await prisma.ussdSession.update({
      where: { id: session.id },
      data: { currentMenu: 'TRANSPORT_AVAILABILITY', currentStep: 'TOGGLE', tempData: {}, isActive: true },
      include: { user: true }
    });

    const availPrompt = await sessionEngine.dispatch(sessionId, transporterPhone, '');
    console.log('Availability Prompt:\n', availPrompt);
    if (!availPrompt.includes('You are currently: BUSY')) throw new Error('Expected profile availability status to be BUSY (since matched to active job)');

    // Set available (1)
    const availEnd = await sessionEngine.dispatch(sessionId, transporterPhone, '1');
    console.log('Set Available Response:\n', availEnd);
    if (!availEnd.includes('Set to AVAILABLE')) throw new Error('Expected success availability message');

    const updatedProfile = await prisma.transportProfile.findUnique({ where: { userId: transporter.id } });
    if (!updatedProfile || !updatedProfile.isAvailable) throw new Error('Availability was not set to true in database');
    console.log('Transporter availability toggled successfully.');

    // 5. Path 4: My Earnings
    console.log('\n--- Test 5: My Earnings Summary ---');
    // Set request status to DELIVERED to calculate earnings
    await prisma.deliveryRequest.update({
      where: { id: deliveryRequest.id },
      data: { status: DeliveryStatus.DELIVERED }
    });

    session = await prisma.ussdSession.update({
      where: { id: session.id },
      data: { currentMenu: 'TRANSPORT_EARNINGS', currentStep: 'SUMMARY', tempData: {}, isActive: true },
      include: { user: true }
    });

    const earningsPrompt = await sessionEngine.dispatch(sessionId, transporterPhone, '');
    console.log('Earnings Prompt:\n', earningsPrompt);
    if (!earningsPrompt.includes('Total: GHS 100.00')) throw new Error('Expected delivery request estimatedCost of 100.00 in earnings total');

    console.log('\n🎉 All Transporter Menu USSD Module tests passed successfully!');

  } catch (error: any) {
    console.error('❌ Transporter Menu Test Failed:', error.message);
    process.exit(1);
  } finally {
    // Cleanup test data
    await prisma.ussdAuditLog.deleteMany({ where: { sessionId } });
    await prisma.ussdShortMessage.deleteMany({ where: { toPhone: { in: [transporterPhone, farmerPhone, buyerPhone] } } });
    await prisma.deliveryRequest.deleteMany({ where: { order: { buyer: { phone: buyerPhone } } } });
    await prisma.order.deleteMany({ where: { buyer: { phone: buyerPhone } } });
    await prisma.preOrder.deleteMany({ where: { buyer: { phone: buyerPhone } } });
    await prisma.produceListing.deleteMany({ where: { farmer: { phone: farmerPhone } } });
    await prisma.ussdSession.deleteMany({ where: { sessionId } });
    await prisma.user.deleteMany({ where: { phone: { in: [transporterPhone, farmerPhone, buyerPhone] } } });
    console.log('🧹 Cleaned up transporter test records.');
    process.exit(0);
  }
}

runTransporterMenuTests();
