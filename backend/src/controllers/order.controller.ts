import { Request, Response } from 'express';
import { OrderService, OrderFilters } from '../services/order.service';
import { OrderStatus } from '../prisma/generated-client';

export class OrderController {
  /**
   * Post new purchase order.
   */
  public static async createOrder(req: Request, res: Response): Promise<void> {
    const buyerId = req.user!.userId;
    const { listingId, quantityKg } = req.body;

    const order = await OrderService.createOrder(buyerId, listingId, quantityKg);
    res.status(201).json(order);
  }

  /**
   * Fetch paginated user orders scoped by role.
   */
  public static async getOrders(req: Request, res: Response): Promise<void> {
    const { userId, role } = req.user!;
    const { status, page, limit } = req.query;

    const filters: OrderFilters = {
      ...(status && { status: status as OrderStatus }),
      ...(page && { page: parseInt(page as string, 10) }),
      ...(limit && { limit: parseInt(limit as string, 10) }),
    };

    const result = await OrderService.getOrdersForUser(userId, role, filters);
    res.status(200).json(result);
  }

  /**
   * Fetch single order details with ownership verification.
   */
  public static async getOrderById(req: Request, res: Response): Promise<void> {
    const requestingUserId = req.user!.userId;
    const order = await OrderService.getOrderById(req.params.id, requestingUserId);
    res.status(200).json(order);
  }

  /**
   * Cancel pending buyer order and restore inventory weights.
   */
  public static async cancelOrder(req: Request, res: Response): Promise<void> {
    const requestingUserId = req.user!.userId;
    const result = await OrderService.cancelOrder(req.params.id, requestingUserId);
    res.status(200).json(result);
  }
}
