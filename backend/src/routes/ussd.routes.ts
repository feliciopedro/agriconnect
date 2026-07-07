import { Router, Request, Response, NextFunction } from 'express';
import { normalizePhone } from '../services/auth.service';
import { dispatch } from '../services/ussd/sessionEngine.service';

const router = Router();

/**
 * Public Africa's Talking USSD Webhook handler.
 * Receives: sessionId, serviceCode, phoneNumber, text, networkCode
 * Returns: text/plain CON/END status sequence
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId, serviceCode, phoneNumber, text } = req.body;

    if (!sessionId || !phoneNumber || text === undefined) {
      res.setHeader('Content-Type', 'text/plain');
      res.status(400).send('END Invalid webhook payload parameters.');
      return;
    }

    const normalizedPhone = normalizePhone(phoneNumber);

    // 1. Detect language override from serviceCode suffix (e.g. dialed *920*11*99#) or text prefix
    let detectedLang: string | undefined = undefined;
    const codeStr = serviceCode || '';

    if (codeStr.endsWith('*99#') || codeStr.endsWith('*99')) {
      detectedLang = 'tw'; // Twi
    } else if (codeStr.endsWith('*98#') || codeStr.endsWith('*98')) {
      detectedLang = 'ew'; // Ewe
    } else if (codeStr.endsWith('*97#') || codeStr.endsWith('*97')) {
      detectedLang = 'ha'; // Hausa
    } else if (codeStr.endsWith('*96#') || codeStr.endsWith('*96')) {
      detectedLang = 'en'; // English
    }

    // Also detect language prefix in raw text input
    const cleanText = text.trim();
    if (cleanText === '99' || cleanText.startsWith('99*')) {
      detectedLang = 'tw';
    } else if (cleanText === '98' || cleanText.startsWith('98*')) {
      detectedLang = 'ew';
    } else if (cleanText === '97' || cleanText.startsWith('97*')) {
      detectedLang = 'ha';
    } else if (cleanText === '96' || cleanText.startsWith('96*')) {
      detectedLang = 'en';
    }

    // 2. Timeout protection: Respond within 3 seconds.
    // Africa's Talking times out at 3s. We resolve a holding screen if we hit 2.5s.
    const timeoutPromise = new Promise<string>((resolve) => {
      setTimeout(() => {
        resolve('CON Processing...\n1. Check status\n0. Back');
      }, 2500); // 2.5 seconds timeout limit
    });

    const dispatchPromise = dispatch(sessionId, normalizedPhone, cleanText, detectedLang);

    const responseText = await Promise.race([dispatchPromise, timeoutPromise]);

    res.setHeader('Content-Type', 'text/plain');
    res.status(200).send(responseText);
  } catch (error) {
    next(error);
  }
});

export default router;
