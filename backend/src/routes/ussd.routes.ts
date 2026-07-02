import { Router, Request, Response, NextFunction } from 'express';
import { UssdService } from '../services/ussd.service';

const router = Router();

/**
 * Public Africa's Talking USSD Webhook handler.
 * Receives: sessionId, phoneNumber, text
 * Returns: text/plain CON/END status sequence
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId, phoneNumber, text } = req.body;

    if (!sessionId || !phoneNumber || text === undefined) {
      res.setHeader('Content-Type', 'text/plain');
      res.status(400).send('END Invalid webhook payload parameters.');
      return;
    }

    const responseText = await UssdService.handleUssdRequest(sessionId, phoneNumber, text);

    res.setHeader('Content-Type', 'text/plain');
    res.status(200).send(responseText);
  } catch (error) {
    next(error);
  }
});

export default router;
