import { Request, Response } from 'express';
import { MessageService } from '../services/message.service';
import { createError } from '../utils/errors';

export class MessageController {
  /**
   * Dispatches an in-app chat message between users.
   */
  public static async sendMessage(req: Request, res: Response): Promise<void> {
    const fromUserId = req.user!.userId;
    const { toUserId, content, orderId } = req.body;

    if (!toUserId || !content) {
      throw createError('Missing required body parameters: toUserId, content', 'MISSING_PARAMETERS', 400);
    }

    const result = await MessageService.sendMessage(
      fromUserId,
      toUserId,
      content,
      orderId
    );

    res.status(201).json(result);
  }

  /**
   * Retrieves conversation listings showing last messages and counts of unread items.
   */
  public static async getConversationsList(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const result = await MessageService.getConversationsList(userId);
    res.status(200).json(result);
  }

  /**
   * Fetches specific chat threads between users.
   */
  public static async getConversation(req: Request, res: Response): Promise<void> {
    const userId1 = req.user!.userId;
    const userId2 = req.params.otherUserId;
    
    const page = req.query.page ? parseInt(req.query.page as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

    const result = await MessageService.getConversation(userId1, userId2, {
      page,
      limit,
    });

    res.status(200).json(result);
  }
}
