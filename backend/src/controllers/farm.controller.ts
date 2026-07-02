import { Request, Response } from 'express';
import { FarmService } from '../services/farm.service';
import { CropType } from '../prisma/generated-client';

export class FarmController {
  /**
   * Registers a new planting log entry.
   */
  public static async createLog(req: Request, res: Response): Promise<void> {
    const farmerId = req.user!.userId;
    const result = await FarmService.createPlantingLog(farmerId, req.body);
    res.status(201).json(result);
  }

  /**
   * Returns the authenticated farmer's planting logs.
   */
  public static async getMyLogs(req: Request, res: Response): Promise<void> {
    const farmerId = req.user!.userId;
    const result = await FarmService.getMyPlantingLogs(farmerId);
    res.status(200).json(result);
  }

  /**
   * Returns details of a specific planting log.
   */
  public static async getLogById(req: Request, res: Response): Promise<void> {
    const farmerId = req.user!.userId;
    const { id } = req.params;
    const result = await FarmService.getPlantingLogById(id, farmerId);
    res.status(200).json(result);
  }

  /**
   * Logs an input application to a planting log.
   */
  public static async addInput(req: Request, res: Response): Promise<void> {
    const farmerId = req.user!.userId;
    const { id } = req.params;
    const result = await FarmService.addPlantingInput(farmerId, id, req.body);
    res.status(201).json(result);
  }

  /**
   * Marks a planting log as harvested.
   */
  public static async harvest(req: Request, res: Response): Promise<void> {
    const farmerId = req.user!.userId;
    const { id } = req.params;
    const { actualYieldKg, actualHarvestDate } = req.body;
    const result = await FarmService.harvestPlantingLog(
      farmerId,
      id,
      parseFloat(actualYieldKg),
      actualHarvestDate
    );
    res.status(200).json(result);
  }

  /**
   * Queries crop yield predictions.
   */
  public static async getYieldPrediction(req: Request, res: Response): Promise<void> {
    const farmerId = req.user!.userId;
    const cropType = req.query.cropType as CropType;
    const acreage = parseFloat(req.query.acreage as string);

    const result = await FarmService.predictYield(farmerId, cropType, acreage);
    res.status(200).json(result);
  }
}
