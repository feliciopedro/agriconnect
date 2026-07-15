import { Router } from 'express';
import { SpoilageJobService } from '../services/flashsale/spoilageJob.service';
import { authenticateToken, requireRole, requireSuperAdmin } from '../middleware/auth.middleware';
import { Role } from '../prisma/generated-client';

const router = Router();

// Authenticate all requests
router.use(authenticateToken);

/**
 * POST /api/jobs/risk-scoring
 * Manually trigger the risk assessment job.
 */
router.post('/risk-scoring', requireRole(Role.ADMIN, Role.SUPERADMIN), async (req, res) => {
  const result = await SpoilageJobService.runRiskScoringJob();
  res.status(200).json(result);
});

/**
 * POST /api/jobs/expiry
 * Manually trigger the expiry cleaner job.
 */
router.post('/expiry', requireRole(Role.ADMIN, Role.SUPERADMIN), async (req, res) => {
  const result = await SpoilageJobService.runExpiryJob();
  res.status(200).json(result);
});

/**
 * GET /api/jobs/risk-scoring/status
 * Retrieve system-wide risk telemetry and status metrics.
 */
router.get('/risk-scoring/status', requireSuperAdmin(), async (req, res) => {
  const result = await SpoilageJobService.getRiskScoringStatus();
  res.status(200).json(result);
});

export default router;
