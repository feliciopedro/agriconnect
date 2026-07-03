import { Request, Response } from 'express';
import { SuperAdminContentService } from '../../services/superadmin/content.service';
import { QualityGrade } from '../../prisma/generated-client';
import { createError } from '../../utils/errors';

export class SuperAdminContentController {
  public static async getAllListings(req: Request, res: Response) {
    const {
      cropType,
      status,
      qualityGrade,
      farmerId,
      region,
      spoilageRisk,
      createdAfter,
      createdBefore,
      limit,
      page,
      sortBy,
      sortOrder,
    } = req.query;

    const filters = {
      cropType: cropType as string,
      status: status as string,
      qualityGrade: qualityGrade as string,
      farmerId: farmerId as string,
      region: region as string,
      spoilageRisk: (spoilageRisk === 'high' || spoilageRisk === 'critical') ? spoilageRisk as 'high' | 'critical' : undefined,
      createdAfter: createdAfter as string,
      createdBefore: createdBefore as string,
    };

    const pagination = {
      limit: limit ? parseInt(limit as string) : 20,
      page: page ? parseInt(page as string) : 1,
      sortBy: sortBy as string,
      sortOrder: sortOrder as string,
    };

    const result = await SuperAdminContentService.getAllListings(filters, pagination);
    res.json(result);
  }

  public static async getListingDetail(req: Request, res: Response) {
    const { id } = req.params;
    const detail = await SuperAdminContentService.getListingDetail(id);
    res.json(detail);
  }

  public static async removeListing(req: Request, res: Response) {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason || typeof reason !== 'string' || reason.trim() === '') {
      throw createError('Reason for removal is required', 'BAD_REQUEST', 400);
    }
    const result = await SuperAdminContentService.removeListing(req.user!.userId, id, reason);
    res.json({ message: 'Listing removed successfully', listing: result });
  }

  public static async overrideListingQuality(req: Request, res: Response) {
    const { id } = req.params;
    const { grade, reason } = req.body;

    if (!grade || !Object.values(QualityGrade).includes(grade)) {
      throw createError('Valid quality grade is required', 'BAD_REQUEST', 400);
    }
    if (!reason || typeof reason !== 'string' || reason.trim() === '') {
      throw createError('Reason for override is required', 'BAD_REQUEST', 400);
    }

    const result = await SuperAdminContentService.overrideListingQuality(
      req.user!.userId,
      id,
      grade as QualityGrade,
      reason
    );
    res.json({ message: 'Listing quality overridden successfully', listing: result });
  }

  public static async getAllOrders(req: Request, res: Response) {
    const {
      status,
      paymentStatus,
      buyerId,
      farmerId,
      region,
      minValue,
      maxValue,
      createdAfter,
      createdBefore,
      limit,
      page,
      sortBy,
      sortOrder,
    } = req.query;

    const filters = {
      status: status as string,
      paymentStatus: paymentStatus as string,
      buyerId: buyerId as string,
      farmerId: farmerId as string,
      region: region as string,
      minValue: minValue ? parseFloat(minValue as string) : undefined,
      maxValue: maxValue ? parseFloat(maxValue as string) : undefined,
      createdAfter: createdAfter as string,
      createdBefore: createdBefore as string,
    };

    const pagination = {
      limit: limit ? parseInt(limit as string) : 20,
      page: page ? parseInt(page as string) : 1,
      sortBy: sortBy as string,
      sortOrder: sortOrder as string,
    };

    const result = await SuperAdminContentService.getAllOrders(filters, pagination);
    res.json(result);
  }

  public static async getOrderDetail(req: Request, res: Response) {
    const { id } = req.params;
    const detail = await SuperAdminContentService.getOrderDetail(id);
    res.json(detail);
  }

  public static async cancelOrderAdmin(req: Request, res: Response) {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || typeof reason !== 'string' || reason.trim() === '') {
      throw createError('Reason for cancellation is required', 'BAD_REQUEST', 400);
    }

    const result = await SuperAdminContentService.cancelOrderAdmin(req.user!.userId, id, reason);
    res.json({ message: 'Order force-cancelled successfully', order: result });
  }
}
