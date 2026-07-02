import { Router } from 'express';
import { FarmController } from '../controllers/farm.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { Role } from '../prisma/generated-client';
import {
  CreatePlantingLogSchema,
  AddInputSchema,
  HarvestLogSchema,
  PredictYieldQuerySchema,
  FarmLogIdParamSchema,
} from '../types/farm.schema';

const router = Router();

// Force authentication and FARMER checks globally for all farm routes
router.use(authenticateToken);
router.use(requireRole(Role.FARMER));

router.post('/', validate(CreatePlantingLogSchema), FarmController.createLog);
router.get('/', FarmController.getMyLogs);
router.get('/predict-yield', validate(PredictYieldQuerySchema, 'query'), FarmController.getYieldPrediction);

router.get('/:id', validate(FarmLogIdParamSchema, 'params'), FarmController.getLogById);
router.post('/:id/inputs', validate(FarmLogIdParamSchema, 'params'), validate(AddInputSchema), FarmController.addInput);
router.patch('/:id/harvest', validate(FarmLogIdParamSchema, 'params'), validate(HarvestLogSchema), FarmController.harvest);

export default router;
