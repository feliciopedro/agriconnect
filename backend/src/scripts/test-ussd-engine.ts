import prisma from '../prisma/client';
import * as sessionEngine from '../services/ussd/sessionEngine.service';
import { Role } from '../prisma/generated-client';

async function runEngineTests() {
  console.log('🧪 Starting USSD Session Engine tests...\n');

  const testPhone = '+233249999999';
  const sessionId = 'ENGINE_TEST_SESSION_XYZ';

  // Cleanup past test data
  await prisma.ussdAuditLog.deleteMany({ where: { sessionId } });
  await prisma.ussdShortMessage.deleteMany({ where: { toPhone: testPhone } });
  await prisma.ussdSession.deleteMany({ where: { sessionId } });
  await prisma.user.deleteMany({ where: { phone: testPhone } });

  console.log('🧹 Cleaned up old engine test records.');

  try {
    // 1. Test getOrCreateSession for new user (unregistered)
    console.log('\n--- Test 1: getOrCreateSession (unregistered phone) ---');
    let session = await sessionEngine.getOrCreateSession(sessionId, testPhone);
    console.log(`Created session ID: ${session.id}, Menu: ${session.currentMenu}, Step: ${session.currentStep}`);
    if (session.currentMenu !== 'INIT' || session.currentStep !== 'START' || session.userId !== null) {
      throw new Error('Test 1 failed: Expected initial values for unregistered user session');
    }

    // Register User
    const user = await prisma.user.create({
      data: {
        phone: testPhone,
        name: 'Engine Test User',
        role: Role.FARMER,
        isVerified: true
      }
    });
    console.log('Registered user ID:', user.id);

    // 2. Test getOrCreateSession for registered user
    console.log('\n--- Test 2: getOrCreateSession (registered user) ---');
    // Delete existing session to force recreation
    await prisma.ussdSession.deleteMany({ where: { sessionId } });
    session = await sessionEngine.getOrCreateSession(sessionId, testPhone);
    console.log(`Recreated session ID: ${session.id}, User ID associated: ${session.userId}`);
    if (session.userId !== user.id) {
      throw new Error('Test 2 failed: Expected session to associate with registered User ID');
    }

    // 3. Test pushMenu & popMenu
    console.log('\n--- Test 3: pushMenu and popMenu transitions ---');
    session = await sessionEngine.pushMenu(session, 'FARMER_LISTINGS', 'SHOW_LIST', { itemIndex: 2 });
    console.log(`Pushed to Menu: ${session.currentMenu}, Step: ${session.currentStep}, Stack length: ${session.menuStack.length}, tempData:`, session.tempData);
    if (session.currentMenu !== 'FARMER_LISTINGS' || session.tempData.itemIndex !== 2) {
      throw new Error('Test 3 failed: Push menu failed');
    }

    session = await sessionEngine.popMenu(session);
    console.log(`Popped back to Menu: ${session.currentMenu}, Step: ${session.currentStep}, Stack length: ${session.menuStack.length}`);
    if (session.currentMenu !== 'INIT' || session.currentStep !== 'START') {
      throw new Error('Test 3 failed: Pop menu failed');
    }

    // 4. Test PIN Setup & Hashing
    console.log('\n--- Test 4: setPin (PIN Setup flow) ---');
    const mismatchRes = await sessionEngine.setPin(testPhone, '1234', '5678');
    console.log('Set mismatch result:', mismatchRes);
    if (mismatchRes !== 'mismatch') throw new Error('Expected mismatch for different PINs');

    const invalidRes = await sessionEngine.setPin(testPhone, '123a', '123a');
    console.log('Set invalid result:', invalidRes);
    if (invalidRes !== 'invalid') throw new Error('Expected invalid for non-digit PIN');

    const okRes = await sessionEngine.setPin(testPhone, '1234', '1234');
    console.log('Set ok result:', okRes);
    if (okRes !== 'ok') throw new Error('Expected success setting PIN');

    // Fetch user to verify
    const dbUser = await prisma.user.findUnique({ where: { phone: testPhone } });
    if (!dbUser?.ussdPin || !dbUser.ussdPinSetAt) {
      throw new Error('Expected ussdPin to be set on user record');
    }
    console.log('Bcrypt PIN hash stored successfully:', dbUser.ussdPin);

    // Refresh session to get updated user object
    session = await sessionEngine.getOrCreateSession(sessionId, testPhone);

    // 5. Test PIN Requirements
    console.log('\n--- Test 5: isPinRequired checks ---');
    const pinReq1 = sessionEngine.isPinRequired(session);
    console.log('isPinRequired (expired lastUssdActivity):', pinReq1);
    if (!pinReq1) throw new Error('Expected PIN required because lastUssdActivity is null');

    // Mock last activity update
    await prisma.user.update({
      where: { id: user.id },
      data: { lastUssdActivity: new Date() }
    });
    session = await sessionEngine.getOrCreateSession(sessionId, testPhone);
    const pinReq2 = sessionEngine.isPinRequired(session);
    console.log('isPinRequired (recent activity, normal action):', pinReq2);
    if (pinReq2) throw new Error('Expected PIN NOT required for recent activity and normal action');

    const pinReq3 = sessionEngine.isPinRequired(session, 'withdrawal');
    console.log('isPinRequired (recent activity, sensitive action "withdrawal"):', pinReq3);
    if (!pinReq3) throw new Error('Expected PIN required for sensitive action');

    // 6. Test PIN Authentication and lockout
    console.log('\n--- Test 6: authenticateWithPin and Lockout ---');
    const authWrong1 = await sessionEngine.authenticateWithPin(session, '9999');
    console.log('Wrong authentication attempt 1:', authWrong1);
    if (authWrong1 !== 'wrong') throw new Error('Expected wrong result');

    const authWrong2 = await sessionEngine.authenticateWithPin(session, '9999');
    console.log('Wrong authentication attempt 2:', authWrong2);
    if (authWrong2 !== 'wrong') throw new Error('Expected wrong result');

    const authWrong3 = await sessionEngine.authenticateWithPin(session, '9999');
    console.log('Wrong authentication attempt 3 (should lock):', authWrong3);
    if (authWrong3 !== 'locked') throw new Error('Expected locked out result after 3 failures');

    // Check lockout in User record
    const lockedUser = await prisma.user.findUnique({ where: { phone: testPhone } });
    if (!lockedUser?.lockoutUntil || new Date(lockedUser.lockoutUntil) <= new Date()) {
      throw new Error('Expected lockoutUntil timestamp to be set 1 hour in the future');
    }
    console.log('Lockout timestamp set in database:', lockedUser.lockoutUntil);

    // Check SMS queue
    const queuedSms = await prisma.ussdShortMessage.findFirst({
      where: { toPhone: testPhone, triggerAction: 'ACCOUNT_LOCKOUT' }
    });
    if (!queuedSms) {
      throw new Error('Expected lockout SMS alert to be registered');
    }
    console.log('Lockout alert SMS logged in UssdShortMessage:', queuedSms.message, 'Status:', queuedSms.status);

    // 7. Test Length constraints
    console.log('\n--- Test 7: Response builder length checks ---');
    const conResponse = sessionEngine.respond('CON', 'A'.repeat(100));
    console.log(`Normal response (len=${conResponse.length}) constructed.`);
    if (conResponse !== 'CON ' + 'A'.repeat(100)) throw new Error('Expected valid prefix');

    try {
      sessionEngine.respond('CON', 'B'.repeat(180));
      throw new Error('Expected UssdLengthError to be thrown for long text');
    } catch (e: any) {
      if (e.name === 'UssdLengthError') {
        console.log('Successfully caught UssdLengthError:', e.message);
      } else {
        throw e;
      }
    }

    const truncated = sessionEngine.truncateForUssd('C'.repeat(200), 100);
    console.log(`Truncated text length: ${truncated.length}, ends with: "${truncated.substring(truncated.length - 5)}"`);
    if (truncated.length !== 100 || !truncated.endsWith('...')) {
      throw new Error('Expected proper truncation to limit');
    }

    // 8. Test Main Dispatch routing
    console.log('\n--- Test 8: Main Dispatch dispatcher routing ---');
    // Clear lockout for dispatch testing
    await prisma.user.update({
      where: { id: user.id },
      data: { lockoutUntil: null }
    });
    const dispatchResponse = await sessionEngine.dispatch(sessionId, testPhone, '');
    console.log('Dispatch empty text response:', dispatchResponse);
    if (!dispatchResponse.includes('Main Menu Stub')) {
      throw new Error('Expected dispatch to route to mainMenu stub');
    }

    console.log('\n🎉 All USSD Session Engine tests passed successfully!');

  } catch (error: any) {
    console.error('❌ Engine Test Failed:', error.message);
    process.exit(1);
  } finally {
    // Cleanup test data
    await prisma.ussdAuditLog.deleteMany({ where: { sessionId } });
    await prisma.ussdShortMessage.deleteMany({ where: { toPhone: testPhone } });
    await prisma.ussdSession.deleteMany({ where: { sessionId } });
    await prisma.user.deleteMany({ where: { phone: testPhone } });
    console.log('🧹 Cleaned up engine test records.');
    process.exit(0);
  }
}

runEngineTests();
