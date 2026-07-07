import prisma from '../../../prisma/client';
import { t } from '../../../prisma/ussdTranslations';
import { respond, endSession, sendUssdSms } from '../sessionEngine.service';

export async function handle(session: any, input: string): Promise<string> {
  const lang = session.language || 'en';
  const menu = session.currentMenu;

  if (input === '') {
    const text = t(lang, 'language_menu') || "Choose language:\n1. English\n2. Twi\n3. Ewe\n4. Hausa";
    return respond('CON', text);
  }

  let newLang = 'en';
  let confirmText = '';
  let smsText = '';

  if (input === '1') {
    newLang = 'en';
    confirmText = 'Language set to English.';
    smsText = 'AgriConnect: Language set to English. Dial *920*11# to trade, view orders, and manage deliveries.';
  } else if (input === '2') {
    newLang = 'tw';
    confirmText = 'Wɔsesa kasa Twi.';
    smsText = 'AgriConnect: Wɔsesa kasa Twi. Twa *920*11# na hyɛ guadi ase, hwɛ nhyehyɛe, na di adwuma.';
  } else if (input === '3') {
    newLang = 'ew';
    confirmText = 'Wɔgugbɔ gbe Ewe.';
    smsText = 'AgriConnect: Wɔgugbɔ gbe Ewe. Fɔ *920*11# na di nutifafa, kpɔ ame dɔawo, na wɔ asitsadɔ.';
  } else if (input === '4') {
    newLang = 'ha';
    confirmText = 'An canza harshe Hausa.';
    smsText = 'AgriConnect: An canza harshe Hausa. Kira *920*11# don gudanar da kasuwanci, duba oda, da aiki.';
  } else if (input === '0') {
    return respond('CON', t(lang, 'main_menu'));
  } else {
    return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
  }

  // Update DB preferredLanguage for User
  if (session.userId) {
    await prisma.user.update({
      where: { id: session.userId },
      data: { preferredLanguage: newLang }
    });
  }

  // Update session language
  await prisma.ussdSession.update({
    where: { id: session.id },
    data: { language: newLang }
  });

  // Send confirmation SMS
  const targetPhone = session.user?.phone || session.phone;
  await sendUssdSms(targetPhone, smsText, 'LANGUAGE_CHANGE_SMS');

  return respond('END', confirmText);
}
