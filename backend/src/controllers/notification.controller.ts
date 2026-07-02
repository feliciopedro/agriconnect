import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { createError } from '../utils/errors';

export class NotificationController {
  /**
   * Returns current user's notifications, paginated, with unreadCount in headers/top-level.
   */
  public static async getNotifications(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const page = Math.max(1, parseInt((req.query.page as string) || '1'));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20')));
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where: { userId } }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    res.status(200).json({
      unreadCount,
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }

  /**
   * Marks a single notification as read after verifying owner.
   */
  public static async markAsRead(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const { id } = req.params;

    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw createError('Notification not found', 'NOTIFICATION_NOT_FOUND', 404);
    }

    if (notification.userId !== userId) {
      throw createError(
        'Access forbidden: you do not own this notification',
        'FORBIDDEN_NOTIFICATION_ACCESS',
        403
      );
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    res.status(200).json(updated);
  }

  /**
   * Marks all user's notifications as read.
   */
  public static async markAllAsRead(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    res.status(200).json({ success: true });
  }
}
