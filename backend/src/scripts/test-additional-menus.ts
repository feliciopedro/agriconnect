import prisma from '../prisma/client';
import * as sessionEngine from '../services/ussd/sessionEngine.service';
import { Role } from '../prisma/generated-client';

async function runAdditionalMenuTests() {
  console.log('🧪 Starting USSD Additional Menus (Pre-Order, Balance, Language) tests...\n');

  const farmerPhone = '+233248888888';
  const buyerPhone = '+233249999999';
  const sessionId = 'ADDITIONAL_TEST_SESSION_XYZ';

  // Cleanup past records
  await prisma.ussdAuditLog.deleteMany({ where: { sessionId } });
  await prisma.ussdShortMessage.deleteMany({ where: { toPhone: { in: [farmerPhone, buyerPhone] } } });
  await prisma.preOrder.deleteMany({ where: { buyer: { phone: buyerPhone } } });
  await prisma.produceListing.deleteMany({ where: { farmer: { phone: farmerPhone } } });
  await prisma.ussdSession.deleteMany({ where: { sessionId } });
  await prisma.user.deleteMany({ where: { phone: { in: [farmerPhone, buyerPhone] } } });

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
      lastUssdActivity: new Date(),
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

  try {
    // --- Test 1: Language Menu Flow ---
    console.log('\n--- Test 1: Language Menu Flow ---');
    let session = await sessionEngine.getOrCreateSession(sessionId, farmerPhone);
    session = await prisma.ussdSession.update({
      where: { id: session.id },
      data: { currentMenu: 'LANGUAGE_MAIN', currentStep: 'START' },
      include: { user: true }
    });

    const langPrompt = await sessionEngine.dispatch(sessionId, farmerPhone, '');
    console.log('Language Menu Prompt:\n', langPrompt);
    if (!langPrompt.includes('English') || !langPrompt.includes('Twi')) {
      throw new Error('Test 1 failed: Expected language options');
    }

    // Switch to Twi (option 2)
    const langChange = await sessionEngine.dispatch(sessionId, farmerPhone, '2');
    console.log('Language Change Response:\n', langChange);
    if (!langChange.includes('Wɔsesa kasa Twi')) {
      throw new Error('Test 1 failed: Expected Twi success confirmation text');
    }

    // Check DB preference
    const updatedFarmer = await prisma.user.findUnique({ where: { id: farmer.id } });
    if (updatedFarmer?.preferredLanguage !== 'tw') {
      throw new Error('Test 1 failed: User preferredLanguage was not updated to tw in DB');
    }

    // Check SMS was sent
    const sms = await prisma.ussdShortMessage.findFirst({
      where: { toPhone: farmerPhone, triggerAction: 'LANGUAGE_CHANGE_SMS' }
    });
    if (!sms || !sms.message.includes('Twi')) {
      throw new Error('Test 1 failed: Language confirmation SMS was not created correctly');
    }
    console.log('Language updated and confirmation SMS logged successfully.');

    // --- Test 2: Balance & Wallet Menu Flow ---
    console.log('\n--- Test 2: Balance & Wallet Menu Flow ---');
    session = await prisma.ussdSession.update({
      where: { id: session.id },
      data: { currentMenu: 'BALANCE_MAIN', currentStep: 'START', language: 'en', isActive: true },
      include: { user: true }
    });

    const balancePrompt = await sessionEngine.dispatch(sessionId, farmerPhone, '');
    console.log('Balance Prompt:\n', balancePrompt);
    if (!balancePrompt.includes('Balance: GHS 250.00')) {
      throw new Error('Test 2 failed: Expected wallet balance query screen');
    }

    // Select Withdraw (1)
    const withdrawPrompt = await sessionEngine.dispatch(sessionId, farmerPhone, '1');
    console.log('Withdraw Qty Prompt:\n', withdrawPrompt);
    if (!withdrawPrompt.includes('Withdraw how much')) throw new Error('Expected withdraw amount prompt');

    // Enter amount (150)
    const phonePrompt = await sessionEngine.dispatch(sessionId, farmerPhone, '1*150');
    console.log('Phone Prompt:\n', phonePrompt);
    if (!phonePrompt.includes('+233248888888')) throw new Error('Expected default phone confirmation');

    // Confirm default phone (1)
    const confirmPrompt = await sessionEngine.dispatch(sessionId, farmerPhone, '1*150*1');
    console.log('Confirm Prompt:\n', confirmPrompt);
    if (!confirmPrompt.includes('Confirm withdrawal')) throw new Error('Expected final confirmation prompt');

    // Finalize (1)
    const withdrawSuccess = await sessionEngine.dispatch(sessionId, farmerPhone, '1*150*1*1');
    console.log('Withdraw Success Response:\n', withdrawSuccess);
    if (!withdrawSuccess.includes('initiated') || !withdrawSuccess.includes('Ref:')) {
      throw new Error('Expected withdrawal success END prompt');
    }
    console.log('Withdrawal stub completed successfully.');

    // --- Test 3: Farmer Pre-Order (Planting Plan) Flow ---
    console.log('\n--- Test 3: Farmer Pre-Order Flow ---');
    session = await prisma.ussdSession.update({
      where: { id: session.id },
      data: { currentMenu: 'FARMER_PREORDER_MAIN', currentStep: 'START', isActive: true },
      include: { user: true }
    });

    const preorderMain = await sessionEngine.dispatch(sessionId, farmerPhone, '');
    console.log('Pre-Order Main Prompt:\n', preorderMain);
    if (!preorderMain.includes('Create planting plan') || !preorderMain.includes('My plans')) {
      throw new Error('Expected farmer pre-order dashboard');
    }

    // Select Create Plan (1)
    const pCrop = await sessionEngine.dispatch(sessionId, farmerPhone, '1');
    console.log('Select Crop Response:\n', pCrop);
    if (!pCrop.includes('Tomato')) throw new Error('Expected crop selection list');

    // Sequential dialing steps for plan creation:
    // Tomato (1)
    const pTomato = await sessionEngine.dispatch(sessionId, farmerPhone, '1*1');
    console.log('Select Tomato Response:\n', pTomato);

    // Qty (500)
    const pQty = await sessionEngine.dispatch(sessionId, farmerPhone, '1*1*500');
    console.log('Qty Response:\n', pQty);

    // Price (6)
    const pPrice = await sessionEngine.dispatch(sessionId, farmerPhone, '1*1*500*6');
    console.log('Price Response:\n', pPrice);

    // Expected harvest month (2)
    const pHarvest = await sessionEngine.dispatch(sessionId, farmerPhone, '1*1*500*6*2');
    console.log('Harvest month Response:\n', pHarvest);

    // Min order (100) -> transitions to CONFIRM
    const finalConfirm = await sessionEngine.dispatch(sessionId, farmerPhone, '1*1*500*6*2*100');
    console.log('Planting Plan Confirm Prompt:\n', finalConfirm);
    if (!finalConfirm.toUpperCase().includes('TOMATO 500KG') || !finalConfirm.includes('Price: GHS 6/kg')) {
      throw new Error('Expected planting plan confirmation text');
    }

    // Confirm (1) -> publishes listing
    const planSuccess = await sessionEngine.dispatch(sessionId, farmerPhone, '1*1*500*6*2*100*1');
    console.log('Plan Success Response:\n', planSuccess);
    if (!planSuccess.includes('Plan published')) {
      throw new Error('Expected planting plan publication END response');
    }

    // Assert plan was created in DB
    const listCount = await prisma.produceListing.count({
      where: { farmerId: farmer.id }
    });
    if (listCount !== 1) throw new Error('ProduceListing planting plan was not created in database');
    console.log('Planting plan created and published successfully.');

    // --- Test 4: Manage Pre-Order Plans & Growing updates ---
    console.log('\n--- Test 4: Manage Pre-Order Plans Flow ---');
    const plans = await prisma.produceListing.findMany({ where: { farmerId: farmer.id } });
    const planId = plans[0].id;

    session = await prisma.ussdSession.update({
      where: { id: session.id },
      data: { currentMenu: 'FARMER_PREORDER_PLANS', currentStep: 'DETAIL', tempData: { activePlanId: planId }, isActive: true },
      include: { user: true }
    });

    const planDetail = await sessionEngine.dispatch(sessionId, farmerPhone, '');
    console.log('Plan Detail Response:\n', planDetail);
    if (!planDetail.includes('Confirm planting') || !planDetail.includes('Post update')) {
      throw new Error('Expected planting plan details menu');
    }

    // Confirm planting (1)
    const plantConfirm = await sessionEngine.dispatch(sessionId, farmerPhone, '1');
    console.log('Plant Confirm Response:\n', plantConfirm);
    if (!plantConfirm.includes('Planting confirmed')) throw new Error('Expected planting confirm prompt');

    // Check DB PlantingLog
    const log = await prisma.plantingLog.findFirst({ where: { farmerId: farmer.id } });
    if (!log) throw new Error('PlantingLog was not created or linked to pre-order plan');
    console.log('Planting logged successfully.');

    console.log('\n🎉 All Additional USSD Menus tests passed successfully!');

  } catch (error: any) {
    console.error('❌ Additional Menus Test Failed:', error.message);
    process.exit(1);
  } finally {
    // Cleanup
    await prisma.ussdAuditLog.deleteMany({ where: { sessionId } });
    await prisma.ussdShortMessage.deleteMany({ where: { toPhone: { in: [farmerPhone, buyerPhone] } } });
    await prisma.preOrder.deleteMany({ where: { buyer: { phone: buyerPhone } } });
    await prisma.produceListing.deleteMany({ where: { farmer: { phone: farmerPhone } } });
    await prisma.ussdSession.deleteMany({ where: { sessionId } });
    await prisma.user.deleteMany({ where: { phone: { in: [farmerPhone, buyerPhone] } } });
    console.log('🧹 Cleaned up additional test records.');
    process.exit(0);
  }
}

runAdditionalMenuTests();
