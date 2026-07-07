import prisma from '../../../prisma/client';
import { t } from '../../../prisma/ussdTranslations';
import { respond, pushMenu, popMenu, endSession } from '../sessionEngine.service';

export async function handle(session: any, input: string): Promise<string> {
  const lang = session.language || 'en';
  const menu = session.currentMenu;
  const step = session.currentStep;

  // Since this is a stub for the wallet features, we mock balance values:
  const available = 250.00;
  const pending = 120.00;

  if (menu === 'BALANCE_MAIN') {
    if (input === '') {
      return respond(
        'CON',
        `My AgriConnect wallet:\nBalance: GHS ${available.toFixed(2)}\nPending: GHS ${pending.toFixed(2)}\n\n1. Withdraw to MoMo\n2. Transaction history\n3. Receive payment info\n0. Back`
      );
    }

    if (input === '1') {
      const updated = await pushMenu(session, 'BALANCE_WITHDRAW', 'QTY');
      return await handleWithdraw(updated, '', lang, 'QTY');
    }

    if (input === '2') {
      const updated = await pushMenu(session, 'BALANCE_HISTORY', 'VIEW');
      return await handleHistory(updated, '', lang, 'VIEW');
    }

    if (input === '3') {
      return respond(
        'END',
        `AgriConnect payments are routed directly to your wallet. You can check your balance anytime or request withdrawals to Mobile Money.`
      );
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return respond('CON', t(lang, 'main_menu'));
    }

    return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
  }

  if (menu.startsWith('BALANCE_WITHDRAW')) {
    return await handleWithdraw(session, input, lang, step);
  }

  if (menu.startsWith('BALANCE_HISTORY')) {
    return await handleHistory(session, input, lang, step);
  }

  return respond('END', t(lang, 'invalid_session'));
}

/**
 * Withdrawal flow stub
 */
async function handleWithdraw(session: any, input: string, lang: string, step: string): Promise<string> {
  const available = 250.00;
  const defaultPhone = session.user?.phone || session.phone;

  if (step === 'QTY') {
    if (input === '') {
      return respond('CON', `Withdraw how much? (max GHS${available.toFixed(2)})\n0. Back`);
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handle(updated, '');
    }

    const amount = parseFloat(input);
    if (isNaN(amount) || amount <= 0 || amount > available) {
      return respond('CON', `Invalid amount. Enter amount (max GHS${available.toFixed(2)}):\n0. Back`);
    }

    const updated = await pushMenu(session, 'BALANCE_WITHDRAW', 'PHONE_OPTION', { withdrawAmount: amount });
    return respond('CON', `To MoMo number ${defaultPhone}?\n1. Yes\n2. Different number\n0. Back`);
  }

  if (step === 'PHONE_OPTION') {
    const amount = session.tempData.withdrawAmount || 0;

    if (input === '') {
      return respond('CON', `To MoMo number ${defaultPhone}?\n1. Yes\n2. Different number\n0. Back`);
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handleWithdraw(updated, '', lang, 'QTY');
    }

    if (input === '1') {
      // Use default phone
      const updated = await pushMenu(session, 'BALANCE_WITHDRAW', 'CONFIRM', { withdrawPhone: defaultPhone });
      return respond('CON', `Confirm withdrawal:\nGHS${amount.toFixed(2)} → MoMo ${defaultPhone}\n\n1. Confirm\n0. Cancel`);
    }

    if (input === '2') {
      // Input custom phone
      const updated = await pushMenu(session, 'BALANCE_WITHDRAW', 'PHONE_INPUT');
      return respond('CON', `Enter MoMo number:\n0. Back`);
    }

    return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
  }

  if (step === 'PHONE_INPUT') {
    const amount = session.tempData.withdrawAmount || 0;

    if (input === '') {
      return respond('CON', `Enter MoMo number:\n0. Back`);
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handleWithdraw(updated, '', lang, 'PHONE_OPTION');
    }

    // Basic validation of phone number
    if (!/^\+?\d{9,15}$/.test(input)) {
      return respond('CON', `Invalid phone number. Enter MoMo number:\n0. Back`);
    }

    const updated = await pushMenu(session, 'BALANCE_WITHDRAW', 'CONFIRM', { withdrawPhone: input });
    return respond('CON', `Confirm withdrawal:\nGHS${amount.toFixed(2)} → MoMo ${input}\n\n1. Confirm\n0. Cancel`);
  }

  if (step === 'CONFIRM') {
    const amount = session.tempData.withdrawAmount || 0;
    const phone = session.tempData.withdrawPhone || defaultPhone;

    if (input === '') {
      return respond('CON', `Confirm withdrawal:\nGHS${amount.toFixed(2)} → MoMo ${phone}\n\n1. Confirm\n0. Cancel`);
    }

    if (input === '0' || input === '2') {
      // Cancel/back to quantity input
      let current = session;
      while (current.currentMenu.startsWith('BALANCE_WITHDRAW')) {
        current = await popMenu(current);
      }
      return await handle(current, '');
    }

    if (input === '1') {
      // Perform mock API call or DB log
      const ref = `WDL-${Date.now().toString().slice(-6)}`;
      console.log(`[STUB WALLET PAYOUT] POST /api/wallet/withdraw: GHS ${amount} to ${phone}, reference: ${ref}`);

      // Clear temp states
      await prisma.ussdSession.update({
        where: { id: session.id },
        data: { tempData: {} }
      });

      return respond(
        'END',
        `Withdrawal of GHS${amount.toFixed(2)} initiated.\nYou will receive an MoMo prompt.\nRef: ${ref}`
      );
    }

    return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
  }

  return respond('END', t(lang, 'invalid_session'));
}

/**
 * Transaction history stub
 */
async function handleHistory(session: any, input: string, lang: string, step: string): Promise<string> {
  if (step === 'VIEW') {
    if (input === '') {
      const historyLines = [
        '1. Sale - Tomato - GHS120.00',
        '2. Withdrawal - GHS100.00',
        '3. Deposit Credit - GHS50.00',
        '4. Sale - Pepper - GHS80.00',
        '5. Withdrawal - GHS120.00'
      ];

      return respond('CON', `Recent:\n${historyLines.join('\n')}\n0. Back`);
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handle(updated, '');
    }

    return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
  }

  return respond('END', t(lang, 'invalid_session'));
}
