import prisma from '../prisma/client';
import { createError } from '../utils/errors';
import { NotificationService } from './notification.service';

export class MessageService {
  /**
   * Dispatches a unified text message. Asserts order participant authorization if orderId is specified.
   */
  public static async sendMessage(
    fromUserId: string,
    toUserId: string,
    content: string,
    orderId?: string
  ) {
    // 1. Assert users exist
    const [fromUser, toUser] = await Promise.all([
      prisma.user.findUnique({ where: { id: fromUserId } }),
      prisma.user.findUnique({ where: { id: toUserId } }),
    ]);

    if (!fromUser || !toUser) {
      throw createError('Sender or recipient user not found', 'USER_NOT_FOUND', 404);
    }

    // 2. Validate order parties if orderId is provided
    if (orderId) {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          listing: true,
          deliveryRequest: true,
        },
      });

      if (!order) {
        throw createError('Linked order details not found', 'ORDER_NOT_FOUND', 404);
      }

      const isBuyer = order.buyerId === fromUserId;
      const isFarmer = order.listing.farmerId === fromUserId;
      const isTransporter = order.deliveryRequest?.transportProviderId === fromUserId;

      if (!isBuyer && !isFarmer && !isTransporter) {
        throw createError(
          'Access forbidden: you are not an authorized party to this order',
          'FORBIDDEN_ORDER_PARTY',
          403
        );
      }
    }

    // 3. Create Message row
    const message = await prisma.message.create({
      data: {
        fromUserId,
        toUserId,
        content,
        orderId: orderId || null,
        isRead: false,
      },
    });

    // 4. Send recipient notification (in-app only)
    await NotificationService.createNotification(
      toUserId,
      'NEW_MESSAGE',
      `New message from ${fromUser.name}`,
      false
    );

    return message;
  }

  /**
   * Retrieves conversation thread between two users in chronological order.
   * Marks unread incoming messages as read.
   */
  public static async getConversation(
    userId1: string,
    userId2: string,
    pagination: { page?: number; limit?: number }
  ) {
    const page = Math.max(1, pagination.page || 1);
    const limit = Math.min(100, Math.max(1, pagination.limit || 50));
    const skip = (page - 1) * limit;

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { fromUserId: userId1, toUserId: userId2 },
          { fromUserId: userId2, toUserId: userId1 },
        ],
      },
      orderBy: { createdAt: 'asc' },
      skip,
      take: limit,
      include: {
        fromUser: { select: { id: true, name: true, role: true } },
        toUser: { select: { id: true, name: true, role: true } },
      },
    });

    // Mark incoming messages as read (FROM userId2 TO userId1)
    await prisma.message.updateMany({
      where: {
        fromUserId: userId2,
        toUserId: userId1,
        isRead: false,
      },
      data: { isRead: true },
    });

    return messages;
  }

  /**
   * Aggregates a listing of all active conversations, showing last messages and unread counts.
   */
  public static async getConversationsList(userId: string) {
    const messages = await prisma.message.findMany({
      where: {
        OR: [{ fromUserId: userId }, { toUserId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        fromUser: { select: { id: true, name: true, role: true } },
        toUser: { select: { id: true, name: true, role: true } },
      },
    });

    const conversationsMap = new Map<
      string,
      {
        otherUser: { id: string; name: string; role: any };
        lastMessageContent: string;
        lastMessageTimestamp: Date;
        unreadCount: number;
      }
    >();

    for (const msg of messages) {
      const otherUser = msg.fromUserId === userId ? msg.toUser : msg.fromUser;
      const otherUserId = otherUser.id;

      const isIncoming = msg.fromUserId === otherUserId;
      const unreadDelta = isIncoming && !msg.isRead ? 1 : 0;

      if (!conversationsMap.has(otherUserId)) {
        conversationsMap.set(otherUserId, {
          otherUser: {
            id: otherUser.id,
            name: otherUser.name,
            role: otherUser.role,
          },
          lastMessageContent: msg.content,
          lastMessageTimestamp: msg.createdAt,
          unreadCount: unreadDelta,
        });
      } else {
        const existing = conversationsMap.get(otherUserId)!;
        existing.unreadCount += unreadDelta;
      }
    }

    return Array.from(conversationsMap.values()).sort(
      (a, b) => b.lastMessageTimestamp.getTime() - a.lastMessageTimestamp.getTime()
    );
  }
}
