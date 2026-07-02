import prisma from '../prisma/client';
import { normalizePhone } from './auth.service';
import { ListingService } from './listing.service';
import { Role, ListingStatus, OrderStatus, CropType } from '../prisma/generated-client';
import { config } from '../config';

export class UssdService {
  /**
   * Processes the USSD accumulated inputs and handles Africa's Talking session states.
   * Returns a plain-text response prefixed with "CON " or "END ".
   */
  public static async handleUssdRequest(
    sessionId: string,
    phoneNumber: string,
    text: string
  ): Promise<string> {
    const normalizedPhone = normalizePhone(phoneNumber);

    // 1. Fetch or register Farmer user
    let farmerUser = await prisma.user.findUnique({
      where: { phone: normalizedPhone },
      include: { farmerProfile: true },
    });

    if (!farmerUser) {
      farmerUser = await prisma.user.create({
        data: {
          phone: normalizedPhone,
          name: 'New Farmer',
          role: Role.FARMER,
          isVerified: false,
          farmerProfile: {
            create: {
              farmSizeAcres: null,
              primaryCrops: [],
            },
          },
        },
        include: { farmerProfile: true },
      });
    }

    // 2. Parse USSD input accumulated text
    let parts = text === '' ? [] : text.split('*');

    // Handle "0. Back" menu reset selection
    if (parts.length > 0 && parts[parts.length - 1] === '0') {
      parts = [];
    }

    const depth = parts.length;

    // LEVEL 0 (Main Menu)
    if (depth === 0) {
      return 'CON Welcome to AgriConnect\n1. List Produce\n2. My Listings\n3. My Orders\n4. Help';
    }

    // LEVEL 1
    if (depth === 1) {
      const choice = parts[0];
      if (choice === '1') {
        return 'CON Select crop:\n1. Tomato\n2. Pepper\n3. Garden Egg\n4. Okra\n5. Leafy Greens';
      }
      if (choice === '2') {
        const listings = await prisma.produceListing.findMany({
          where: { farmerId: farmerUser.id, status: ListingStatus.AVAILABLE },
          orderBy: { createdAt: 'desc' },
          take: 3,
        });

        if (listings.length === 0) {
          return 'END You have no active listings.';
        }

        const lines = listings.map(
          (l) => `${l.cropType} - ${l.remainingKg}kg at GHS${l.pricePerKg}/kg`
        );
        return `CON Active Listings:\n${lines.join('\n')}\n0. Back`;
      }
      if (choice === '3') {
        const orders = await prisma.order.findMany({
          where: {
            listing: { farmerId: farmerUser.id },
            status: { in: [OrderStatus.PENDING, OrderStatus.CONFIRMED] },
          },
          orderBy: { createdAt: 'desc' },
          take: 3,
          include: {
            listing: true,
            buyer: true,
          },
        });

        if (orders.length === 0) {
          return 'END No pending orders.';
        }

        const lines = orders.map(
          (o) => `${o.quantityKg}kg ${o.listing.cropType} - ${o.status} - Call: ${o.buyer.phone}`
        );
        return `CON Pending Orders:\n${lines.join('\n')}\n0. Back`;
      }
      if (choice === '4') {
        return `END AgriConnect: List produce, check orders, coordinate delivery.\nVisit ${config.FRONTEND_URL} for full features.\nSupport: +233241234567`;
      }
      return 'END Invalid selection. Dial again to start over.';
    }

    // LEVEL 2
    if (depth === 2) {
      if (parts[0] === '1') {
        const cropChoice = parts[1];
        if (!['1', '2', '3', '4', '5'].includes(cropChoice)) {
          return 'END Invalid crop selection. Dial again to start over.';
        }
        return 'CON Enter quantity in kg (numbers only):';
      }
      return 'END Invalid path. Dial again to start over.';
    }

    // LEVEL 3
    if (depth === 3) {
      if (parts[0] === '1') {
        const qty = parseFloat(parts[2]);
        if (isNaN(qty) || qty <= 0) {
          return 'END Invalid quantity. Dial again to start over.';
        }
        return 'CON Enter your price per kg in GHS (numbers only):';
      }
      return 'END Invalid path. Dial again to start over.';
    }

    // LEVEL 4
    if (depth === 4) {
      if (parts[0] === '1') {
        const qty = parseFloat(parts[2]);
        const price = parseFloat(parts[3]);
        if (isNaN(qty) || qty <= 0 || isNaN(price) || price <= 0) {
          return 'END Invalid inputs. Dial again to start over.';
        }

        const cropMap = {
          '1': 'Tomato',
          '2': 'Pepper',
          '3': 'Garden Egg',
          '4': 'Okra',
          '5': 'Leafy Greens',
        };
        const cropName = cropMap[parts[1] as keyof typeof cropMap];

        return `CON Confirm listing:\n${qty}kg of ${cropName} at GHS ${price}/kg\n1. Confirm\n2. Cancel`;
      }
      return 'END Invalid path. Dial again to start over.';
    }

    // LEVEL 5
    if (depth === 5) {
      if (parts[0] === '1') {
        const qty = parseFloat(parts[2]);
        const price = parseFloat(parts[3]);
        const confirmChoice = parts[4];

        if (isNaN(qty) || qty <= 0 || isNaN(price) || price <= 0) {
          return 'END Invalid parameters. Dial again to start over.';
        }

        if (confirmChoice === '2') {
          return 'END Listing cancelled. Dial again to start over.';
        }

        if (confirmChoice === '1') {
          const cropEnumMap = {
            '1': CropType.TOMATO,
            '2': CropType.PEPPER,
            '3': CropType.GARDEN_EGG,
            '4': CropType.OKRA,
            '5': CropType.LEAFY_GREENS,
          };
          const cropType = cropEnumMap[parts[1] as keyof typeof cropEnumMap];

          const latitude = farmerUser.latitude ?? 6.0945;
          const longitude = farmerUser.longitude ?? -0.2591;

          const listing = await ListingService.createListing(
            farmerUser.id,
            {
              cropType,
              quantityKg: qty,
              pricePerKg: price,
              harvestDate: new Date(),
              latitude,
              longitude,
            },
            []
          );

          return `END Listing created! Batch code: ${listing.batchCode}. Buyers can now find your produce.`;
        }

        return 'END Invalid confirm option. Dial again to start over.';
      }
      return 'END Invalid path. Dial again to start over.';
    }

    return 'END Invalid session state. Dial again to start over.';
  }
}
