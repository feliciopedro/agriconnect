import { Request, Response } from 'express';
import { PaymentService } from '../services/payment.service';
import { createError } from '../utils/errors';

export class PaymentController {
  /**
   * Initializes a new payment attempt for a buyer's order.
   */
  public static async initialize(req: Request, res: Response): Promise<void> {
    const requestingUserId = req.user!.userId;
    const { orderId } = req.body;

    if (!orderId) {
      throw createError('Missing required field orderId in request body', 'MISSING_ORDER_ID', 400);
    }

    const result = await PaymentService.initializePayment(orderId, requestingUserId);
    res.status(200).json(result);
  }

  /**
   * Webhook endpoint called by Paystack directly upon charge success events.
   * Verifies headers cryptographically and responds 200 immediately.
   */
  public static async webhook(req: Request, res: Response): Promise<void> {
    const signature = req.headers['x-paystack-signature'] as string;
    
    if (!signature) {
      res.status(400).send('Paystack signature header is missing.');
      return;
    }

    // req.body should be a Buffer because of raw-parser middleware mapping
    const rawBody = req.body;
    if (!Buffer.isBuffer(rawBody)) {
      res.status(400).send('Raw body buffer required for signature checks.');
      return;
    }

    // Verify signature
    const isValid = PaymentService.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      res.status(400).send('Cryptographic signature verification failed.');
      return;
    }

    // Acknowledge event immediately to avoid timeout retries
    res.status(200).send('Event received.');

    // Process event payload asynchronously
    setImmediate(async () => {
      try {
        const event = JSON.parse(rawBody.toString('utf-8'));
        await PaymentService.handleWebhookEvent(event);
      } catch (error) {
        console.error('Asynchronous payment webhook processing error:', error);
      }
    });
  }

  /**
   * Manually checks and verifies transaction statuses from Paystack.
   */
  public static async verify(req: Request, res: Response): Promise<void> {
    const requestingUserId = req.user!.userId;
    const { orderId } = req.params;

    const result = await PaymentService.verifyTransactionManually(orderId, requestingUserId);
    res.status(200).json(result);
  }
}
