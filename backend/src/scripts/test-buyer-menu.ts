import prisma from '../prisma/client';
import * as sessionEngine from '../services/ussd/sessionEngine.service';
import { Role, ListingStatus, OrderStatus, CropType, PreOrderStatus } from '../prisma/generated-client';

async function runBuyerMenuTests() {
  console.log('🧪 Starting USSD Buyer Menu Module tests...\n');

  const buyerPhone = '+233249999999';
  const farmerPhone = '+233248888888';
  const sessionId = 'BUYER_TEST_SESSION_XYZ';

  // Cleanup past records
  await prisma.ussdAuditLog.deleteMany({ where: { sessionId } });
  await prisma.ussdShortMessage.deleteMany({ where: { toPhone: buyerPhone } });
  await prisma.deliveryRequest.deleteMany({ where: { order: { buyer: { phone: buyerPhone } } } });
  await prisma.order.deleteMany({ where: { buyer: { phone: buyerPhone } } });
  await prisma.preOrder.deleteMany({ where: { buyer: { phone: buyerPhone } } });
  await prisma.produceListing.deleteMany({ where: { farmer: { phone: farmerPhone } } });
  await prisma.ussdSession.deleteMany({ where: { sessionId } });
  await prisma.user.deleteMany({ where: { phone: { in: [buyerPhone, farmerPhone] } } });

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
      ussdPin: '$2b$10$dummyhashbcryptpin1234',
    }
  });

  // Create Buyer User with coordinates
  const buyer = await prisma.user.create({
    data: {
      phone: buyerPhone,
      name: 'Buyer Joe',
      role: Role.BUYER,
      isVerified: true,
      latitude: 6.0950,
      longitude: -0.2590,
      region: 'Eastern',
      ussdPin: '$2b$10$dummyhashbcryptpin1234',
      lastUssdActivity: new Date()
    }
  });

  // Create a nearby active listing (Tomato)
  const activeListing = await prisma.produceListing.create({
    data: {
      farmerId: farmer.id,
      cropType: CropType.TOMATO,
      quantityKg: 100,
      remainingKg: 100,
      pricePerKg: 5,
      harvestDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // harvested 2 days ago
      qualityGrade: 'A',
      status: ListingStatus.AVAILABLE,
      latitude: 6.0945,
      longitude: -0.2591,
      batchCode: 'BAT-TOM-999',
    }
  });

  // Create an upcoming listing (Pepper)
  const upcomingListing = await prisma.produceListing.create({
    data: {
      farmerId: farmer.id,
      cropType: CropType.PEPPER,
      quantityKg: 200,
      remainingKg: 200,
      pricePerKg: 6,
      harvestDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // harvested in 15 days
      qualityGrade: 'B',
      status: ListingStatus.AVAILABLE,
      latitude: 6.0945,
      longitude: -0.2591,
      batchCode: 'BAT-PEP-999',
    }
  });

  try {
    // 1. Initial Dialing (main menu)
    console.log('\n--- Test 1: Main Buyer Menu ---');
    let session = await sessionEngine.getOrCreateSession(sessionId, buyerPhone);
    session = await prisma.ussdSession.update({
      where: { id: session.id },
      data: { currentMenu: 'BUYER_MENU', currentStep: 'START' },
      include: { user: true }
    });

    const menuResponse = await sessionEngine.dispatch(sessionId, buyerPhone, '');
    console.log('Main Menu Prompt:\n', menuResponse);
    if (!menuResponse.includes('Joe') || !menuResponse.includes('Find Produce')) {
      throw new Error('Test 1 failed: Expected main menu response with buyer name');
    }

    // 2. Path 1: Find Produce & Place Order
    console.log('\n--- Test 2: Find Produce & Place Order Flow ---');
    // Select option 1 (Find Produce)
    const step1 = await sessionEngine.dispatch(sessionId, buyerPhone, '1');
    console.log('Step 1 (Select crop) Response:\n', step1);
    if (!step1.includes('What do you need')) throw new Error('Expected crop selection prompt');

    // Select Crop type Tomato (1)
    const step2 = await sessionEngine.dispatch(sessionId, buyerPhone, '1*1');
    console.log('Step 2 (List nearby) Response:\n', step2);
    if (!step2.includes('Available Tomato near you')) throw new Error('Expected nearby listings');

    const lines = step2.split('\n');
    const kwameLine = lines.find(line => line.includes('Farmer Kwame'));
    if (!kwameLine) throw new Error('Could not find Farmer Kwame in nearby listings');
    const optionChar = kwameLine.trim()[0]; // e.g. '2'

    // Select Listing of Farmer Kwame
    const step3 = await sessionEngine.dispatch(sessionId, buyerPhone, `1*1*${optionChar}`);
    console.log('Step 3 (Listing details) Response:\n', step3);
    if (!step3.includes('Farmer Kwame') || !step3.includes('100kg available')) throw new Error('Expected listing details prompt');

    // Click Order (1)
    const step4 = await sessionEngine.dispatch(sessionId, buyerPhone, `1*1*${optionChar}*1`);
    console.log('Step 4 (Enter qty) Response:\n', step4);
    if (!step4.includes('How many kg')) throw new Error('Expected quantity prompt');

    // Enter qty 25kg
    const step5 = await sessionEngine.dispatch(sessionId, buyerPhone, `1*1*${optionChar}*1*25`);
    console.log('Step 5 (Confirm order) Response:\n', step5);
    if (!step5.includes('Confirm order') || !step5.includes('GHS125')) throw new Error('Expected confirmation prompt with total GHS 125');

    // Confirm order (1)
    const step6 = await sessionEngine.dispatch(sessionId, buyerPhone, `1*1*${optionChar}*1*25*1`);
    console.log('Step 6 (Order created) Response:\n', step6);
    if (!step6.includes('Order placed') || !step6.includes('Ref')) throw new Error('Expected order created success prompt');

    // Check DB
    const orderRecord = await prisma.order.findFirst({
      where: { buyerId: buyer.id }
    });
    if (!orderRecord || orderRecord.quantityKg !== 25 || orderRecord.totalPrice !== 125) {
      throw new Error('Test 2 failed: Order record not found or fields mismatch');
    }
    console.log('Order registered in DB successfully: Ref =', orderRecord.id);

    // 3. Path 2: My Orders & MoMo Charge
    console.log('\n--- Test 3: My Orders & MoMo Charge Flow ---');
    session = await prisma.ussdSession.update({
      where: { id: session.id },
      data: { currentMenu: 'BUYER_MY_ORDERS', currentStep: 'LIST', tempData: {}, isActive: true },
      include: { user: true }
    });

    const ordersListPrompt = await sessionEngine.dispatch(sessionId, buyerPhone, '');
    console.log('Orders List Prompt:\n', ordersListPrompt);
    if (!ordersListPrompt.includes('Tomato') || !ordersListPrompt.includes('PENDING')) {
      throw new Error('Expected pending tomato order listed');
    }

    // Select order 1
    const orderDetailPrompt = await sessionEngine.dispatch(sessionId, buyerPhone, '1');
    console.log('Order Detail Prompt:\n', orderDetailPrompt);
    if (!orderDetailPrompt.includes('Pay now (MoMo)')) throw new Error('Expected order details screen');

    // Pay now (1)
    const momoConfirmPrompt = await sessionEngine.dispatch(sessionId, buyerPhone, '1*1');
    console.log('MoMo Confirm Prompt:\n', momoConfirmPrompt);
    if (!momoConfirmPrompt.includes('Pay GHS125 via MoMo')) throw new Error('Expected MoMo payment confirmation prompt');

    // Confirm Pay (1)
    const momoInitiatedPrompt = await sessionEngine.dispatch(sessionId, buyerPhone, '1*1*1');
    console.log('MoMo Initiated Prompt:\n', momoInitiatedPrompt);
    if (!momoInitiatedPrompt.includes('initiated')) throw new Error('Expected payment initiated prompt');

    // Wait a brief moment for the simulation setTimeout webhook to fire, confirming the payment
    console.log('Waiting 2.5 seconds for mock MoMo payment simulation hook...');
    await new Promise(resolve => setTimeout(resolve, 2500));

    // Verify order payment status is PAID
    const orderPaid = await prisma.order.findUnique({ where: { id: orderRecord.id } });
    if (orderPaid?.paymentStatus !== 'PAID' || orderPaid?.status !== 'CONFIRMED') {
      throw new Error('Test 3 failed: Order payment status was not confirmed/PAID');
    }
    console.log('MoMo payment confirmed successfully!');

    // 4. Path 3: Browse Upcoming & Pre-Order
    console.log('\n--- Test 4: Browse Upcoming & Pre-Order Flow ---');
    session = await prisma.ussdSession.update({
      where: { id: session.id },
      data: { currentMenu: 'BUYER_PREORDERS', currentStep: 'SUBMENU', tempData: {}, isActive: true },
      include: { user: true }
    });

    const preordersSubPrompt = await sessionEngine.dispatch(sessionId, buyerPhone, '');
    console.log('Pre-orders Submenu:\n', preordersSubPrompt);
    if (!preordersSubPrompt.includes('Browse upcoming')) throw new Error('Expected pre-orders submenu');

    // Select Browse upcoming (1)
    const upcomingListPrompt = await sessionEngine.dispatch(sessionId, buyerPhone, '1');
    console.log('Upcoming List Prompt:\n', upcomingListPrompt);
    if (!upcomingListPrompt.includes('Pepper') || !upcomingListPrompt.includes('Kwame')) {
      throw new Error('Expected upcoming Pepper harvest to be listed');
    }

    // Select upcoming harvest (1)
    const upcomingDetailPrompt = await sessionEngine.dispatch(sessionId, buyerPhone, '1*1');
    console.log('Upcoming Detail Prompt:\n', upcomingDetailPrompt);
    if (!upcomingDetailPrompt.includes('Place pre-order')) throw new Error('Expected upcoming details prompt');

    // Click Place pre-order (1)
    const preOrderQtyPrompt = await sessionEngine.dispatch(sessionId, buyerPhone, '1*1*1');
    console.log('Pre-order Qty Prompt:\n', preOrderQtyPrompt);
    if (!preOrderQtyPrompt.includes('How many kg')) throw new Error('Expected pre-order quantity prompt');

    // Enter qty 50kg
    const preOrderConfirmPrompt = await sessionEngine.dispatch(sessionId, buyerPhone, '1*1*1*50');
    console.log('Pre-order Confirm Prompt:\n', preOrderConfirmPrompt);
    // Deposit for 50kg at GHS 6 is GHS 60.
    if (!preOrderConfirmPrompt.includes('Total Deposit: GHS60')) throw new Error('Expected pre-order confirm prompt with GHS 60 deposit');

    // Confirm Pre-order (1)
    const preOrderInitiatedPrompt = await sessionEngine.dispatch(sessionId, buyerPhone, '1*1*1*50*1');
    console.log('Pre-order Initiated Prompt:\n', preOrderInitiatedPrompt);
    if (!preOrderInitiatedPrompt.includes('initiated')) throw new Error('Expected pre-order success message');

    // Verify PreOrder created
    const preorderRecord = await prisma.preOrder.findFirst({
      where: { buyerId: buyer.id }
    });
    if (!preorderRecord || preorderRecord.quantityKg !== 50 || preorderRecord.depositAmount !== 60) {
      throw new Error('Test 4 failed: PreOrder record not found or fields mismatch');
    }
    console.log('Pre-order registered in DB successfully: Ref =', preorderRecord.id);

    // 5. Path 5: Post Demand Signal
    console.log('\n--- Test 5: Post Demand Signal ---');
    session = await prisma.ussdSession.update({
      where: { id: session.id },
      data: { currentMenu: 'BUYER_POST_DEMAND', currentStep: 'CROP_SELECT', tempData: {}, isActive: true },
      include: { user: true }
    });

    const demandCropPrompt = await sessionEngine.dispatch(sessionId, buyerPhone, '');
    console.log('Demand Crop Select Prompt:\n', demandCropPrompt);
    if (!demandCropPrompt.includes('What do you need')) throw new Error('Expected demand crop prompt');

    // Select Okra (4)
    const demandQtyPrompt = await sessionEngine.dispatch(sessionId, buyerPhone, '4');
    console.log('Demand Qty Prompt:\n', demandQtyPrompt);
    if (!demandQtyPrompt.includes('How many kg')) throw new Error('Expected demand qty prompt');

    // Enter 150kg
    const demandTimingPrompt = await sessionEngine.dispatch(sessionId, buyerPhone, '4*150');
    console.log('Demand Timing Prompt:\n', demandTimingPrompt);
    if (!demandTimingPrompt.includes('When do you need it')) throw new Error('Expected demand timing prompt');

    // Select Within a month (2)
    const demandPricePrompt = await sessionEngine.dispatch(sessionId, buyerPhone, '4*150*2');
    console.log('Demand Price Prompt:\n', demandPricePrompt);
    if (!demandPricePrompt.includes('Maximum price')) throw new Error('Expected max price prompt');

    // Enter GHS 8/kg
    const demandConfirmPrompt = await sessionEngine.dispatch(sessionId, buyerPhone, '4*150*2*8');
    console.log('Demand Confirm Prompt:\n', demandConfirmPrompt);
    if (!demandConfirmPrompt.includes('Demand signal') || !demandConfirmPrompt.includes('150kg Okra')) {
      throw new Error('Expected demand signal confirm prompt');
    }

    // Confirm Post (1)
    const demandSuccessPrompt = await sessionEngine.dispatch(sessionId, buyerPhone, '4*150*2*8*1');
    console.log('Demand Success Prompt:\n', demandSuccessPrompt);
    if (!demandSuccessPrompt.includes('Signal posted')) throw new Error('Expected demand signal success screen');

    // Verify DB
    const demandRecord = await prisma.preOrder.findFirst({
      where: { buyerId: buyer.id, cropType: CropType.OKRA, status: PreOrderStatus.OPEN }
    });
    if (!demandRecord || demandRecord.quantityKg !== 150 || demandRecord.maxPricePerKg !== 8) {
      throw new Error('Test 5 failed: Demand pre-order not found in database or fields mismatch');
    }
    console.log('Demand Signal posted to DB successfully: ID =', demandRecord.id);

    console.log('\n🎉 All Buyer Menu USSD Module tests passed successfully!');

  } catch (error: any) {
    console.error('❌ Buyer Menu Test Failed:', error.message);
    process.exit(1);
  } finally {
    // Cleanup test data
    await prisma.ussdAuditLog.deleteMany({ where: { sessionId } });
    await prisma.ussdShortMessage.deleteMany({ where: { toPhone: buyerPhone } });
    await prisma.deliveryRequest.deleteMany({ where: { order: { buyer: { phone: buyerPhone } } } });
    await prisma.order.deleteMany({ where: { buyer: { phone: buyerPhone } } });
    await prisma.preOrder.deleteMany({ where: { buyer: { phone: buyerPhone } } });
    await prisma.produceListing.deleteMany({ where: { farmer: { phone: farmerPhone } } });
    await prisma.ussdSession.deleteMany({ where: { sessionId } });
    await prisma.user.deleteMany({ where: { phone: { in: [buyerPhone, farmerPhone] } } });
    console.log('🧹 Cleaned up buyer test records.');
    process.exit(0);
  }
}

runBuyerMenuTests();
