import prisma from '../prisma/client';
import { normalizePhone } from './auth.service';
import { ListingService } from './listing.service';
import { Role, ListingStatus, OrderStatus, CropType } from '../prisma/generated-client';
import { config } from '../config';
import { t } from '../prisma/ussdTranslations';

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

    const lang = farmerUser.preferredLanguage || 'en';

    // 2. Parse USSD input accumulated text
    let parts = text === '' ? [] : text.split('*');

    // Handle "0. Back" menu reset selection
    if (parts.length > 0 && parts[parts.length - 1] === '0') {
      parts = [];
    }

    const depth = parts.length;

    // LEVEL 0 (Main Menu)
    if (depth === 0) {
      return `CON ${t(lang, 'welcome')}\n${t(lang, 'main_menu')}`;
    }

    // LEVEL 1
    if (depth === 1) {
      const choice = parts[0];
      if (choice === '1') {
        return `CON ${t(lang, 'choose_crop')}`;
      }
      if (choice === '2') {
        const listings = await prisma.produceListing.findMany({
          where: { farmerId: farmerUser.id, status: ListingStatus.AVAILABLE },
          orderBy: { createdAt: 'desc' },
          take: 3,
        });

        if (listings.length === 0) {
          return `END ${t(lang, 'no_listings')}`;
        }

        const lines = listings.map(
          (l) => t(lang, 'listing_item', { crop: t(lang, 'crop_' + getCropChoiceIndex(l.cropType)), qty: l.remainingKg, price: l.pricePerKg })
        );
        return `CON ${t(lang, 'active_listings_header')}${lines.join('\n')}\n0. Back`;
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
          return `END ${t(lang, 'no_orders')}`;
        }

        const lines = orders.map(
          (o) => t(lang, 'order_item', { qty: o.quantityKg, crop: t(lang, 'crop_' + getCropChoiceIndex(o.listing.cropType)), status: o.status, phone: o.buyer.phone })
        );
        return `CON ${t(lang, 'pending_orders_header')}${lines.join('\n')}\n0. Back`;
      }
      if (choice === '4') {
        return `END ${t(lang, 'help_text', { frontendUrl: config.FRONTEND_URL })}`;
      }
      if (choice === '5') {
        return `CON ${t(lang, 'balance', { amount: '0.00' })}`;
      }
      if (choice === '6') {
        return `CON ${t(lang, 'language_menu')}`;
      }
      if (choice === '0') {
        return `END ${t(lang, 'exit')}`;
      }
      return `END ${t(lang, 'invalid_selection')}`;
    }

    // LEVEL 2
    if (depth === 2) {
      if (parts[0] === '1') {
        const cropChoice = parts[1];
        if (!['1', '2', '3', '4', '5'].includes(cropChoice)) {
          return `END ${t(lang, 'invalid_crop')}`;
        }
        return `CON ${t(lang, 'enter_qty')}`;
      }
      if (parts[0] === '6') {
        const langChoice = parts[1];
        let newLang = 'en';
        if (langChoice === '1') newLang = 'en';
        else if (langChoice === '2') newLang = 'tw';
        else if (langChoice === '3') newLang = 'ew';
        else if (langChoice === '4') newLang = 'ha';
        else return `END ${t(lang, 'invalid_selection')}`;

        await prisma.user.update({
          where: { id: farmerUser.id },
          data: { preferredLanguage: newLang }
        });
        return `END ${t(newLang, 'ussd_lang_changed')}`;
      }
      return `END ${t(lang, 'invalid_path')}`;
    }

    // LEVEL 3
    if (depth === 3) {
      if (parts[0] === '1') {
        const qty = parseFloat(parts[2]);
        if (isNaN(qty) || qty <= 0) {
          return `END ${t(lang, 'invalid_qty')}`;
        }
        return `CON ${t(lang, 'enter_price')}`;
      }
      return `END ${t(lang, 'invalid_path')}`;
    }

    // LEVEL 4
    if (depth === 4) {
      if (parts[0] === '1') {
        const qty = parseFloat(parts[2]);
        const price = parseFloat(parts[3]);
        if (isNaN(qty) || qty <= 0 || isNaN(price) || price <= 0) {
          return `END ${t(lang, 'invalid_inputs')}`;
        }

        const cropChoice = parts[1];
        if (!['1', '2', '3', '4', '5'].includes(cropChoice)) {
          return `END ${t(lang, 'invalid_crop')}`;
        }
        const cropName = t(lang, 'crop_' + cropChoice);

        return `CON ${t(lang, 'confirm_listing', { qty, crop: cropName, price })}`;
      }
      return `END ${t(lang, 'invalid_path')}`;
    }

    // LEVEL 5
    if (depth === 5) {
      if (parts[0] === '1') {
        const qty = parseFloat(parts[2]);
        const price = parseFloat(parts[3]);
        const confirmChoice = parts[4];

        if (isNaN(qty) || qty <= 0 || isNaN(price) || price <= 0) {
          return `END ${t(lang, 'invalid_params')}`;
        }

        if (confirmChoice === '2') {
          return `END ${t(lang, 'listing_cancelled')}`;
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
          if (!cropType) {
            return `END ${t(lang, 'invalid_crop')}`;
          }

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

          return `END ${t(lang, 'listing_created', { code: listing.batchCode })}`;
        }

        return `END ${t(lang, 'invalid_confirm')}`;
      }
      return `END ${t(lang, 'invalid_path')}`;
    }

    return `END ${t(lang, 'invalid_session')}`;
  }
}

function getCropChoiceIndex(cropType: CropType): string {
  switch (cropType) {
    case CropType.TOMATO: return '1';
    case CropType.PEPPER: return '2';
    case CropType.GARDEN_EGG: return '3';
    case CropType.OKRA: return '4';
    case CropType.LEAFY_GREENS: return '5';
    default: return '1';
  }
}
