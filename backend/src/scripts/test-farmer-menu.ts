import prisma from '../prisma/client';
import * as sessionEngine from '../services/ussd/sessionEngine.service';
import { Role, ListingStatus, OrderStatus, CropType, DeliveryStatus } from '../prisma/generated-client';

async function runFarmerMenuTests() {
  console.log('🧪 Starting USSD Farmer Menu Module tests...\n');

  const testPhone = '+233248888888';
  const sessionId = 'FARMER_TEST_SESSION_ABC';

  // Cleanup past records
  await prisma.ussdAuditLog.deleteMany({ where: { sessionId } });
  await prisma.ussdShortMessage.deleteMany({ where: { toPhone: testPhone } });
  await prisma.deliveryRequest.deleteMany({ where: { order: { listing: { farmer: { phone: testPhone } } } } });
  await prisma.order.deleteMany({ where: { listing: { farmer: { phone: testPhone } } } });
  await prisma.preOrder.deleteMany({ where: { buyer: { phone: testPhone } } });
  await prisma.produceListing.deleteMany({ where: { farmer: { phone: testPhone } } });
  await prisma.ussdSession.deleteMany({ where: { sessionId } });
  await prisma.user.deleteMany({ where: { phone: testPhone } });

  console.log('🧹 Cleaned up old farmer test records.');

  // Create Farmer User with Location (required for listing creation)
  const farmer = await prisma.user.create({
    data: {
      phone: testPhone,
      name: 'Farmer Kwame',
      role: Role.FARMER,
      isVerified: true,
      latitude: 6.0945,
      longitude: -0.2591,
      region: 'Eastern',
      ussdPin: '$2b$10$dummyhashbcryptpin1234', // valid bcrypt format hash
      lastUssdActivity: new Date()
    }
  });

  try {
    // 1. Initial Dialing (main menu)
    console.log('\n--- Test 1: Main Farmer Menu ---');
    // Set initial session to FARMER_MENU menu directly for ease
    let session = await sessionEngine.getOrCreateSession(sessionId, testPhone);
    session = await prisma.ussdSession.update({
      where: { id: session.id },
      data: { currentMenu: 'FARMER_MENU', currentStep: 'START' },
      include: { user: true }
    });

    const menuResponse = await sessionEngine.dispatch(sessionId, testPhone, '');
    console.log('Main Menu Prompt:\n', menuResponse);
    if (!menuResponse.includes('Kwame') || !menuResponse.includes('List Produce')) {
      throw new Error('Test 1 failed: Expected main menu response with farmer name');
    }

    // 2. List Produce Path
    console.log('\n--- Test 2: List Produce Flow ---');
    // Select option 1 (List Produce)
    const step1 = await sessionEngine.dispatch(sessionId, testPhone, '1');
    console.log('Step 1 (Select crop) Response:\n', step1);
    if (!step1.includes('Select crop')) throw new Error('Expected crop selection prompt');

    // Select Crop type Tomato (1)
    const step2 = await sessionEngine.dispatch(sessionId, testPhone, '1*1');
    console.log('Step 2 (Enter quantity) Response:\n', step2);
    if (!step2.includes('quantity')) throw new Error('Expected quantity prompt');

    // Enter Qty 40kg
    const step3 = await sessionEngine.dispatch(sessionId, testPhone, '1*1*40');
    console.log('Step 3 (Enter price) Response:\n', step3);
    if (!step3.includes('price')) throw new Error('Expected price prompt');

    // Enter Price GHS 6/kg
    const step4 = await sessionEngine.dispatch(sessionId, testPhone, '1*1*40*6');
    console.log('Step 4 (Harvest date choice) Response:\n', step4);
    if (!step4.includes('ready')) throw new Error('Expected harvest date options prompt');

    // Select Today (1)
    const step5 = await sessionEngine.dispatch(sessionId, testPhone, '1*1*40*6*1');
    console.log('Step 5 (Confirm details) Response:\n', step5);
    if (!step5.includes('Confirm') || !step5.includes('Tomato')) throw new Error('Expected confirmation prompt');

    // Confirm (1)
    const step6 = await sessionEngine.dispatch(sessionId, testPhone, '1*1*40*6*1*1');
    console.log('Step 6 (Listing created) Response:\n', step6);
    if (!step6.includes('Listed!') || !step6.includes('Code')) throw new Error('Expected listing success response');

    // Verify database record
    const listRecord = await prisma.produceListing.findFirst({
      where: { farmerId: farmer.id }
    });
    if (!listRecord || listRecord.quantityKg !== 40 || listRecord.pricePerKg !== 6) {
      throw new Error('Test 2 failed: ProduceListing database record not found or fields mismatch');
    }
    console.log('Listing registered in DB successfully: Batch code =', listRecord.batchCode);

    // 3. My Listings Path (Price/Qty Updates, Mark Sold)
    console.log('\n--- Test 3: My Listings Management ---');
    // Reset session for My Listings
    session = await prisma.ussdSession.update({
      where: { id: session.id },
      data: { currentMenu: 'FARMER_MY_LISTINGS', currentStep: 'LIST', tempData: {}, isActive: true },
      include: { user: true }
    });

    const listingsMenu = await sessionEngine.dispatch(sessionId, testPhone, '');
    console.log('My Listings Menu:\n', listingsMenu);
    if (!listingsMenu.includes('Tomato') || !listingsMenu.includes('40kg')) {
      throw new Error('Test 3 failed: Expected active tomato listing to be rendered');
    }

    // Select listing (1)
    const manageScreen = await sessionEngine.dispatch(sessionId, testPhone, '1');
    console.log('Manage Listing detail screen:\n', manageScreen);
    if (!manageScreen.includes('Update price') || !manageScreen.includes('Mark as sold')) {
      throw new Error('Expected options for managing listings');
    }

    // Choose Update Price (1)
    const updatePricePrompt = await sessionEngine.dispatch(sessionId, testPhone, '1*1');
    console.log('Update Price prompt:\n', updatePricePrompt);
    if (!updatePricePrompt.includes('price')) throw new Error('Expected price update prompt');

    // Set new price GHS 7.5/kg
    const manageScreenAfterPrice = await sessionEngine.dispatch(sessionId, testPhone, '1*1*7.5');
    console.log('Manage Screen after update:\n', manageScreenAfterPrice);
    if (!manageScreenAfterPrice.includes('GHS7.5/kg')) throw new Error('Expected new price of 7.5 GHS to be reflected');

    // Verify price updated in database
    const updatedListing = await prisma.produceListing.findUnique({ where: { id: listRecord.id } });
    if (updatedListing?.pricePerKg !== 7.5) {
      throw new Error('Test 3 failed: Expected database record price to be updated to 7.5');
    }
    console.log('Listing price updated to GHS 7.5 successfully.');

    // 4. Incoming Orders Detail Path
    console.log('\n--- Test 4: Incoming Orders Detail ---');
    // Setup mock buyer and order
    const buyer = await prisma.user.create({
      data: { phone: '+233247777777', name: 'Buyer Joe', role: Role.BUYER, isVerified: true }
    });
    const order = await prisma.order.create({
      data: {
        buyerId: buyer.id,
        listingId: listRecord.id,
        quantityKg: 20,
        totalPrice: 150,
        status: OrderStatus.CONFIRMED
      }
    });

    // Reset session for Incoming Orders
    session = await prisma.ussdSession.update({
      where: { id: session.id },
      data: { currentMenu: 'FARMER_INCOMING_ORDERS', currentStep: 'LIST', tempData: {}, isActive: true },
      include: { user: true }
    });

    const ordersMenu = await sessionEngine.dispatch(sessionId, testPhone, '');
    console.log('Incoming Orders Menu:\n', ordersMenu);
    if (!ordersMenu.includes('CONFIRMED')) throw new Error('Expected mock order to be listed');

    // Select order (1)
    const orderDetail = await sessionEngine.dispatch(sessionId, testPhone, '1');
    console.log('Order Detail:\n', orderDetail);
    if (!orderDetail.includes('Joe') || !orderDetail.includes('CONFIRMED') || !orderDetail.includes('Call buyer')) {
      throw new Error('Expected order details screen with Call option');
    }

    // Call buyer option (1)
    const callBuyerRes = await sessionEngine.dispatch(sessionId, testPhone, '1*1');
    console.log('Call Buyer Response:\n', callBuyerRes);
    if (!callBuyerRes.includes('+233247777777')) throw new Error('Expected buyer number displayed');

    // 5. Earnings and Withdrawals Path
    console.log('\n--- Test 5: Earnings and Withdrawals MoMo Trigger ---');
    // Make order DELIVERED to calculate earnings
    await prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.DELIVERED }
    });

    // Reset session for My Earnings
    session = await prisma.ussdSession.update({
      where: { id: session.id },
      data: { currentMenu: 'FARMER_EARNINGS', currentStep: 'SUMMARY', tempData: {}, isActive: true },
      include: { user: true }
    });

    const earningsMenu = await sessionEngine.dispatch(sessionId, testPhone, '');
    console.log('Earnings summary:\n', earningsMenu);
    if (!earningsMenu.includes('150.00')) throw new Error('Expected mock order earnings to sum to GHS 150.00');

    // Choose Withdraw (1)
    const withdrawPrompt = await sessionEngine.dispatch(sessionId, testPhone, '1');
    console.log('Withdraw MoMo prompt:\n', withdrawPrompt);
    if (!withdrawPrompt.includes('150.00') || !withdrawPrompt.includes('Confirm')) {
      throw new Error('Expected MoMo confirmation withdraw prompt');
    }

    // Confirm Withdraw (1)
    const withdrawCompleted = await sessionEngine.dispatch(sessionId, testPhone, '1*1');
    console.log('Withdraw completed response:\n', withdrawCompleted);
    if (!withdrawCompleted.includes('initiated') || !withdrawCompleted.includes('150.00')) {
      throw new Error('Expected withdrawal initiation confirmation response');
    }

    console.log('\n🎉 All Farmer Menu USSD Module tests passed successfully!');

  } catch (error: any) {
    console.error('❌ Farmer Menu Test Failed:', error.message);
    process.exit(1);
  } finally {
    // Cleanup test data
    await prisma.ussdAuditLog.deleteMany({ where: { sessionId } });
    await prisma.ussdShortMessage.deleteMany({ where: { toPhone: testPhone } });
    await prisma.deliveryRequest.deleteMany({ where: { order: { listing: { farmer: { phone: testPhone } } } } });
    await prisma.order.deleteMany({ where: { listing: { farmer: { phone: testPhone } } } });
    await prisma.preOrder.deleteMany({ where: { buyer: { phone: testPhone } } });
    await prisma.produceListing.deleteMany({ where: { farmer: { phone: testPhone } } });
    await prisma.ussdSession.deleteMany({ where: { sessionId } });
    await prisma.user.deleteMany({ where: { phone: testPhone } });
    console.log('🧹 Cleaned up farmer test records.');
    process.exit(0);
  }
}

runFarmerMenuTests();
