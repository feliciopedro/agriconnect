import { Router } from 'express';
import prisma from '../../prisma/client';
import { createError } from '../../utils/errors';
import { FlashSaleService } from '../../services/flashsale/flashSale.service';
import { authenticateToken, requireRole, requireSuperAdmin } from '../../middleware/auth.middleware';
import { Role, Prisma } from '../../prisma/generated-client';

const router = Router();

/**
 * GET /api/flash-sales
 * Public — buyers browsing active flash sales with location radius options
 */
router.get('/', async (req, res) => {
  const { cropType, latitude, longitude, radiusKm, maxPrice } = req.query;

  const lat = latitude ? parseFloat(latitude as string) : undefined;
  const lng = longitude ? parseFloat(longitude as string) : undefined;
  const rad = radiusKm ? parseFloat(radiusKm as string) : 25;
  const priceMax = maxPrice ? parseFloat(maxPrice as string) : undefined;

  const where: any = { status: 'ACTIVE' };

  if (cropType) {
    where.listing = { cropType: cropType as any };
  }
  if (priceMax !== undefined) {
    where.flashPricePerKg = { lte: priceMax };
  }

  let flashSales: any[] = [];

  if (lat !== undefined && lng !== undefined) {
    flashSales = await prisma.$queryRaw<any[]>`
      SELECT fs.*, 
             l."cropType", l."images", l."qualityGrade", l."pricePerKg" as "originalPrice",
             u."name" as "farmerName", u."latitude" as "farmerLatitude", u."longitude" as "farmerLongitude",
             (6371 * acos(cos(radians(${lat})) * cos(radians(u."latitude")) * cos(radians(u."longitude") - radians(${lng})) + sin(radians(${lat})) * sin(radians(u."latitude")))) AS distance_km
      FROM "FlashSale" fs
      JOIN "ProduceListing" l ON fs."listingId" = l.id
      JOIN "User" u ON fs."farmerId" = u.id
      WHERE fs.status = 'ACTIVE'
        AND (${priceMax !== undefined ? Prisma.raw(`fs."flashPricePerKg" <= ${priceMax} AND`) : Prisma.raw('')} 1=1)
        AND (${cropType ? Prisma.raw(`l."cropType" = '${cropType}' AND`) : Prisma.raw('')} 1=1)
        AND (6371 * acos(cos(radians(${lat})) * cos(radians(u."latitude")) * cos(radians(u."longitude") - radians(${lng})) + sin(radians(${lat})) * sin(radians(u."latitude")))) <= ${rad}
      ORDER BY fs."expiresAt" ASC
    `;
  } else {
    const rawSales = await (prisma as any).flashSale.findMany({
      where,
      include: {
        listing: {
          include: {
            farmer: {
              select: { name: true, latitude: true, longitude: true },
            },
          },
        },
      },
      orderBy: { expiresAt: 'asc' },
    });

    flashSales = rawSales.map((fs: any) => ({
      ...fs,
      cropType: fs.listing.cropType,
      images: fs.listing.images,
      qualityGrade: fs.listing.qualityGrade,
      originalPrice: fs.listing.pricePerKg,
      farmerName: fs.listing.farmer.name,
      farmerLatitude: fs.listing.farmer.latitude,
      farmerLongitude: fs.listing.farmer.longitude,
    }));
  }

  const now = Date.now();
  const result = flashSales.map((fs: any) => {
    const expiresAtTime = new Date(fs.expiresAt).getTime();
    const secondsRemaining = Math.max(0, Math.round((expiresAtTime - now) / 1000));
    const soldPercent = fs.quantityKg > 0 ? parseFloat(((fs.soldKg / fs.quantityKg) * 100).toFixed(1)) : 0;

    return {
      ...fs,
      secondsRemaining,
      soldPercent,
    };
  });

  res.status(200).json(result);
});

/**
 * GET /api/flash-sales/my/farmer
 * Farmer's active/past flash sale records
 */
router.get('/my/farmer', authenticateToken, requireRole(Role.FARMER), async (req, res) => {
  const farmerId = req.user!.userId;
  const sales = await (prisma as any).flashSale.findMany({
    where: { farmerId },
    include: { listing: true },
    orderBy: { createdAt: 'desc' },
  });

  const result = sales.map((fs: any) => {
    const earnings = parseFloat((fs.soldKg * fs.flashPricePerKg).toFixed(2));
    return {
      ...fs,
      earnings,
    };
  });

  res.status(200).json(result);
});

/**
 * GET /api/flash-sales/my/buyer
 * Buyer's active pending/confirmed flash sale claims
 */
router.get('/my/buyer', authenticateToken, requireRole(Role.BUYER), async (req, res) => {
  const buyerId = req.user!.userId;
  const claims = await prisma.flashSaleClaim.findMany({
    where: { buyerId },
    include: {
      flashSale: {
        include: {
          listing: true,
        },
      },
    },
    orderBy: { claimedAt: 'desc' },
  });

  const now = Date.now();
  const result = claims.map((c: any) => {
    const expiresAtTime = new Date(c.expiresAt).getTime();
    const secondsRemaining = Math.max(0, Math.round((expiresAtTime - now) / 1000));
    return {
      ...c,
      secondsRemaining,
    };
  });

  res.status(200).json(result);
});

/**
 * GET /api/flash-sales/:id
 * Public — single flash sale details with total claims counts and countdowns
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const flashSale = await (prisma as any).flashSale.findUnique({
    where: { id },
    include: {
      listing: {
        include: {
          farmer: {
            include: { farmerProfile: true },
          },
        },
      },
      _count: {
        select: { claims: true },
      },
    },
  });

  if (!flashSale) {
    throw createError('Flash sale not found', 'NOT_FOUND', 404);
  }

  const now = Date.now();
  const expiresAtTime = new Date(flashSale.expiresAt).getTime();
  const secondsRemaining = Math.max(0, Math.round((expiresAtTime - now) / 1000));
  const availableQuantity = Math.max(0, flashSale.quantityKg - flashSale.soldKg);

  res.status(200).json({
    id: flashSale.id,
    listingId: flashSale.listingId,
    farmerId: flashSale.farmerId,
    originalPricePerKg: flashSale.originalPricePerKg,
    discountPercent: flashSale.discountPercent,
    flashPricePerKg: flashSale.flashPricePerKg,
    quantityKg: flashSale.quantityKg,
    soldKg: flashSale.soldKg,
    riskBand: flashSale.riskBand,
    riskScore: flashSale.riskScore,
    status: flashSale.status,
    expiresAt: flashSale.expiresAt,
    farmerApproved: flashSale.farmerApproved,
    createdAt: flashSale.createdAt,
    updatedAt: flashSale.updatedAt,
    listing: flashSale.listing,
    farmerRating: flashSale.listing.farmer.farmerProfile?.avgRating || 0,
    totalClaimsCount: flashSale._count.claims,
    secondsRemaining,
    availableQuantity,
  });
});

/**
 * POST /api/flash-sales
 * Farmer manually sets up a flash sale on their own produce listing
 */
router.post('/', authenticateToken, requireRole(Role.FARMER), async (req, res) => {
  const { listingId, discountPercent } = req.body;
  const farmerId = req.user!.userId;

  if (!listingId) {
    throw createError('Listing ID is required', 'INVALID_INPUT', 400);
  }

  const discount = parseFloat(discountPercent);
  if (isNaN(discount) || discount < 5 || discount > 70) {
    throw createError('Discount percentage must be between 5% and 70%', 'INVALID_DISCOUNT', 400);
  }

  const listing = await prisma.produceListing.findUnique({
    where: { id: listingId },
  });
  if (!listing) {
    throw createError('Produce listing not found', 'NOT_FOUND', 404);
  }
  if (listing.farmerId !== farmerId) {
    throw createError('Unauthorized to create flash sale for this listing', 'UNAUTHORIZED', 403);
  }

  const flashSale = await FlashSaleService.createFlashSale(listingId, 'FARMER_MANUAL', discount);
  res.status(201).json(flashSale);
});

/**
 * POST /api/flash-sales/:id/claim
 * Require role BUYER — places a pending reservation claim on listing capacity
 */
router.post('/:id/claim', authenticateToken, requireRole(Role.BUYER), async (req, res) => {
  const { id } = req.params;
  const { quantityKg } = req.body;
  const buyerId = req.user!.userId;

  if (!quantityKg || isNaN(quantityKg) || parseFloat(quantityKg) <= 0) {
    throw createError('Valid quantity in kg is required', 'INVALID_INPUT', 400);
  }

  const claim = await FlashSaleService.claimFlashSale(id, buyerId, parseFloat(quantityKg));

  const now = Date.now();
  const expiresAtTime = new Date(claim.expiresAt).getTime();
  const secondsRemaining = Math.max(0, Math.round((expiresAtTime - now) / 1000));

  res.status(201).json({
    ...claim,
    secondsRemaining,
  });
});

/**
 * POST /api/flash-sales/claims/:claimId/confirm
 * Require role BUYER — converts pending claim into active order
 */
router.post('/claims/:claimId/confirm', authenticateToken, requireRole(Role.BUYER), async (req, res) => {
  const { claimId } = req.params;
  const buyerId = req.user!.userId;

  const order = await FlashSaleService.confirmClaim(claimId, buyerId);
  res.status(200).json(order);
});

/**
 * POST /api/flash-sales/:id/approve
 * Require role FARMER — approves an auto-triggered flash sale
 */
router.post('/:id/approve', authenticateToken, requireRole(Role.FARMER), async (req, res) => {
  const { id } = req.params;
  const farmerId = req.user!.userId;

  await FlashSaleService.farmerApproveFlashSale(id, farmerId);
  res.status(200).json({ message: 'Flash sale approved successfully' });
});

/**
 * POST /api/flash-sales/:id/cancel
 * Require role FARMER or ADMIN — cancels active flash sale
 */
router.post('/:id/cancel', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const actorId = req.user!.userId;

  await FlashSaleService.cancelFlashSale(id, actorId, reason);
  res.status(200).json({ message: 'Flash sale cancelled successfully' });
});

export default router;
