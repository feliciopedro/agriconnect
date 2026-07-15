import { Router } from 'express';
import prisma from '../prisma/client';
import { AdminController } from '../controllers/admin.controller';
import { DeliveryController } from '../controllers/delivery.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { Role } from '../prisma/generated-client';
import { validate } from '../middleware/validate.middleware';
import { ListingIdParamSchema } from '../types/listing.schema';
import { BatchCodeParamSchema } from '../types/trace.schema';
import { z } from 'zod';

const router = Router();

const UserIdParamSchema = z.object({
  id: z.string().uuid('Invalid user identifier. Must be a valid UUID.'),
});

// Apply admin access control guards globally to this router
router.use(authenticateToken);

// Flash Sale Stats (accessible to Admin & SuperAdmin)
router.get('/flash-sales/stats', requireRole(Role.ADMIN, Role.SUPERADMIN), async (req, res) => {
  const totalFlashSales = await (prisma as any).flashSale.count();

  const active = await (prisma as any).flashSale.count({ where: { status: 'ACTIVE' } });
  const sold = await (prisma as any).flashSale.count({ where: { status: 'SOLD' } });
  const expired = await (prisma as any).flashSale.count({ where: { status: 'EXPIRED' } });
  const cancelled = await (prisma as any).flashSale.count({ where: { status: 'CANCELLED' } });

  const soldSales = await (prisma as any).flashSale.findMany({
    where: { status: 'SOLD' },
    select: { soldKg: true, flashPricePerKg: true },
  });

  let totalKgSaved = 0;
  let totalValueSaved = 0;
  for (const fs of soldSales) {
    totalKgSaved += fs.soldKg;
    totalValueSaved += fs.soldKg * fs.flashPricePerKg;
  }

  const discounts = await (prisma as any).flashSale.aggregate({
    _avg: {
      discountPercent: true,
    },
  });
  const avgDiscountPercent = discounts._avg.discountPercent ? parseFloat(discounts._avg.discountPercent.toFixed(1)) : 0;

  const allSales = await (prisma as any).flashSale.findMany({
    select: { soldKg: true, quantityKg: true },
  });

  let totalSoldPercent = 0;
  for (const fs of allSales) {
    if (fs.quantityKg > 0) {
      totalSoldPercent += (fs.soldKg / fs.quantityKg) * 100;
    }
  }
  const avgSoldPercent = allSales.length > 0 ? parseFloat((totalSoldPercent / allSales.length).toFixed(1)) : 0;

  const totalNotifications = await (prisma as any).flashSale.aggregate({
    _sum: {
      notificationsSent: true,
    },
  });
  const notificationsSent = totalNotifications._sum.notificationsSent || 0;

  const totalClaims = await prisma.flashSaleClaim.count();
  const conversionRate = notificationsSent > 0 ? parseFloat((totalClaims / notificationsSent).toFixed(3)) : 0;

  const riskLogs = await (prisma as any).spoilageRiskLog.findMany({
    include: {
      listing: { select: { cropType: true } },
    },
  });
  const cropCounts: Record<string, number> = {};
  for (const log of riskLogs) {
    const crop = log.listing.cropType;
    cropCounts[crop] = (cropCounts[crop] || 0) + 1;
  }
  const topCropBySpoilage = Object.entries(cropCounts).map(([cropType, count]) => ({
    cropType,
    count,
  })).sort((a, b) => b.count - a.count);

  const salesTimes = await (prisma as any).flashSale.findMany({
    select: { createdAt: true },
  });
  const hourCounts: Record<number, number> = {};
  for (const fs of salesTimes) {
    const hour = new Date(fs.createdAt).getUTCHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  }
  const flashSalesByHour = Object.entries(hourCounts).map(([hour, count]) => ({
    hour: parseInt(hour),
    count,
  })).sort((a, b) => a.hour - b.hour);

  res.status(200).json({
    totalFlashSales,
    byStatus: { active, sold, expired, cancelled },
    totalKgSaved,
    totalValueSaved: parseFloat(totalValueSaved.toFixed(2)),
    avgDiscountPercent,
    avgSoldPercent,
    notificationsSent,
    conversionRate,
    topCropBySpoilage,
    flashSalesByHour,
  });
});

router.use(requireRole(Role.ADMIN));

// Platform metrics & administration lookups
router.get('/stats', AdminController.getStats);
router.get('/users', AdminController.getUsers);
router.patch('/users/:id/verify', validate(UserIdParamSchema, 'params'), AdminController.verifyUser);
router.get('/trace/:batchCode', validate(BatchCodeParamSchema, 'params'), AdminController.getTrace);
router.delete('/listings/:id', validate(ListingIdParamSchema, 'params'), AdminController.deleteListing);
router.get('/audit-logs', AdminController.getAuditLogs);

// Manual delivery grouping trigger
router.post('/delivery-requests/group', DeliveryController.triggerManualGrouping);

export default router;
