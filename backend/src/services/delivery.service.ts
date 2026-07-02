import prisma from '../prisma/client';
import { calculateDistanceKm } from '../utils/distance';
import { DeliveryStatus } from '../prisma/generated-client';

export class DeliveryService {
  /**
   * Creates a logistics DeliveryRequest for a confirmed order.
   * Calculates travel distance and sets up estimated costs.
   */
  public static async createDeliveryRequest(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        listing: true,
        buyer: true,
      },
    });

    if (!order) {
      throw new Error(`Order ${orderId} not found for logistics matchmaking`);
    }

    const pickupLat = order.listing.latitude;
    const pickupLng = order.listing.longitude;
    const dropoffLat = order.buyer.latitude ?? pickupLat;
    const dropoffLng = order.buyer.longitude ?? pickupLng;

    // Calculate Haversine distance between farmer crop location and buyer business location
    const distanceKm = calculateDistanceKm(pickupLat, pickupLng, dropoffLat, dropoffLng);
    
    // Estimate logistics cost: Base GHS 20.00 + GHS 4.00 per kilometer
    const estimatedCost = parseFloat((20.00 + distanceKm * 4.0).toFixed(2));

    return await prisma.deliveryRequest.create({
      data: {
        orderId,
        pickupLatitude: pickupLat,
        pickupLongitude: pickupLng,
        dropoffLatitude: dropoffLat,
        dropoffLongitude: dropoffLng,
        estimatedCost,
        status: DeliveryStatus.REQUESTED,
      },
    });
  }
}
