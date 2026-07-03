import { Request, Response } from 'express';
import { ListingService, SearchFilters } from '../services/listing.service';
import { CropType, ListingStatus } from '../prisma/generated-client';
import { config } from '../config';
import QRCode from 'qrcode';

export class ListingController {
  /**
   * Create a listing with dynamic image paths.
   */
  public static async createListing(req: Request, res: Response): Promise<void> {
    const farmerId = req.user!.userId;
    const files = req.files as Express.Multer.File[] | undefined;
    
    // Map uploaded file structures to access URLs
    const imagePaths = files
      ? files.map((file) => `uploads/${farmerId}/${file.filename}`)
      : [];

    const listing = await ListingService.createListing(farmerId, req.body, imagePaths);
    res.status(201).json(listing);
  }

  /**
   * Search for listings with query coordinates, prices, and crop type filters.
   */
  public static async searchListings(req: Request, res: Response): Promise<void> {
    const {
      cropType,
      minQuantityKg,
      maxPricePerKg,
      latitude,
      longitude,
      radiusKm,
      status,
      page,
      limit,
      farmerId,
    } = req.query;

    const filters: SearchFilters = {
      ...(cropType && { cropType: cropType as CropType }),
      ...(status && { status: status as ListingStatus }),
      ...(minQuantityKg && { minQuantityKg: parseFloat(minQuantityKg as string) }),
      ...(maxPricePerKg && { maxPricePerKg: parseFloat(maxPricePerKg as string) }),
      ...(latitude && { latitude: parseFloat(latitude as string) }),
      ...(longitude && { longitude: parseFloat(longitude as string) }),
      ...(radiusKm && { radiusKm: parseFloat(radiusKm as string) }),
      ...(page && { page: parseInt(page as string, 10) }),
      ...(limit && { limit: parseInt(limit as string, 10) }),
      ...(farmerId && { farmerId: farmerId as string }),
    };

    const results = await ListingService.searchListings(filters);
    res.status(200).json(results);
  }

  /**
   * Get single listing details.
   */
  public static async getListingById(req: Request, res: Response): Promise<void> {
    const result = await ListingService.getListingById(req.params.id);
    res.status(200).json(result);
  }

  /**
   * Generate QR Code PNG buffer and pipe directly to HTTP response stream.
   */
  public static async getListingQrCode(req: Request, res: Response): Promise<void> {
    const listing = await ListingService.getListingById(req.params.id);
    const traceUrl = `${config.FRONTEND_URL}/trace/${listing.batchCode}`;

    // Set proper image content headers and pipe PNG binary buffer
    res.setHeader('Content-Type', 'image/png');
    const qrPngBuffer = await QRCode.toBuffer(traceUrl, {
      type: 'png',
      width: 300,
      margin: 2,
    });
    
    res.status(200).send(qrPngBuffer);
  }

  /**
   * Update listing details.
   */
  public static async updateListing(req: Request, res: Response): Promise<void> {
    const farmerId = req.user!.userId;
    const result = await ListingService.updateListing(req.params.id, farmerId, req.body);
    res.status(200).json(result);
  }

  /**
   * Delete listing or mark as EXPIRED.
   */
  public static async deleteListing(req: Request, res: Response): Promise<void> {
    const farmerId = req.user!.userId;
    const result = await ListingService.deleteListing(req.params.id, farmerId);
    res.status(200).json(result);
  }
}
