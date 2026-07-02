import prisma from '../prisma/client';
import { createError } from '../utils/errors';
import { CropType, PlantingLog, PlantingInput, Prisma } from '../prisma/generated-client';

interface CreateLogData {
  cropType: CropType;
  acreage: number;
  plantingDate: string;
  expectedHarvestDate: string;
  notes?: string;
}

interface AddInputData {
  type: string;
  name: string;
  quantity?: number;
  unit?: string;
  appliedAt?: string;
}

export class FarmService {
  /**
   * Registers a new crop planting journal entry.
   */
  public static async createPlantingLog(farmerId: string, data: CreateLogData): Promise<PlantingLog> {
    const plantingDate = new Date(data.plantingDate);
    const expectedHarvestDate = new Date(data.expectedHarvestDate);

    if (expectedHarvestDate <= plantingDate) {
      throw createError('Expected harvest date must be after planting date', 'INVALID_DATES', 400);
    }

    return await prisma.plantingLog.create({
      data: {
        farmerId,
        cropType: data.cropType,
        acreage: data.acreage,
        plantingDate,
        expectedHarvestDate,
        notes: data.notes,
      },
    });
  }

  /**
   * Appends an input application record (fertilizer, pesticide, irrigation) to a planting log.
   */
  public static async addPlantingInput(
    farmerId: string,
    plantingLogId: string,
    data: AddInputData
  ): Promise<PlantingInput> {
    const log = await prisma.plantingLog.findUnique({ where: { id: plantingLogId } });

    if (!log) {
      throw createError('Planting log not found', 'LOG_NOT_FOUND', 404);
    }

    if (log.farmerId !== farmerId) {
      throw createError(
        'Access forbidden: you do not own this planting log',
        'FORBIDDEN_LOG_ACCESS',
        403
      );
    }

    if (log.actualHarvestDate) {
      throw createError(
        'Cannot add inputs to a planting log that is already harvested',
        'LOG_ALREADY_HARVESTED',
        400
      );
    }

    return await prisma.plantingInput.create({
      data: {
        plantingLogId,
        type: data.type,
        name: data.name,
        quantity: data.quantity ?? null,
        unit: data.unit ?? null,
        appliedAt: data.appliedAt ? new Date(data.appliedAt) : new Date(),
      },
    });
  }

  /**
   * Marks a planting log as harvested and records actual yield output.
   */
  public static async harvestPlantingLog(
    farmerId: string,
    plantingLogId: string,
    actualYieldKg: number,
    actualHarvestDate: string
  ): Promise<PlantingLog> {
    const log = await prisma.plantingLog.findUnique({ where: { id: plantingLogId } });

    if (!log) {
      throw createError('Planting log not found', 'LOG_NOT_FOUND', 404);
    }

    if (log.farmerId !== farmerId) {
      throw createError(
        'Access forbidden: you do not own this planting log',
        'FORBIDDEN_LOG_ACCESS',
        403
      );
    }

    if (log.actualHarvestDate) {
      throw createError('This planting log has already been harvested', 'ALREADY_HARVESTED', 400);
    }

    const harvestDate = new Date(actualHarvestDate);
    if (harvestDate < new Date(log.plantingDate)) {
      throw createError('Harvest date cannot be before planting date', 'INVALID_HARVEST_DATE', 400);
    }

    return await prisma.plantingLog.update({
      where: { id: plantingLogId },
      data: {
        actualYieldKg,
        actualHarvestDate: harvestDate,
      },
    });
  }

  /**
   * Retrieves a farmer's active and historical planting logs.
   */
  public static async getMyPlantingLogs(farmerId: string): Promise<PlantingLog[]> {
    return await prisma.plantingLog.findMany({
      where: { farmerId },
      include: {
        inputs: { orderBy: { appliedAt: 'desc' } },
        listings: { select: { id: true, batchCode: true, status: true } },
      },
      orderBy: { plantingDate: 'desc' },
    });
  }

  /**
   * Returns details of a specific planting log.
   */
  public static async getPlantingLogById(plantingLogId: string, farmerId: string): Promise<PlantingLog> {
    const log = await prisma.plantingLog.findUnique({
      where: { id: plantingLogId },
      include: {
        inputs: { orderBy: { appliedAt: 'desc' } },
        listings: true,
      },
    });

    if (!log) {
      throw createError('Planting log not found', 'LOG_NOT_FOUND', 404);
    }

    if (log.farmerId !== farmerId) {
      throw createError(
        'Access forbidden: you do not own this planting log',
        'FORBIDDEN_LOG_ACCESS',
        403
      );
    }

    return log;
  }

  /**
   * Yield prediction engine.
   * Resolves average yield per acre using: Farmer History -> Platform History -> Crop Default constants.
   */
  public static async predictYield(
    farmerId: string,
    cropType: CropType,
    acreage: number
  ): Promise<{ predictedYieldKg: number; basis: string; dataPointsCount: number }> {
    // 1. Check farmer's past harvested logs for this crop
    const farmerHarvests = await prisma.plantingLog.findMany({
      where: {
        farmerId,
        cropType,
        actualYieldKg: { not: null },
        acreage: { gt: 0 },
      },
    });

    if (farmerHarvests.length > 0) {
      const sumYieldPerAcre = farmerHarvests.reduce(
        (sum, h) => sum + (h.actualYieldKg || 0) / h.acreage,
        0
      );
      const avgYieldPerAcre = sumYieldPerAcre / farmerHarvests.length;
      return {
        predictedYieldKg: parseFloat((avgYieldPerAcre * acreage).toFixed(2)),
        basis: 'FARM_HISTORY',
        dataPointsCount: farmerHarvests.length,
      };
    }

    // 2. Fall back to platform-wide averages
    const platformHarvests = await prisma.plantingLog.findMany({
      where: {
        cropType,
        actualYieldKg: { not: null },
        acreage: { gt: 0 },
      },
    });

    if (platformHarvests.length > 0) {
      const sumYieldPerAcre = platformHarvests.reduce(
        (sum, h) => sum + (h.actualYieldKg || 0) / h.acreage,
        0
      );
      const avgYieldPerAcre = sumYieldPerAcre / platformHarvests.length;
      return {
        predictedYieldKg: parseFloat((avgYieldPerAcre * acreage).toFixed(2)),
        basis: 'PLATFORM_AVERAGE',
        dataPointsCount: platformHarvests.length,
      };
    }

    // 3. Fall back to standard defaults
    const cropDefaults: Record<CropType, number> = {
      TOMATO: 12000,
      PEPPER: 8000,
      GARDEN_EGG: 6500,
      OKRA: 5000,
      LEAFY_GREENS: 4000,
      OTHER: 5000,
    };

    const defaultYieldPerAcre = cropDefaults[cropType] || 5000;
    return {
      predictedYieldKg: defaultYieldPerAcre * acreage,
      basis: 'CROP_DEFAULT',
      dataPointsCount: 0,
    };
  }
}
