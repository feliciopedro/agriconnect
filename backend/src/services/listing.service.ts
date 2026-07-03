import prisma from '../prisma/client';
import { generateBatchCode } from '../utils/batchCode';
import { createError } from '../utils/errors';
import { CropType, ListingStatus, TraceEventType, Prisma } from '../prisma/generated-client';
import { PreOrderService } from './preorder.service';
import { AuditLogService } from './audit.service';

export interface SearchFilters {
  cropType?: CropType;
  minQuantityKg?: number;
  maxPricePerKg?: number;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  status?: ListingStatus;
  page?: number;
  limit?: number;
  farmerId?: string;
}

export class ListingService {
  /**
   * Creates a listing, initiates traceability records, and generates a LISTED trace event.
   */
  public static async createListing(farmerId: string, data: any, imagePaths: string[]) {
    const batchCode = generateBatchCode(data.cropType);

    // Fetch farmer's region for pre-order matching
    const farmer = await prisma.user.findUnique({
      where: { id: farmerId },
      select: { region: true },
    });

    // Resolve optional planting log linkage and auto-populate traceability
    let plantingDate: Date | null = null;
    let inputsUsed: string[] = [];
    const plantingLogId = data.plantingLogId || null;

    if (plantingLogId) {
      const log = await prisma.plantingLog.findUnique({
        where: { id: plantingLogId },
        include: { inputs: true },
      });

      if (log) {
        if (log.farmerId !== farmerId) {
          throw createError('Access forbidden: you do not own the specified planting log', 'FORBIDDEN_LOG_LINKAGE', 403);
        }
        plantingDate = log.plantingDate;
        inputsUsed = log.inputs.map(
          (i) => `${i.type}: ${i.name}${i.quantity ? ` (${i.quantity} ${i.unit || ''})` : ''}`
        );
      }
    }

    // Create listing transactionally with default traceability records and trace logs
    const listing = await prisma.$transaction(async (tx) => {
      const newListing = await tx.produceListing.create({
        data: {
          farmerId,
          cropType: data.cropType,
          quantityKg: data.quantityKg,
          remainingKg: data.quantityKg,
          pricePerKg: data.pricePerKg,
          images: imagePaths,
          harvestDate: data.harvestDate,
          expiryEstimate: data.expiryEstimate,
          qualityGrade: data.qualityGrade,
          qualityGradeSource: data.qualityGradeSource,
          status: ListingStatus.AVAILABLE,
          latitude: data.latitude,
          longitude: data.longitude,
          batchCode,
          plantingLogId,
          traceability: {
            create: {
              plantingDate,
              inputsUsed,
              qualityCheckImages: [],
            },
          },
        },
        include: {
          traceability: true,
        },
      });

      // Insert append-only LISTED trace log
      await tx.traceEvent.create({
        data: {
          listingId: newListing.id,
          eventType: TraceEventType.LISTED,
          latitude: data.latitude,
          longitude: data.longitude,
          recordedByUserId: farmerId,
          notes: `Batch listed: ${newListing.quantityKg}kg of ${newListing.cropType}`,
        },
      });

      // Audit Log mutation
      await AuditLogService.log(
        {
          userId: farmerId,
          action: 'CREATE',
          entityName: 'ProduceListing',
          entityId: newListing.id,
          newValues: {
            cropType: newListing.cropType,
            quantityKg: newListing.quantityKg,
            pricePerKg: newListing.pricePerKg,
            status: newListing.status,
            batchCode: newListing.batchCode,
          },
        },
        tx
      );

      return newListing;
    });

    // Fire-and-forget: match open pre-orders to this new listing.
    // Runs asynchronously so listing creation never blocks or fails because of this.
    PreOrderService.matchPreOrderToListing({
      id: listing.id,
      cropType: listing.cropType,
      pricePerKg: listing.pricePerKg,
      remainingKg: listing.remainingKg,
      harvestDate: listing.harvestDate,
      farmerId,
      farmer: { region: farmer?.region },
    }).catch((err) => console.error('[PreOrder] matchPreOrderToListing error:', err));

    return listing;
  }

  /**
   * Queries listings with custom filter parameters.
   * If geolocation criteria is defined, calculates distances in-database using Haversine formula.
   */
  public static async searchListings(filters: SearchFilters) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));

    let matchingIds: string[] = [];
    let distancesMap = new Map<string, number>();
    const geoActive =
      filters.latitude !== undefined &&
      filters.longitude !== undefined &&
      filters.radiusKm !== undefined;

    // 1. Fetch listing ids matching geographic boundaries
    if (geoActive) {
      const { latitude, longitude, radiusKm } = filters;
      const rawGeoListings: { id: string; distance_km: number }[] = await prisma.$queryRawUnsafe(
        `SELECT id, (6371 * acos(cos(radians($1)) * cos(radians("latitude")) * cos(radians("longitude") - radians($2)) + sin(radians($1)) * sin(radians("latitude")))) AS distance_km
         FROM "ProduceListing"
         WHERE (6371 * acos(cos(radians($1)) * cos(radians("latitude")) * cos(radians("longitude") - radians($2)) + sin(radians($1)) * sin(radians("latitude")))) <= $3`,
        latitude,
        longitude,
        radiusKm
      );

      if (rawGeoListings.length === 0) {
        return { data: [], total: 0, page, totalPages: 0 };
      }

      rawGeoListings.forEach((l) => {
        matchingIds.push(l.id);
        distancesMap.set(l.id, l.distance_km);
      });
    }

    // 2. Formulate general filters
    const whereClause: Prisma.ProduceListingWhereInput = {
      ...(geoActive ? { id: { in: matchingIds } } : {}),
      ...(filters.cropType ? { cropType: filters.cropType } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.minQuantityKg !== undefined ? { remainingKg: { gte: filters.minQuantityKg } } : {}),
      ...(filters.maxPricePerKg !== undefined ? { pricePerKg: { lte: filters.maxPricePerKg } } : {}),
      ...(filters.farmerId ? { farmerId: filters.farmerId } : {}),
    };

    // 3. Fetch listings matching filters
    const [dbListings, total] = await Promise.all([
      prisma.produceListing.findMany({
        where: whereClause,
        include: {
          farmer: {
            select: {
              name: true,
              farmerProfile: {
                select: {
                  avgRating: true,
                },
              },
            },
          },
        },
        ...(!geoActive ? { orderBy: { createdAt: 'desc' } } : {}),
      }),
      prisma.produceListing.count({ where: whereClause }),
    ]);

    // 4. Map results and compute distances
    let formattedListings = dbListings.map((l) => {
      const distance = geoActive ? distancesMap.get(l.id) || 0 : null;
      return {
        id: l.id,
        farmerId: l.farmerId,
        farmerName: l.farmer.name,
        farmerRating: l.farmer.farmerProfile?.avgRating || 0,
        cropType: l.cropType,
        quantityKg: l.quantityKg,
        remainingKg: l.remainingKg,
        pricePerKg: l.pricePerKg,
        images: l.images,
        harvestDate: l.harvestDate,
        expiryEstimate: l.expiryEstimate,
        qualityGrade: l.qualityGrade,
        qualityGradeSource: l.qualityGradeSource,
        status: l.status,
        latitude: l.latitude,
        longitude: l.longitude,
        batchCode: l.batchCode,
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
        distanceKm: distance !== null ? parseFloat(distance.toFixed(2)) : null,
      };
    });

    // Sort by distance if active
    if (geoActive) {
      formattedListings.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    const paginatedData = formattedListings.slice(offset, offset + limit);
    const totalPages = Math.ceil(total / limit);

    return {
      data: paginatedData,
      total,
      page,
      totalPages,
    };
  }

  /**
   * Retrieves a listing detailed profile, including farmer contact and audit log.
   */
  public static async getListingById(id: string) {
    const listing = await prisma.produceListing.findUnique({
      where: { id },
      include: {
        farmer: {
          select: {
            name: true,
            phone: true,
            farmerProfile: {
              select: {
                avgRating: true,
              },
            },
          },
        },
        traceability: true,
        traceEvents: {
          orderBy: { timestamp: 'desc' },
          take: 3,
        },
      },
    });

    if (!listing) {
      throw createError('Produce listing not found', 'LISTING_NOT_FOUND', 404);
    }

    return {
      ...listing,
      farmerName: listing.farmer.name,
      farmerPhone: listing.farmer.phone,
      farmerRating: listing.farmer.farmerProfile?.avgRating || 0,
    };
  }

  /**
   * Updates listing properties. Ownership verified before changes are applied.
   */
  public static async updateListing(id: string, farmerId: string, data: any) {
    const listing = await prisma.produceListing.findUnique({
      where: { id },
    });

    if (!listing) {
      throw createError('Produce listing not found', 'LISTING_NOT_FOUND', 404);
    }

    if (listing.farmerId !== farmerId) {
      throw createError('Access forbidden: ownership check failed', 'FORBIDDEN_OWNERSHIP', 403);
    }

    const updatePayload: any = { ...data };

    // Calculate remaining inventory weight proportionally if original quantity changes
    if (data.quantityKg !== undefined && data.quantityKg !== listing.quantityKg) {
      if (listing.quantityKg <= 0) {
        updatePayload.remainingKg = data.quantityKg;
      } else {
        const ratio = listing.remainingKg / listing.quantityKg;
        updatePayload.remainingKg = parseFloat((data.quantityKg * ratio).toFixed(2));
      }
    }

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.produceListing.update({
        where: { id },
        data: updatePayload,
        include: {
          traceability: true,
        },
      });

      await AuditLogService.log(
        {
          userId: farmerId,
          action: 'UPDATE',
          entityName: 'ProduceListing',
          entityId: id,
          oldValues: {
            quantityKg: listing.quantityKg,
            remainingKg: listing.remainingKg,
            pricePerKg: listing.pricePerKg,
            status: listing.status,
          },
          newValues: {
            quantityKg: updated.quantityKg,
            remainingKg: updated.remainingKg,
            pricePerKg: updated.pricePerKg,
            status: updated.status,
          },
        },
        tx
      );

      return updated;
    });
  }

  /**
   * Hard-deletes listing if no orders are present, or sets status to EXPIRED to preserve trail logs.
   */
  public static async deleteListing(id: string, farmerId: string) {
    const listing = await prisma.produceListing.findUnique({
      where: { id },
    });

    if (!listing) {
      throw createError('Produce listing not found', 'LISTING_NOT_FOUND', 404);
    }

    if (listing.farmerId !== farmerId) {
      throw createError('Access forbidden: ownership check failed', 'FORBIDDEN_OWNERSHIP', 403);
    }

    // Check if listing has any linked orders that are NOT cancelled
    const activeOrdersCount = await prisma.order.count({
      where: {
        listingId: id,
        status: { not: 'CANCELLED' },
      },
    });

    return await prisma.$transaction(async (tx) => {
      if (activeOrdersCount > 0) {
        // Soft-delete: change listing status to EXPIRED
        await tx.produceListing.update({
          where: { id },
          data: { status: ListingStatus.EXPIRED },
        });

        await AuditLogService.log(
          {
            userId: farmerId,
            action: 'UPDATE',
            entityName: 'ProduceListing',
            entityId: id,
            oldValues: { status: listing.status },
            newValues: { status: ListingStatus.EXPIRED },
          },
          tx
        );

        return { success: true, action: 'EXPIRED' };
      } else {
        // Hard-delete safely
        await tx.produceListing.delete({
          where: { id },
        });

        await AuditLogService.log(
          {
            userId: farmerId,
            action: 'DELETE',
            entityName: 'ProduceListing',
            entityId: id,
            oldValues: {
              cropType: listing.cropType,
              quantityKg: listing.quantityKg,
              remainingKg: listing.remainingKg,
              status: listing.status,
            },
          },
          tx
        );

        return { success: true, action: 'DELETED' };
      }
    });
  }
}
