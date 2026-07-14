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

    // Persist files to PostgreSQL for persistent storage on Vercel
    if (files && files.length > 0) {
      const fs = require('fs');
      const prisma = require('../prisma/client').default;
      for (const file of files) {
        try {
          const fileData = await fs.promises.readFile(file.path);
          const base64Data = fileData.toString('base64');
          const dbPath = `uploads/${farmerId}/${file.filename}`;
          
          await (prisma as any).storedFile.upsert({
            where: { filename: dbPath },
            update: {
              mimeType: file.mimetype,
              fileData: base64Data,
            },
            create: {
              filename: dbPath,
              mimeType: file.mimetype,
              fileData: base64Data,
            },
          });
        } catch (err) {
          console.error(`Failed to persist file ${file.filename} to DB:`, err);
        }
      }
    }

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
   * Generates a printable PDF product label containing a QR code for batch traceability.
   */
  public static async getTraceLabel(req: Request, res: Response): Promise<void> {
    const listingId = req.params.id;
    try {
      const listing = await ListingService.getListingById(listingId);
      if (!listing) {
        res.status(404).json({ message: 'Produce listing not found' });
        return;
      }
      
      const PDFDocument = require('pdfkit');
      
      // Determine frontend URL
      const frontendUrl = process.env.FRONTEND_URL || 'https://agriconnect-frontend-pearl.vercel.app';
      const traceUrl = `${frontendUrl}/trace/${listing.batchCode}`;
      
      // Create QR Code base64 Data URL
      const qrDataUrl = await QRCode.toDataURL(traceUrl, {
        margin: 1,
        width: 150,
      });

      // Initialize a standard 4x6 inch label PDF (288 x 432 PostScript points)
      const doc = new PDFDocument({
        size: [288, 432],
        margins: { top: 15, bottom: 15, left: 15, right: 15 },
      });

      // Stream settings
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="traceability-label-${listing.batchCode}.pdf"`);
      doc.pipe(res);

      // Draw thin decorative border
      doc.rect(8, 8, 272, 416).lineWidth(2).strokeColor('#2D6A4F').stroke();
      doc.rect(12, 12, 264, 408).lineWidth(0.5).strokeColor('#D1D5DB').stroke();

      // Heading Logo / Brand
      doc.fillColor('#2D6A4F')
         .fontSize(16)
         .font('Helvetica-Bold')
         .text('AgriConnect', 20, 20, { align: 'center' });
         
      doc.fillColor('#6B7280')
         .fontSize(8)
         .font('Helvetica')
         .text('REAL-TIME BATCH TRACEABILITY', 20, 38, { align: 'center' });

      // Horizontal separator line
      doc.moveTo(20, 48).lineTo(268, 48).lineWidth(1).strokeColor('#E5E7EB').stroke();

      // Crop type in huge letters
      const cropName = listing.cropType.replace('_', ' ');
      doc.fillColor('#111827')
         .fontSize(22)
         .font('Helvetica-Bold')
         .text(cropName.toUpperCase(), 20, 58, { align: 'center' });

      // Batch Code
      doc.fillColor('#DC2626')
         .fontSize(11)
         .font('Helvetica-Bold')
         .text(`BATCH: ${listing.batchCode}`, 20, 84, { align: 'center' });

      // Horizontal separator line
      doc.moveTo(20, 102).lineTo(268, 102).lineWidth(1).strokeColor('#E5E7EB').stroke();

      // Grid stats metadata details
      let currentY = 112;
      
      const drawMetadataRow = (label: string, val: string) => {
        doc.fillColor('#6B7280')
           .fontSize(9)
           .font('Helvetica-Bold')
           .text(label, 25, currentY);
           
        doc.fillColor('#111827')
           .fontSize(9)
           .font('Helvetica')
           .text(val, 110, currentY, { width: 150 });
           
        currentY += 16;
      };

      const dateStr = listing.harvestDate ? new Date(listing.harvestDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }) : 'N/A';
      
      drawMetadataRow('Farmer:', listing.farmer?.name || 'AgriConnect Partner');
      drawMetadataRow('Region:', listing.farmer?.region || 'Ghana');
      drawMetadataRow('Quantity:', `${listing.quantityKg} kg`);
      drawMetadataRow('Harvest Date:', dateStr);
      drawMetadataRow('Source:', listing.plantingLogId ? 'Planting Log Audited' : 'Farmer Declared');

      // Horizontal separator line
      doc.moveTo(20, 202).lineTo(268, 202).lineWidth(1).strokeColor('#E5E7EB').stroke();

      // Embed QR code image centered
      doc.image(qrDataUrl, 84, 212, { width: 120 });

      // Help instructions footer
      doc.fillColor('#111827')
         .fontSize(9)
         .font('Helvetica-Bold')
         .text('SCAN TO TRACE PRODUCE', 20, 342, { align: 'center' });
         
      doc.fillColor('#6B7280')
         .fontSize(7)
         .font('Helvetica')
         .text(
           'Scan this QR code with your smartphone camera to view the full logistics chain, verification status, and carbon footprint tracker of this batch.',
           20,
           358,
           { align: 'center', width: 248, lineGap: 2 }
         );

      // Finalize PDF
      doc.end();
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || 'Failed to generate PDF label' });
    }
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
