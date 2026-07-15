import { Router } from 'express';
import prisma from '../prisma/client';
import { SuperAdminController } from '../controllers/superadmin.controller';
import { authenticateToken, requireSuperAdmin, auditAction } from '../middleware/auth.middleware';

const router = Router();

// Apply superadmin requirements globally to this router
router.use(authenticateToken);
router.use(requireSuperAdmin());

router.get('/status', auditAction('SUPERADMIN_STATUS_VIEW'), SuperAdminController.getStatus);
router.post('/users/:id/ban', auditAction('SUPERADMIN_USER_BAN_REQUEST'), SuperAdminController.banUser);
router.post('/users/:id/unban', auditAction('SUPERADMIN_USER_UNBAN_REQUEST'), SuperAdminController.unbanUser);
router.post('/configs', auditAction('SUPERADMIN_CONFIG_UPDATE'), SuperAdminController.updateConfig);
router.get('/audit-logs', auditAction('SUPERADMIN_AUDIT_LOG_VIEW'), SuperAdminController.getAuditLogs);

router.get('/flash-sales', auditAction('SUPERADMIN_FLASHSALES_VIEW'), async (req, res) => {
  const { status, cropType, farmerId, startDate, endDate } = req.query;

  const where: any = {};

  if (status) {
    where.status = status as any;
  }
  if (cropType) {
    where.listing = {
      cropType: cropType as any,
    };
  }
  if (farmerId) {
    where.farmerId = farmerId as string;
  }
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = new Date(startDate as string);
    }
    if (endDate) {
      where.createdAt.lte = new Date(endDate as string);
    }
  }

  const sales = await (prisma as any).flashSale.findMany({
    where,
    include: {
      listing: {
        include: {
          farmer: {
            select: { name: true, phone: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.status(200).json(sales);
});

export default router;
