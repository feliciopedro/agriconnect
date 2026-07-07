import prisma from '../prisma/client';
import { createError } from '../utils/errors';
import { config } from '../config';
import { OrderStatus, PaymentStatus, PreOrderStatus } from '../prisma/generated-client';
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

  /**
   * Initiates a Mobile Money withdrawal payout for a user.
   */
  public static async initiateWithdrawal(userId: string, phone: string, amount: number) {
    console.log(`[MoMo Withdrawal] Initiated for User ${userId} to phone ${phone} amount GHS ${amount}`);
    // Simulate API call to Mobile Money Provider/Paystack Payouts
    return {
      success: true,
      reference: `WD-${userId.slice(0, 8)}-${Date.now()}`,
      amount,
      phone,
    };
  }

  /**
   * Triggers a Paystack Mobile Money Ghana charge (without redirect/inline).
   * For USSD flow.
   */
  public static async chargeMoMoGhana(orderId: string, phone: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: { select: { phone: true, name: true } },
      },
    });

    if (!order) {
      throw createError('Order not found', 'ORDER_NOT_FOUND', 404);
    }

    if (order.paymentStatus === PaymentStatus.PAID) {
      throw createError('Order is already paid', 'ALREADY_PAID', 400);
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw createError('Order is cancelled', 'ORDER_CANCELLED', 400);
    }

    const timestamp = Date.now();
    const reference = `AGC-${orderId}-${timestamp}`;

    if (
      !config.PAYSTACK_SECRET_KEY ||
      config.PAYSTACK_SECRET_KEY === 'your_paystack_secret_key' ||
      config.PAYSTACK_SECRET_KEY.includes('mock')
    ) {
      console.log(`[DEV] Mock MoMo Ghana charge for order ${orderId}: GHS ${order.totalPrice} (phone: ${phone}, ref: ${reference})`);
      // Update order with reference
      await prisma.order.update({
        where: { id: orderId },
        data: { paystackReference: reference },
      });
      // Fire-and-forget confirm order after a brief delay to simulate Paystack webhook
      setTimeout(async () => {
        try {
          await PaymentService.handleWebhookEvent({
            event: 'charge.success',
            data: {
              reference,
              metadata: { orderId }
            }
          });
        } catch (e) {
          console.error('[DEV] Mock MoMo charge webhook simulation failed:', e);
        }
      }, 2000);

      return { success: true, reference };
    }

    // Call Paystack direct Charge endpoint
    try {
      const email = `${order.buyer.phone.replace('+', '')}@agriconnect.gh`;

      // Paystack expects MTN, Vodafone, or AirtelTigo providers. Let's detect.
      let cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.startsWith('233')) {
        cleanPhone = '0' + cleanPhone.slice(3);
      }
      if (!cleanPhone.startsWith('0')) {
        cleanPhone = '0' + cleanPhone;
      }
      const prefix = cleanPhone.substring(0, 3);
      let provider = 'mtn';
      if (['020', '050'].includes(prefix)) provider = 'vod';
      else if (['026', '056', '027', '057'].includes(prefix)) provider = 'tgo';

      const response = await fetch('https://api.paystack.co/charge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.PAYSTACK_SECRET_KEY}`,
        },
        body: JSON.stringify({
          amount: Math.round(order.totalPrice * 100), // convert to pesewas
          email,
          currency: 'GHS',
          mobile_money: {
            phone: cleanPhone.substring(0, 10),
            provider,
          },
          reference,
          metadata: { orderId, buyerId: order.buyerId },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Paystack MoMo charge returned ${response.status}: ${errorText}`);
      }

      // Store the reference on the Order
      await prisma.order.update({
        where: { id: orderId },
        data: { paystackReference: reference },
      });

      const body = await response.json();
      return {
        success: body.status === true,
        reference,
        paystackStatus: body.data?.status
      };
    } catch (error: any) {
      console.error('Paystack MoMo charge failure:', error.message);
      throw createError(
        `Failed to charge Mobile Money: ${error.message}`,
        'MOMO_CHARGE_ERROR',
        500
      );
    }
  }

  /**
   * Triggers a Paystack Mobile Money Ghana charge for a PreOrder deposit.
   * For USSD flow.
   */
  public static async chargePreOrderDepositMoMo(preOrderId: string, phone: string) {
    const preOrder = await prisma.preOrder.findUnique({
      where: { id: preOrderId },
      include: {
        buyer: { select: { phone: true, name: true } },
      },
    });

    if (!preOrder) {
      throw createError('Pre-order not found', 'PREORDER_NOT_FOUND', 404);
    }

    if (preOrder.status !== PreOrderStatus.DEPOSIT_PENDING) {
      throw createError('Deposit is already paid or pre-order is not pending deposit', 'ALREADY_PROCESSED', 400);
    }

    const timestamp = Date.now();
    const reference = `PRE-${preOrderId}-${timestamp}`;

    if (
      !config.PAYSTACK_SECRET_KEY ||
      config.PAYSTACK_SECRET_KEY === 'your_paystack_secret_key' ||
      config.PAYSTACK_SECRET_KEY.includes('mock')
    ) {
      console.log(`[DEV] Mock MoMo deposit charge for pre-order ${preOrderId}: GHS ${preOrder.depositAmount} (phone: ${phone}, ref: ${reference})`);
      // Update pre-order with reference
      await prisma.preOrder.update({
        where: { id: preOrderId },
        data: { paystackReference: reference },
      });
      // Fire-and-forget confirm deposit after a brief delay to simulate Paystack webhook
      setTimeout(async () => {
        try {
          await PaymentService.handleWebhookEvent({
            event: 'charge.success',
            data: {
              reference,
              metadata: { preOrderId }
            }
          });
        } catch (e) {
          console.error('[DEV] Mock MoMo deposit webhook simulation failed:', e);
        }
      }, 2000);

      return { success: true, reference };
    }

    // Call Paystack direct Charge endpoint
    try {
      const email = `${preOrder.buyer.phone.replace('+', '')}@agriconnect.gh`;

      // Paystack expects MTN, Vodafone, or AirtelTigo providers. Let's detect.
      let cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.startsWith('233')) {
        cleanPhone = '0' + cleanPhone.slice(3);
      }
      if (!cleanPhone.startsWith('0')) {
        cleanPhone = '0' + cleanPhone;
      }
      const prefix = cleanPhone.substring(0, 3);
      let provider = 'mtn';
      if (['020', '050'].includes(prefix)) provider = 'vod';
      else if (['026', '056', '027', '057'].includes(prefix)) provider = 'tgo';

      const response = await fetch('https://api.paystack.co/charge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.PAYSTACK_SECRET_KEY}`,
        },
        body: JSON.stringify({
          amount: Math.round(preOrder.depositAmount * 100), // convert to pesewas
          email,
          currency: 'GHS',
          mobile_money: {
            phone: cleanPhone.substring(0, 10),
            provider,
          },
          reference,
          metadata: { preOrderId, buyerId: preOrder.buyerId, type: 'PRE_ORDER_DEPOSIT' },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Paystack MoMo charge returned ${response.status}: ${errorText}`);
      }

      // Store the reference on the PreOrder
      await prisma.preOrder.update({
        where: { id: preOrderId },
        data: { paystackReference: reference },
      });

      const body = await response.json();
      return {
        success: body.status === true,
        reference,
        paystackStatus: body.data?.status
      };
    } catch (error: any) {
      console.error('Paystack MoMo pre-order deposit charge failure:', error.message);
      throw createError(
        `Failed to charge Mobile Money: ${error.message}`,
        'MOMO_CHARGE_ERROR',
        500
      );
    }
  }
}
