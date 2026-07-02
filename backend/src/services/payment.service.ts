import prisma from '../prisma/client';
import { createError } from '../utils/errors';
import { config } from '../config';
import { OrderStatus, PaymentStatus } from '../prisma/generated-client';
import { OrderService } from './order.service';
import crypto from 'crypto';

export class PaymentService {
  /**
   * Initializes a Paystack transaction.
   * Connects to Paystack's endpoint to fetch the redirection payment URL.
   */
  public static async initializePayment(orderId: string, requestingUserId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: { select: { phone: true } },
      },
    });

    if (!order) {
      throw createError('Order not found', 'ORDER_NOT_FOUND', 404);
    }

    if (order.buyerId !== requestingUserId) {
      throw createError(
        'Access forbidden: you are not the buyer of this order',
        'FORBIDDEN_PAYMENT_INIT',
        403
      );
    }

    if (order.paymentStatus === PaymentStatus.PAID) {
      throw createError('Order is already paid', 'ALREADY_PAID', 400);
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw createError('Order is cancelled', 'ORDER_CANCELLED', 400);
    }

    const timestamp = Date.now();
    const reference = `AGC-${orderId}-${timestamp}`;

    // Development fallback if Paystack secret is mock/sandbox
    if (
      !config.PAYSTACK_SECRET_KEY ||
      config.PAYSTACK_SECRET_KEY === 'your_paystack_secret_key' ||
      config.PAYSTACK_SECRET_KEY.includes('mock')
    ) {
      const mockAuthUrl = `${config.FRONTEND_URL}/orders/${orderId}?payment=complete&reference=${reference}`;
      
      await prisma.order.update({
        where: { id: orderId },
        data: { paystackReference: reference },
      });

      return { authorizationUrl: mockAuthUrl, reference };
    }

    // Call Paystack Transaction Initialize
    try {
      const email = `${order.buyer.phone.replace('+', '')}@agriconnect.gh`;
      
      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.PAYSTACK_SECRET_KEY}`,
        },
        body: JSON.stringify({
          amount: Math.round(order.totalPrice * 100), // convert to pesewas/kobo
          email,
          reference,
          callback_url: `${config.FRONTEND_URL}/orders/${orderId}?payment=complete`,
          metadata: { orderId, buyerId: requestingUserId },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Paystack initialize returned ${response.status}: ${errorText}`);
      }

      const body = await response.json();

      // Store the reference on the Order
      await prisma.order.update({
        where: { id: orderId },
        data: { paystackReference: reference },
      });

      return {
        authorizationUrl: body.data.authorization_url,
        reference: body.data.reference,
      };
    } catch (error: any) {
      console.error('Paystack initialization failure:', error.message);
      throw createError(
        `Failed to initialize payment gateway: ${error.message}`,
        'PAYMENT_INIT_ERROR',
        500
      );
    }
  }

  /**
   * Cryptographically verifies the signature header sent by Paystack webhook requests.
   */
  public static verifyWebhookSignature(rawBody: Buffer, signatureHeader: string): boolean {
    const key = config.PAYSTACK_SECRET_KEY || 'mock_paystack_secret_key';
    const computedSignature = crypto
      .createHmac('sha512', key)
      .update(rawBody)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(computedSignature, 'utf-8'),
        Buffer.from(signatureHeader, 'utf-8')
      );
    } catch (e) {
      return false;
    }
  }

  /**
   * Processes Paystack's verified webhook event payloads.
   * Routes by reference prefix:
   *   PRE-{id}-{ts}  → pre-order deposit confirmation
   *   AGC-{id}-{ts}  → regular order payment confirmation
   */
  public static async handleWebhookEvent(event: any): Promise<void> {
    if (event.event === 'charge.success') {
      const reference: string = event.data?.reference ?? '';

      // Pre-order deposit confirmation (PRE- prefix)
      if (reference.startsWith('PRE-')) {
        const { PreOrderService } = await import('./preorder.service');
        await PreOrderService.confirmDeposit(reference);
        return;
      }

      // Regular order payment confirmation (AGC- prefix)
      const orderId = event.data?.metadata?.orderId;
      if (orderId) {
        const order = await prisma.order.findUnique({ where: { id: orderId } });
        if (order && order.status === OrderStatus.PENDING) {
          await OrderService.confirmOrder(orderId);
        }
      }
    }
  }

  /**
   * Manually verifies a payment status against Paystack's transaction reference.
   */
  public static async verifyTransactionManually(orderId: string, requestingUserId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw createError('Order not found', 'ORDER_NOT_FOUND', 404);
    }

    if (order.buyerId !== requestingUserId) {
      throw createError(
        'Access forbidden: you are not the owner of this order',
        'FORBIDDEN_PAYMENT_VERIFY',
        403
      );
    }

    const reference = order.paystackReference;
    if (!reference) {
      throw createError('No payment reference exists for this order', 'MISSING_REFERENCE', 400);
    }

    // Development mock verify
    if (
      !config.PAYSTACK_SECRET_KEY ||
      config.PAYSTACK_SECRET_KEY === 'your_paystack_secret_key' ||
      config.PAYSTACK_SECRET_KEY.includes('mock')
    ) {
      if (order.status === OrderStatus.PENDING) {
        await OrderService.confirmOrder(orderId);
      }
      return { verified: true, status: 'success' };
    }

    try {
      const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${config.PAYSTACK_SECRET_KEY}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Paystack verify returned ${response.status}: ${errorText}`);
      }

      const body = await response.json();
      const status = body.data?.status;

      if (status === 'success') {
        if (order.status === OrderStatus.PENDING) {
          await OrderService.confirmOrder(orderId);
        }
        return { verified: true, status };
      }

      return { verified: false, status };
    } catch (error: any) {
      console.error('Paystack transaction verification failure:', error.message);
      throw createError(
        `Failed to verify payment with gateway: ${error.message}`,
        'PAYMENT_VERIFY_ERROR',
        500
      );
    }
  }
}
