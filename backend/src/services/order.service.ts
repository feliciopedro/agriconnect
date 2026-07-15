import prisma from '../prisma/client';
import { createError } from '../utils/errors';
import { DeliveryService } from './delivery.service';
import { NotificationService } from './notification.service';
import {
  Role,
  OrderStatus,
  PaymentStatus,
  ListingStatus,
  TraceEventType,
  Prisma
} from '../prisma/generated-client';
import { AuditLogService } from './audit.service';

export interface OrderFilters {
  status?: OrderStatus;
  page?: number;
  limit?: number;
}

export class OrderService {
  /**
   * Create an order in a transaction. Validates stock availability,
   * decrements inventory, generates trace events, and alerts the farmer.
   */
  public static async createOrder(buyerId: string, listingId: string, quantityKg: number, source?: any) {
    const createdOrder = await prisma.$transaction(async (tx) => {
      // 1. Fetch listing and check availability
      const listing = await tx.produceListing.findUnique({
        where: { id: listingId },
      });

      if (!listing) {
        throw createError('Produce listing not found', 'LISTING_NOT_FOUND', 404);
      }

      if (listing.status !== ListingStatus.AVAILABLE) {
        throw createError('Listing is no longer available for orders', 'LISTING_UNAVAILABLE', 400);
      }

      // 2. Decrement listing stock atomically (bypass if source is FLASH_SALE)
      let updatedListing;
      if (source === 'FLASH_SALE') {
        updatedListing = await tx.produceListing.findUnique({
          where: { id: listingId },
        });
        if (!updatedListing) {
          throw createError('Produce listing not found', 'LISTING_NOT_FOUND', 404);
        }
      } else {
        updatedListing = await tx.produceListing.update({
          where: { id: listingId },
          data: {
            remainingKg: { decrement: quantityKg },
          },
        });
      }

      // 3. Assert stock sufficiency (roll back if negative result)
      if (updatedListing.remainingKg < 0) {
        throw createError(
          `Insufficient stock. Requested: ${quantityKg}kg, Available: ${updatedListing.remainingKg + quantityKg}kg.`,
          'INSUFFICIENT_STOCK',
          400
        );
      }

      // 4. Update status to SOLD_OUT if inventory hits 0
      const newRemaining = parseFloat(updatedListing.remainingKg.toFixed(2));
      if (newRemaining <= 0) {
        await tx.produceListing.update({
          where: { id: listingId },
          data: {
            status: ListingStatus.SOLD_OUT,
          },
        });
      }

      // 5. Create Order
      let price = listing.pricePerKg;
      if (source === 'FLASH_SALE') {
        const flashSale = await (tx as any).flashSale.findFirst({
          where: {
            listingId: listingId,
            status: { in: ['ACTIVE', 'SOLD'] }
          }
        });
        if (flashSale) {
          price = flashSale.flashPricePerKg;
        }
      }
      const totalPrice = parseFloat((quantityKg * price).toFixed(2));
      const order = await tx.order.create({
        data: {
          buyerId,
          listingId,
          quantityKg,
          totalPrice,
          status: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.UNPAID,
          source: source || 'WEB',
        },
        include: {
          listing: {
            include: {
              farmer: true,
            },
          },
          buyer: true,
        },
      });

      // 5. Append RESERVED trace event log
      await tx.traceEvent.create({
        data: {
          listingId,
          eventType: TraceEventType.RESERVED,
          latitude: listing.latitude,
          longitude: listing.longitude,
          recordedByUserId: buyerId,
          notes: `Order placed. ${quantityKg}kg reserved for buyer.`,
        },
      });

      // 6. Push Farmer Notification
      await NotificationService.createNotification(
        listing.farmerId,
        'NEW_ORDER',
        `New order: ${quantityKg}kg of ${listing.cropType} from a buyer`,
        false,
        tx
      );

      // Audit Log mutation
      await AuditLogService.log(
        {
          userId: buyerId,
          actorRole: Role.BUYER,
          action: 'CREATE',
          entityName: 'Order',
          entityId: order.id,
          newValues: {
            buyerId: order.buyerId,
            listingId: order.listingId,
            quantityKg: order.quantityKg,
            totalPrice: order.totalPrice,
            status: order.status,
            paymentStatus: order.paymentStatus,
          },
        },
        tx
      );

      return order;
    });

    try {
      const farmerPhone = createdOrder.listing?.farmer?.phone;
      const buyerPhone = createdOrder.buyer?.phone;

      if (farmerPhone || buyerPhone) {
        const { SmsOutboundService } = require('./ussd/smsOutbound.service');
        const farmerName = createdOrder.listing?.farmer?.name || 'Farmer';

        // 1. Send order_received_farmer to farmer
        if (farmerPhone) {
          await SmsOutboundService.sendSms(farmerPhone, 'order_received_farmer', {
            qty: createdOrder.quantityKg,
            crop: createdOrder.listing?.cropType || 'Produce',
            price: createdOrder.listing?.pricePerKg || 0,
            total: createdOrder.totalPrice
          });
        }

        // 2. Send order_placed_buyer to buyer
        if (buyerPhone) {
          await SmsOutboundService.sendSms(buyerPhone, 'order_placed_buyer', {
            qty: createdOrder.quantityKg,
            crop: createdOrder.listing?.cropType || 'Produce',
            farmer: farmerName,
            orderId: createdOrder.id.slice(0, 8),
            total: createdOrder.totalPrice
          });
        }
      }
    } catch (smsErr) {
      console.error('Failed to dispatch order SMS alerts:', smsErr);
    }

    return createdOrder;
  }

  /**
   * Queries orders scoped by user role.
   */
  public static async getOrdersForUser(userId: string, role: Role, filters: OrderFilters) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;

    const whereClause: Prisma.OrderWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(role === Role.FARMER
        ? { listing: { farmerId: userId } }
        : { buyerId: userId }),
    };

    const [data, total] = await Promise.all([
      prisma.order.findMany({
        where: whereClause,
        include: {
          listing: {
            select: {
              cropType: true,
              batchCode: true,
              farmer: {
                select: {
                  name: true,
                },
              },
            },
          },
          buyer: {
            select: {
              name: true,
            },
          },
          deliveryRequest: {
            select: {
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.order.count({ where: whereClause }),
    ]);

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Fetch single order and enforce access checks.
   */
  public static async getOrderById(id: string, requestingUserId: string) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        listing: {
          include: {
            farmer: {
              select: {
                id: true,
                name: true,
                phone: true,
              },
            },
          },
        },
        buyer: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        deliveryRequest: true,
      },
    });

    if (!order) {
      throw createError('Order not found', 'ORDER_NOT_FOUND', 404);
    }

    // Access control: only buyer or farmer can view details
    if (order.buyerId !== requestingUserId && order.listing.farmerId !== requestingUserId) {
      throw createError('Access forbidden: view permissions required', 'FORBIDDEN_ORDER_ACCESS', 403);
    }

    return order;
  }

  /**
   * Cancel a pending order, refund listing inventory stock, delete RESERVED trace, and notify farmer.
   */
  public static async cancelOrder(orderId: string, requestingUserId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        listing: true,
      },
    });

    if (!order) {
      throw createError('Order not found', 'ORDER_NOT_FOUND', 404);
    }

    // Enforce ownership: only buyer can cancel
    if (order.buyerId !== requestingUserId) {
      throw createError('Access forbidden: cancellation permissions required', 'FORBIDDEN_CANCELLATION', 403);
    }

    if (order.status !== OrderStatus.PENDING) {
      throw createError('Only PENDING orders can be cancelled', 'INVALID_CANCELLATION_STATE', 400);
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Update order status
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
        },
      });

      // 2. Restore inventory
      const restoredRemaining = parseFloat((order.listing.remainingKg + order.quantityKg).toFixed(2));
      
      await tx.produceListing.update({
        where: { id: order.listingId },
        data: {
          remainingKg: restoredRemaining,
          status: ListingStatus.AVAILABLE, // revert status to AVAILABLE
        },
      });

      // 3. Remove reservation trace event to clean audit timeline
      await tx.traceEvent.deleteMany({
        where: {
          listingId: order.listingId,
          eventType: TraceEventType.RESERVED,
          recordedByUserId: requestingUserId,
        },
      });

      // 4. Notify farmer
      await NotificationService.createNotification(
        order.listing.farmerId,
        'ORDER_CANCELLED',
        `An order for your ${order.listing.cropType} was cancelled`,
        false,
        tx
      );

      // Audit Log mutation
      await AuditLogService.log(
        {
          userId: requestingUserId,
          actorRole: Role.BUYER,
          action: 'CANCEL',
          entityName: 'Order',
          entityId: orderId,
          oldValues: {
            status: order.status,
          },
          newValues: {
            status: OrderStatus.CANCELLED,
          },
        },
        tx
      );

      return updatedOrder;
    });
  }

  /**
   * Confirms payment for order, updates status, registers delivery logistics, and alerts the farmer.
   */
  public static async confirmOrder(orderId: string) {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          listing: true,
        },
      });

      if (!order) {
        throw createError('Order not found', 'ORDER_NOT_FOUND', 404);
      }

      // 1. Update order payment statuses
      const confirmedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CONFIRMED,
          paymentStatus: PaymentStatus.PAID,
        },
      });

      // 2. Generate delivery requests
      await DeliveryService.createDeliveryRequest(orderId);

      // 3. Send Notification to Farmer
      await NotificationService.createNotification(
        order.listing.farmerId,
        'ORDER_CONFIRMED',
        `Payment confirmed. Your ${order.listing.cropType} has been sold.`,
        true, // high-priority, send SMS!
        tx
      );

      // Audit Log mutation
      await AuditLogService.log(
        {
          userId: order.buyerId, // System / Webhook trigger
          actorRole: Role.BUYER,
          action: 'CONFIRM',
          entityName: 'Order',
          entityId: orderId,
          oldValues: {
            status: order.status,
            paymentStatus: order.paymentStatus,
          },
          newValues: {
            status: OrderStatus.CONFIRMED,
            paymentStatus: PaymentStatus.PAID,
          },
        },
        tx
      );

      return confirmedOrder;
    });
  }
}
