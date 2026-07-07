import prisma from '../../prisma/client';
import { normalizePhone } from '../auth.service';
import { SENSITIVE_ACTIONS } from '../../config/ussd.config';
import { config } from '../../config';
import AfricasTalking = require('africastalking');
import bcrypt from 'bcryptjs';

// Menu Module Imports
import * as mainMenu from './mainMenu';
import * as farmerMenu from './menus/farmerMenu.service';
import * as buyerMenu from './menus/buyerMenu.service';
import * as transportMenu from './menus/transportMenu.service';
import * as preOrderMenu from './preOrderMenu';
import * as balanceMenu from './menus/balanceMenu.service';
import * as languageMenu from './menus/languageMenu.service';
import * as pinMenu from './pinMenu';

export class UssdLengthError extends Error {
  public length: number;
  public responseText: string;

  constructor(length: number, responseText: string) {
    super(`USSD response length exceeds 182 characters (current: ${length}): "${responseText}"`);
    this.name = 'UssdLengthError';
    this.length = length;
    this.responseText = responseText;
  }
}

/**
 * Normalizes prefix and enforces 182-character USSD limit.
 */
export function respond(type: 'CON' | 'END', text: string): string {
  const response = `${type} ${text}`;
  if (response.length > 182) {
    throw new UssdLengthError(response.length, response);
  }
  return response;
}

/**
 * Safely truncates dynamic text to prevent exceeding limit.
 */
export function truncateForUssd(text: string, limit = 182): string {
  if (text.length <= limit) {
    return text;
  }
  return text.substring(0, limit - 3) + '...';
}

/**
 * Fetches or creates an active session.
 */
export async function getOrCreateSession(
  sessionId: string,
  phone: string,
  language?: string
): Promise<any> {
  const normalizedPhone = normalizePhone(phone);

  let session = await prisma.ussdSession.findFirst({
    where: { sessionId, isActive: true },
    include: { user: true }
  });

  if (session) {
    // Touch to update lastActivityAt
    session = await prisma.ussdSession.update({
      where: { id: session.id },
      data: { lastActivityAt: new Date() },
      include: { user: true }
    });
    return session;
  }

  // Delete any conflicting session with the same sessionId
  await prisma.ussdSession.deleteMany({
    where: { sessionId }
  });

  const user = await prisma.user.findUnique({
    where: { phone: normalizedPhone }
  });

  const preferredLanguage = user?.preferredLanguage || language || 'en';

  session = await prisma.ussdSession.create({
    data: {
      sessionId,
      phone: normalizedPhone,
      userId: user?.id || null,
      language: preferredLanguage,
      currentMenu: 'INIT',
      currentStep: 'START',
      menuStack: [],
      tempData: {},
      inputHistory: [],
      isActive: true,
    },
    include: { user: true }
  });

  return session;
}

/**
 * Ends a USSD session and logs it.
 */
export async function endSession(sessionId: string, reason: string): Promise<any> {
  const session = await prisma.ussdSession.findFirst({
    where: { sessionId, isActive: true }
  });

  if (!session) return null;

  const updated = await prisma.ussdSession.update({
    where: { id: session.id },
    data: {
      isActive: false,
      endedAt: new Date(),
      endReason: reason,
    },
    include: { user: true }
  });

  await prisma.ussdAuditLog.create({
    data: {
      sessionId: session.sessionId,
      phone: session.phone,
      userId: session.userId,
      menu: session.currentMenu,
      step: session.currentStep,
      userInput: null,
      systemResponse: `END ${reason}`,
      action: 'SESSION_END',
      metadata: { reason }
    }
  });

  return updated;
}

/**
 * Pushes the current menu state onto the stack and transitions to a new menu.
 */
export async function pushMenu(
  session: any,
  menu: string,
  step: string,
  tempData?: any
): Promise<any> {
  const stack = Array.isArray(session.menuStack) ? [...session.menuStack] : [];
  stack.push({
    menu: session.currentMenu,
    step: session.currentStep,
    data: JSON.parse(JSON.stringify(session.tempData || {})),
  });

  const mergedTempData = {
    ...(session.tempData as object || {}),
    ...(tempData || {}),
  };

  const updated = await prisma.ussdSession.update({
    where: { id: session.id },
    data: {
      currentMenu: menu,
      currentStep: step,
      menuStack: stack,
      tempData: mergedTempData,
    },
    include: { user: true }
  });

  return updated;
}

/**
 * Pops the last menu state from the stack.
 */
export async function popMenu(session: any): Promise<any> {
  const stack = Array.isArray(session.menuStack) ? [...session.menuStack] : [];
  if (stack.length === 0) {
    const updated = await prisma.ussdSession.update({
      where: { id: session.id },
      data: {
        currentMenu: 'MAIN',
        currentStep: 'START',
        menuStack: [],
      },
      include: { user: true }
    });
    return updated;
  }

  const popped = stack.pop();
  const updated = await prisma.ussdSession.update({
    where: { id: session.id },
    data: {
      currentMenu: popped.menu,
      currentStep: popped.step,
      tempData: popped.data,
      menuStack: stack,
    },
    include: { user: true }
  });

  return updated;
}

/**
 * Pops the last menu stack item to go back.
 */
export async function handleBack(session: any): Promise<any> {
  return await popMenu(session);
}

/**
 * Checks if PIN entry is required based on age of last USSD activity or sensitive actions.
 */
export function isPinRequired(session: any, action?: string): boolean {
  const user = session.user;
  if (!user || !user.ussdPin) {
    return false;
  }

  let isExpired = true;
  if (user.lastUssdActivity) {
    const diffMs = Date.now() - new Date(user.lastUssdActivity).getTime();
    if (diffMs <= 30 * 60 * 1000) {
      isExpired = false;
    }
  }

  const isSensitive = action
    ? SENSITIVE_ACTIONS.map(a => a.toUpperCase()).includes(action.toUpperCase())
    : false;

  return isExpired || isSensitive;
}

/**
 * Authenticates user PIN, managing incorrect attempt lockouts and SMS dispatch.
 */
export async function authenticateWithPin(
  session: any,
  inputPin: string
): Promise<'ok' | 'wrong' | 'locked'> {
  const freshSession = await prisma.ussdSession.findUnique({
    where: { id: session.id },
    include: { user: true }
  });

  if (!freshSession || !freshSession.user) return 'wrong';
  const user = freshSession.user;

  if (user.lockoutUntil && new Date(user.lockoutUntil) > new Date()) {
    return 'locked';
  }

  if (!user.ussdPin) return 'wrong';

  const pinMatch = await bcrypt.compare(inputPin, user.ussdPin);

  if (pinMatch) {
    const nextTempData = {
      ...(freshSession.tempData as object || {}),
      pinAttempts: 0,
      pinAuthenticated: true
    };

    await prisma.ussdSession.update({
      where: { id: freshSession.id },
      data: { tempData: nextTempData }
    });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastUssdActivity: new Date(),
        lockoutUntil: null
      }
    });

    return 'ok';
  } else {
    const attempts = ((freshSession.tempData as any)?.pinAttempts || 0) + 1;
    const nextTempData = {
      ...(freshSession.tempData as object || {}),
      pinAttempts: attempts
    };

    await prisma.ussdSession.update({
      where: { id: freshSession.id },
      data: { tempData: nextTempData }
    });

    if (attempts >= 3) {
      const lockoutUntil = new Date(Date.now() + 60 * 60 * 1000); // 1 hour lockout
      await prisma.user.update({
        where: { id: user.id },
        data: { lockoutUntil }
      });

      await sendUssdSms(
        user.phone,
        "Your AgriConnect USSD account has been locked due to 3 consecutive incorrect PIN attempts. Please try again in 1 hour.",
        "ACCOUNT_LOCKOUT"
      );

      return 'locked';
    }

    return 'wrong';
  }
}

/**
 * Validates, hashes, and sets USSD PIN for a registered user.
 */
export async function setPin(
  phone: string,
  pin: string,
  confirmPin: string
): Promise<'ok' | 'mismatch' | 'invalid'> {
  if (pin !== confirmPin) {
    return 'mismatch';
  }
  if (!/^\d{4}$/.test(pin)) {
    return 'invalid';
  }

  const normalizedPhone = normalizePhone(phone);
  const user = await prisma.user.findUnique({
    where: { phone: normalizedPhone }
  });

  if (!user) return 'invalid';

  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(pin, salt);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      ussdPin: hashed,
      ussdPinSetAt: new Date()
    }
  });

  return 'ok';
}

/**
 * Helper to queue SMS to database and attempt Africa's Talking delivery.
 */
export async function sendUssdSms(
  toPhone: string,
  message: string,
  triggerAction: string
): Promise<any> {
  const smsRecord = await prisma.ussdShortMessage.create({
    data: {
      toPhone,
      message,
      triggerAction,
      status: 'QUEUED',
    }
  });

  try {
    if (
      config.AFRICAS_TALKING_API_KEY &&
      config.AFRICAS_TALKING_API_KEY !== 'mock_africas_talking_api_key'
    ) {
      const at = AfricasTalking({
        apiKey: config.AFRICAS_TALKING_API_KEY,
        username: config.AFRICAS_TALKING_USERNAME || 'sandbox'
      });
      await at.SMS.send({
        to: [toPhone],
        message
      });
    } else {
      console.log(`[DEV SMS] to ${toPhone}: ${message}`);
    }

    return await prisma.ussdShortMessage.update({
      where: { id: smsRecord.id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        attemptCount: 1,
      }
    });
  } catch (error: any) {
    console.error('Failed to send USSD SMS:', error);
    return await prisma.ussdShortMessage.update({
      where: { id: smsRecord.id },
      data: {
        status: 'FAILED',
        errorMessage: error.message || String(error),
        attemptCount: 1,
      }
    });
  }
}

/**
 * Main USSD dispatch logic coordinating lifecycle, authentication, and routing.
 */
export async function dispatch(
  sessionId: string,
  phone: string,
  rawText: string,
  overrideLang?: string
): Promise<string> {
  let session = await getOrCreateSession(sessionId, phone, overrideLang);

  const parts = rawText === '' ? [] : rawText.split('*');
  let userInput = parts.length > 0 ? parts[parts.length - 1] : '';

  const history = Array.isArray(session.inputHistory) ? [...session.inputHistory] : [];
  if (rawText !== '') {
    history.push(userInput);
  }

  session = await prisma.ussdSession.update({
    where: { id: session.id },
    data: { inputHistory: history },
    include: { user: true }
  });

  const auditLog = await prisma.ussdAuditLog.create({
    data: {
      sessionId: session.sessionId,
      phone: session.phone,
      userId: session.userId,
      menu: session.currentMenu,
      step: session.currentStep,
      userInput: rawText === '' ? null : userInput,
      systemResponse: 'PENDING',
    }
  });

  if (
    userInput === '0' &&
    session.currentStep !== 'START' &&
    session.currentMenu !== 'INIT' &&
    session.currentMenu !== 'MAIN'
  ) {
    session = await handleBack(session);
    userInput = '';
  }

  if (session.user && !session.user.ussdPin) {
    if (!session.currentMenu.startsWith('PIN_SETUP') && !session.currentMenu.startsWith('PIN_')) {
      session = await pushMenu(session, 'PIN_SETUP', 'START');
    }
  } else if (isPinRequired(session)) {
    if (!session.currentMenu.startsWith('PIN_AUTH') && !session.currentMenu.startsWith('PIN_')) {
      session = await pushMenu(session, 'PIN_AUTH', 'START');
    }
  }

  let responseText = '';
  const menu = session.currentMenu;

  try {
    if (menu === 'INIT' || menu === 'MAIN') {
      responseText = await mainMenu.handle(session, userInput);
    } else if (menu.startsWith('FARMER_')) {
      responseText = await farmerMenu.handle(session, userInput);
    } else if (menu.startsWith('BUYER_')) {
      responseText = await buyerMenu.handle(session, userInput);
    } else if (menu.startsWith('TRANSPORT_')) {
      responseText = await transportMenu.handle(session, userInput);
    } else if (menu.startsWith('PREORDER_')) {
      responseText = await preOrderMenu.handle(session, userInput);
    } else if (menu.startsWith('BALANCE_')) {
      responseText = await balanceMenu.handle(session, userInput);
    } else if (menu.startsWith('LANGUAGE_')) {
      responseText = await languageMenu.handle(session, userInput);
    } else if (menu.startsWith('PIN_')) {
      responseText = await pinMenu.handle(session, userInput);
    } else {
      responseText = respond('END', 'Invalid menu context.');
    }
  } catch (error: any) {
    console.error('Error in USSD dispatch menu handler:', error);
    responseText = respond('END', 'An error occurred. Please try again.');
  }

  await prisma.ussdAuditLog.update({
    where: { id: auditLog.id },
    data: {
      systemResponse: responseText,
      action: session.tempData?.action || null,
      metadata: {
        tempData: session.tempData,
        currentMenu: session.currentMenu,
        currentStep: session.currentStep
      }
    }
  });

  if (responseText.startsWith('END')) {
    const endReason = responseText.includes('locked')
      ? 'LOCKED'
      : (userInput === '0' ? 'USER_END' : 'COMPLETED');
    await endSession(session.sessionId, endReason);
  }

  return responseText;
}
