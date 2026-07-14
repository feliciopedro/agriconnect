import prisma from '../prisma/client';
import { createError } from '../utils/errors';
import { CoOpStatus, PaymentStatus, ListingStatus } from '../prisma/generated-client';
import { DeliveryService } from './delivery.service';

export class CoOpService {
  /**
   * Start a new Co-Op group buy for a produce listing.
   */
  public static async createCoOp(
    creatorId: string,
    listingId: string,
    targetQuantity: number,
    creatorContributionKg: number,
    durationHours: number = 48
  ) {
    const listing = await prisma.produceListing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      throw createError('Produce listing not found', 'LISTING_NOT_FOUND', 404);
    }

    if (listing.status !== 'AVAILABLE') {
      throw createError('Listing is no longer available for purchasing', 'LISTING_UNAVAILABLE', 400);
    }

    if (targetQuantity > listing.remainingKg) {
      throw createError(
        `Target quantity (${targetQuantity}kg) exceeds listing's remaining stock (${listing.remainingKg}kg)`,
        'INSUFFICIENT_STOCK',
        400
      );
    }

    if (creatorContributionKg > targetQuantity) {
      throw createError('Your contribution cannot exceed the co-op target quantity', 'INVALID_CONTRIBUTION', 400);
    }

    const deadline = new Date();
    deadline.setHours(deadline.getHours() + durationHours);

    // Create the group buy and the creator's initial contribution in a transaction
    return await prisma.$transaction(async (tx) => {
      const coOp = await (tx as any).coOpGroup.create({
        data: {
          listingId,
          creatorId,
          targetQuantity,
          deadline,
          status: CoOpStatus.AWAITING_CONTRIBUTIONS,
        },
      });

      const paidAmount = creatorContributionKg * listing.pricePerKg;

      await (tx as any).coOpMember.create({
        data: {
          coOpGroupId: coOp.id,
          buyerId: creatorId,
          quantityKg: creatorContributionKg,
          paidAmount,
          paymentStatus: PaymentStatus.UNPAID, // Set to UNPAID until Paystack payment is completed
        },
      });

      return await (tx as any).coOpGroup.findUnique({
        where: { id: coOp.id },
        include: {
          members: {
            include: {
              buyer: { select: { id: true, name: true, phone: true } },
            },
          },
          listing: true,
        },
      });
    });
  }

  /**
   * Get all active co-op group buys.
   */
  public static async getActiveCoOps(listingId?: string) {
    return await (prisma as any).coOpGroup.findMany({
      where: {
        status: CoOpStatus.AWAITING_CONTRIBUTIONS,
        deadline: { gt: new Date() },
        ...(listingId && { listingId }),
      },
      include: {
        members: {
          include: {
            buyer: { select: { id: true, name: true, phone: true } },
          },
        },
        listing: {
          include: {
            farmer: { select: { name: true, phone: true } },
          },
        },
      },
    });
  }

  /**
   * Get a single co-op group buy by ID.
   */
  public static async getCoOpById(id: string) {
    const coOp = await (prisma as any).coOpGroup.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            buyer: { select: { id: true, name: true, phone: true } },
          },
        },
        listing: {
          include: {
            farmer: { select: { name: true, phone: true } },
          },
        },
      },
    });

    if (!coOp) {
      throw createError('Co-Op Group Buy not found', 'COOP_NOT_FOUND', 404);
    }

    return coOp;
  }

  /**
   * Join an existing active co-op group buy.
   */
  public static async joinCoOp(buyerId: string, coOpGroupId: string, quantityKg: number) {
    const coOp = await this.getCoOpById(coOpGroupId);

    if (coOp.status !== CoOpStatus.AWAITING_CONTRIBUTIONS) {
      throw createError('This co-op group is no longer open for contributions', 'COOP_CLOSED', 400);
    }

    if (new Date(coOp.deadline) <= new Date()) {
      throw createError('The deadline for this co-op group has passed', 'COOP_EXPIRED', 400);
    }

    // Check if buyer has already contributed
    const existingMember = coOp.members.find((m: any) => m.buyerId === buyerId);
    if (existingMember) {
      throw createError('You have already joined this co-op group buy', 'ALREADY_MEMBER', 400);
    }

    const totalAllocated = coOp.members.reduce((sum: number, m: any) => sum + m.quantityKg, 0);
    const spaceLeft = coOp.targetQuantity - totalAllocated;

    if (quantityKg > spaceLeft) {
      throw createError(
        `Requested contribution (${quantityKg}kg) exceeds space left in co-op (${spaceLeft}kg remaining)`,
        'COOP_FULL',
        400
      );
    }

    const paidAmount = quantityKg * coOp.listing.pricePerKg;

    return await (prisma as any).coOpMember.create({
      data: {
        coOpGroupId,
        buyerId,
        quantityKg,
        paidAmount,
        paymentStatus: PaymentStatus.UNPAID,
      },
      include: {
        coOpGroup: true,
      },
    });
  }

  /**
   * Confirm a member's payment and evaluate auto-fulfillment.
   */
  public static async confirmMemberPayment(coOpMemberId: string, paystackRef: string) {
    const member = await (prisma as any).coOpMember.findUnique({
      where: { id: coOpMemberId },
      include: {
        coOpGroup: {
          include: {
            listing: true,
            members: true,
          },
        },
      },
    });

    if (!member) {
      throw createError('Co-op member record not found', 'MEMBER_NOT_FOUND', 404);
    }

    if (member.paymentStatus === PaymentStatus.PAID) {
      return member;
    }

    let shouldFulfill = false;
    const coOpGroupId = member.coOpGroupId;

    // 1. Update member payment and group quantity inside transaction
    const updatedMember = await prisma.$transaction(async (tx) => {
      const updated = await (tx as any).coOpMember.update({
        where: { id: coOpMemberId },
        data: {
          paymentStatus: PaymentStatus.PAID,
          paystackRef,
        },
      });

      // Fetch all paid members and recalculate total paid quantity
      const allMembers = await (tx as any).coOpMember.findMany({
        where: { coOpGroupId },
      });

      const paidMembers = allMembers.filter((m: any) => m.paymentStatus === PaymentStatus.PAID);
      const currentPaidQuantity = paidMembers.reduce((sum: number, m: any) => sum + m.quantityKg, 0);

      // Update currentQuantity on the CoOpGroup
      const group = await (tx as any).coOpGroup.update({
        where: { id: coOpGroupId },
        data: { currentQuantity: currentPaidQuantity },
      });

      // If target reached, and status is still AWAITING_CONTRIBUTIONS, mark it SUCCESSFUL and set trigger flag
      if (currentPaidQuantity >= group.targetQuantity && group.status === CoOpStatus.AWAITING_CONTRIBUTIONS) {
        await (tx as any).coOpGroup.update({
          where: { id: coOpGroupId },
          data: { status: CoOpStatus.SUCCESSFUL },
        });
        shouldFulfill = true;
      }

      return updated;
    });

    // 2. Perform auto-fulfillment outside the transaction to avoid database lock deadlocks
    if (shouldFulfill) {
      console.log(`🎉 Co-op Group ${coOpGroupId} reached target! Fulfilling outside transaction...`);

      // Refetch the group, paid members, and listing
      const group = await (prisma as any).coOpGroup.findUnique({
        where: { id: coOpGroupId },
        include: {
          listing: true,
          members: {
            where: { paymentStatus: PaymentStatus.PAID }
          }
        }
      });

      const listing = group.listing;
      const paidMembers = group.members;

      if (listing.remainingKg < group.targetQuantity) {
        throw createError('Produce listing has insufficient remaining stock to fulfill co-op', 'INSUFFICIENT_STOCK', 400);
      }

      // Loop over paid members and generate orders + delivery requests
      for (const m of paidMembers) {
        const order = await prisma.order.create({
          data: {
            buyerId: m.buyerId,
            listingId: listing.id,
            quantityKg: m.quantityKg,
            totalPrice: m.paidAmount,
            status: 'CONFIRMED',
            paymentStatus: PaymentStatus.PAID,
            paystackReference: m.paystackRef || paystackRef,
          },
        });

        // Link CoOpMember record back to Order
        await (prisma as any).coOpMember.update({
          where: { id: m.id },
          data: { orderId: order.id },
        });

        // Create the associated DeliveryRequest
        await DeliveryService.createDeliveryRequest(order.id);
      }

      // Deduct quantity from original ProduceListing
      const newRemaining = listing.remainingKg - group.targetQuantity;
      const newStatus = newRemaining <= 0 ? ListingStatus.SOLD_OUT : listing.status;

      await prisma.produceListing.update({
        where: { id: listing.id },
        data: {
          remainingKg: newRemaining,
          status: newStatus,
        },
      });

      // Trigger manual route grouping to automatically pool delivery requests
      try {
        console.log(`🔄 Automatically optimizing routes for co-op orders...`);
        await DeliveryService.groupNearbyRequests();
      } catch (routeErr) {
        console.error('[CoOpService] Failed routing carpool optimization post-fulfillment:', routeErr);
      }
    }

    return updatedMember;
  }

  /**
   * Scans active groups and expires those that passed their deadline without meeting target.
   */
  public static async expireStaleCoOps() {
    const expiredGroups = await (prisma as any).coOpGroup.findMany({
      where: {
        status: CoOpStatus.AWAITING_CONTRIBUTIONS,
        deadline: { lte: new Date() },
      },
      include: {
        members: true,
      },
    });

    let expiredCount = 0;

    for (const group of expiredGroups) {
      await prisma.$transaction(async (tx) => {
        // Mark group as expired
        await (tx as any).coOpGroup.update({
          where: { id: group.id },
          data: { status: CoOpStatus.EXPIRED },
        });

        // Simulating refund processing for all paid members
        for (const member of group.members) {
          if (member.paymentStatus === PaymentStatus.PAID) {
            await (tx as any).coOpMember.update({
              where: { id: member.id },
              data: { paymentStatus: PaymentStatus.REFUNDED },
            });
            console.log(`💸 Simulated refund of GHS ${member.paidAmount} to buyer ID ${member.buyerId} for expired co-op ${group.id}`);
          }
        }
      });
      expiredCount++;
    }

    return expiredCount;
  }
}
