import prisma from '../../../prisma/client';
import { t } from '../../../prisma/ussdTranslations';
import { respond, pushMenu, popMenu, endSession } from '../sessionEngine.service';
import { ListingService } from '../../listing.service';
import { PreOrderService } from '../../preorder.service';
import { PaymentService } from '../../payment.service';
import { ForecastService } from '../../forecast.service';
import * as preOrderFarmerMenu from './preOrderFarmerMenu.service';
import { CropType, ListingStatus, OrderStatus } from '../../../prisma/generated-client';

/**
 * Helper to map CropType back to its numeric selection choice in translations
 */
function getCropChoiceIndex(cropType: CropType): string {
  switch (cropType) {
    case CropType.TOMATO: return '1';
    case CropType.PEPPER: return '2';
    case CropType.GARDEN_EGG: return '3';
    case CropType.OKRA: return '4';
    case CropType.LEAFY_GREENS: return '5';
    default: return '6'; // Other
  }
}

/**
 * Parses user custom DDMM string to a Date object, wrapping to next year if it has passed.
 */
function parseDDMM(input: string): Date | null {
  if (!/^\d{4}$/.test(input)) return null;
  const day = parseInt(input.substring(0, 2), 10);
  const month = parseInt(input.substring(2, 4), 10) - 1; // 0-indexed in JS Date

  if (month < 0 || month > 11) return null;

  const currentYear = new Date().getFullYear();
  const date = new Date(currentYear, month, day);

  if (date.getFullYear() !== currentYear || date.getMonth() !== month || date.getDate() !== day) {
    return null;
  }

  // If date is in the past, project to next year
  if (date.getTime() < Date.now() - 24 * 60 * 60 * 1000) {
    date.setFullYear(currentYear + 1);
  }

  return date;
}

/**
 * Main handler routing logic for USSD Farmer menus
 */
export async function handle(session: any, input: string): Promise<string> {
  const lang = session.language || 'en';
  const menu = session.currentMenu;
  const step = session.currentStep;

  if (menu === 'FARMER_MENU') {
    return await handleMainMenu(session, input, lang);
  }

  if (menu === 'FARMER_LIST_PRODUCE') {
    return await handleListProduce(session, input, lang, step);
  }

  if (menu === 'FARMER_MY_LISTINGS') {
    return await handleMyListings(session, input, lang, step);
  }

  if (menu === 'FARMER_INCOMING_ORDERS') {
    return await handleIncomingOrders(session, input, lang, step);
  }

  if (menu === 'FARMER_DELIVERIES') {
    return await handleDeliveries(session, input, lang, step);
  }

  if (menu === 'FARMER_DEMAND_SIGNALS') {
    return await handleDemandSignals(session, input, lang, step);
  }

  if (menu === 'FARMER_EARNINGS') {
    return await handleEarnings(session, input, lang, step);
  }

  if (menu.startsWith('FARMER_PREORDER_')) {
    return await preOrderFarmerMenu.handle(session, input);
  }

  return respond('END', t(lang, 'invalid_session'));
}

/**
 * MAIN FARMER MENU
 */
async function handleMainMenu(session: any, input: string, lang: string): Promise<string> {
  const farmerId = session.userId;

  if (input === '') {
    const activeCount = await prisma.produceListing.count({
      where: { farmerId, status: ListingStatus.AVAILABLE }
    });

    const pendingCount = await prisma.order.count({
      where: {
        listing: { farmerId },
        status: { in: [OrderStatus.PENDING, OrderStatus.CONFIRMED] }
      }
    });

    const welcome = t(lang, 'welcome');
    const name = session.user?.name || '';
    const text = `${welcome}, ${name}\n1. List Produce\n2. My Listings (${activeCount})\n3. Incoming Orders (${pendingCount})\n4. Deliveries\n5. Demand Signals\n6. My Earnings\n7. Pre-Orders\n0. Back`;
    return respond('CON', text);
  }

  if (input === '1') {
    const updated = await pushMenu(session, 'FARMER_LIST_PRODUCE', 'CROP_SELECT');
    return await handleListProduce(updated, '', lang, 'CROP_SELECT');
  }

  if (input === '2') {
    const updated = await pushMenu(session, 'FARMER_MY_LISTINGS', 'LIST');
    return await handleMyListings(updated, '', lang, 'LIST');
  }

  if (input === '3') {
    const updated = await pushMenu(session, 'FARMER_INCOMING_ORDERS', 'LIST');
    return await handleIncomingOrders(updated, '', lang, 'LIST');
  }

  if (input === '4') {
    const updated = await pushMenu(session, 'FARMER_DELIVERIES', 'LIST');
    return await handleDeliveries(updated, '', lang, 'LIST');
  }

  if (input === '5') {
    const updated = await pushMenu(session, 'FARMER_DEMAND_SIGNALS', 'LIST');
    return await handleDemandSignals(updated, '', lang, 'LIST');
  }

  if (input === '6') {
    const updated = await pushMenu(session, 'FARMER_EARNINGS', 'SUMMARY');
    return await handleEarnings(updated, '', lang, 'SUMMARY');
  }

  if (input === '7') {
    const updated = await pushMenu(session, 'FARMER_PREORDER_MAIN', 'START');
    return await preOrderFarmerMenu.handle(updated, '');
  }

  if (input === '0') {
    const updated = await popMenu(session);
    // Since we pop back from FARMER_MENU (which is entry point for farmer), it goes back to INIT/MAIN
    return respond('CON', t(lang, 'main_menu'));
  }

  return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
}

/**
 * PATH 1: List Produce
 */
async function handleListProduce(session: any, input: string, lang: string, step: string): Promise<string> {
  const farmerId = session.userId;

  if (step === 'CROP_SELECT') {
    if (input === '') {
      return respond('CON', t(lang, 'choose_crop'));
    }

    const validChoices = ['1', '2', '3', '4', '5', '6'];
    if (!validChoices.includes(input)) {
      return respond('CON', `${t(lang, 'invalid_crop')}\n0. Back`);
    }

    const cropEnumMap: Record<string, CropType> = {
      '1': CropType.TOMATO,
      '2': CropType.PEPPER,
      '3': CropType.GARDEN_EGG,
      '4': CropType.OKRA,
      '5': CropType.LEAFY_GREENS,
      '6': CropType.OTHER
    };

    const cropType = cropEnumMap[input];
    const updated = await pushMenu(session, 'FARMER_LIST_PRODUCE', 'QTY', { cropTypeChoice: input, cropType });
    return await handleListProduce(updated, '', lang, 'QTY');
  }

  if (step === 'QTY') {
    if (input === '') {
      return respond('CON', `${t(lang, 'enter_qty')}\n(min 5kg)\n0. Back`);
    }

    const qty = parseFloat(input);
    if (isNaN(qty) || qty < 5) {
      return respond('CON', `Invalid quantity. Min 5kg:\n0. Back`);
    }

    const updated = await pushMenu(session, 'FARMER_LIST_PRODUCE', 'PRICE', { quantity: qty });
    return await handleListProduce(updated, '', lang, 'PRICE');
  }

  if (step === 'PRICE') {
    const cropType = session.tempData.cropType as CropType;
    const avgPrice = await ForecastService.getSuggestedPrice(cropType);

    if (input === '') {
      const enterPricePrompt = t(lang, 'enter_price');
      return respond('CON', `${enterPricePrompt}\n\nMarket avg: GHS ${avgPrice}/kg\n0. Back`);
    }

    const price = parseFloat(input);
    if (isNaN(price) || price <= 0) {
      return respond('CON', `${t(lang, 'invalid_price')}\n0. Back`);
    }

    const updated = await pushMenu(session, 'FARMER_LIST_PRODUCE', 'HARVEST_DATE_CHOICE', { price });
    return await handleListProduce(updated, '', lang, 'HARVEST_DATE_CHOICE');
  }

  if (step === 'HARVEST_DATE_CHOICE') {
    if (input === '') {
      return respond('CON', `When will it be ready?\n1. Today\n2. Tomorrow\n3. In 3 days\n4. In a week\n5. Enter date (DDMM)\n0. Back`);
    }

    const now = new Date();
    let harvestDate: Date | null = null;

    if (input === '1') {
      harvestDate = now;
    } else if (input === '2') {
      harvestDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    } else if (input === '3') {
      harvestDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    } else if (input === '4') {
      harvestDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    } else if (input === '5') {
      const updated = await pushMenu(session, 'FARMER_LIST_PRODUCE', 'HARVEST_DATE_CUSTOM');
      return respond('CON', `Enter date (DDMM) e.g. 1507 for July 15:\n0. Back`);
    } else {
      return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
    }

    if (harvestDate) {
      const updated = await pushMenu(session, 'FARMER_LIST_PRODUCE', 'CONFIRM', { harvestDate: harvestDate.toISOString() });
      return await handleListProduce(updated, '', lang, 'CONFIRM');
    }
  }

  if (step === 'HARVEST_DATE_CUSTOM') {
    if (input === '') {
      return respond('CON', `Enter date (DDMM) e.g. 1507:\n0. Back`);
    }

    const date = parseDDMM(input);
    if (!date) {
      return respond('CON', `Invalid format. Enter date (DDMM):\n0. Back`);
    }

    const updated = await pushMenu(session, 'FARMER_LIST_PRODUCE', 'CONFIRM', { harvestDate: date.toISOString() });
    return await handleListProduce(updated, '', lang, 'CONFIRM');
  }

  if (step === 'CONFIRM') {
    const qty = session.tempData.quantity;
    const price = session.tempData.price;
    const cropChoice = session.tempData.cropTypeChoice;
    const cropName = t(lang, 'crop_' + cropChoice);
    const dateStr = new Date(session.tempData.harvestDate).toLocaleDateString();

    if (input === '') {
      return respond('CON', `Confirm:\n${qty}kg ${cropName} @ GHS${price}/kg\nReady: ${dateStr}\n\n1. Confirm\n2. Edit\n0. Cancel`);
    }

    if (input === '1') {
      // Create listing
      const user = session.user;
      if (!user?.latitude || !user?.longitude) {
        return respond('END', `Your location is not set. Update location on the website or dial *920*11*55# to set it.`);
      }

      const listing = await ListingService.createListing(
        farmerId,
        {
          cropType: session.tempData.cropType,
          quantityKg: qty,
          pricePerKg: price,
          harvestDate: new Date(session.tempData.harvestDate),
          latitude: user.latitude,
          longitude: user.longitude
        },
        []
      );

      // Clean session tempData parameters
      await prisma.ussdSession.update({
        where: { id: session.id },
        data: { tempData: {} }
      });

      return respond('END', `Listed! Code: ${listing.batchCode}\n\nBuyers can find your produce.\nYou will get an SMS when ordered.`);
    }

    if (input === '2') {
      // edit goes back to crop select
      const updated = await pushMenu(session, 'FARMER_LIST_PRODUCE', 'CROP_SELECT');
      return await handleListProduce(updated, '', lang, 'CROP_SELECT');
    }

    if (input === '0') {
      // Cancel
      const updated = await popMenu(session);
      return await handleMainMenu(updated, '', lang);
    }

    return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
  }

  return respond('END', t(lang, 'invalid_session'));
}

/**
 * PATH 2: My Listings
 */
async function handleMyListings(session: any, input: string, lang: string, step: string): Promise<string> {
  const farmerId = session.userId;

  if (step === 'LIST') {
    const listings = await prisma.produceListing.findMany({
      where: { farmerId, status: { in: [ListingStatus.AVAILABLE, ListingStatus.RESERVED] } },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    if (input === '') {
      if (listings.length === 0) {
        return respond('CON', `${t(lang, 'no_listings')}\n0. Back`);
      }

      const lines = listings.map((l, i) => {
        const cropChoice = getCropChoiceIndex(l.cropType);
        const crop = t(lang, 'crop_' + cropChoice);
        return `${i + 1}. ${crop} ${l.remainingKg}kg GHS${l.pricePerKg}`;
      });

      return respond('CON', `My listings:\n${lines.join('\n')}\n\nSelect to manage\n0. Back`);
    }

    const idx = parseInt(input, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= listings.length) {
      return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
    }

    const selected = listings[idx];
    const updated = await pushMenu(session, 'FARMER_MY_LISTINGS', 'MANAGE', { listingId: selected.id });
    return await handleMyListings(updated, '', lang, 'MANAGE');
  }

  if (step === 'MANAGE') {
    const listingId = session.tempData.listingId;
    const listing = await prisma.produceListing.findUnique({
      where: { id: listingId }
    });

    if (!listing) {
      return respond('END', `Listing not found.`);
    }

    if (input === '') {
      const cropChoice = getCropChoiceIndex(listing.cropType);
      const cropName = t(lang, 'crop_' + cropChoice);
      return respond('CON', `${cropName} ${listing.remainingKg}kg @ GHS${listing.pricePerKg}/kg\nStatus: ${listing.status}\n\n1. Update price\n2. Update qty\n3. Mark as sold\n4. View orders\n0. Back`);
    }

    if (input === '1') {
      const updated = await pushMenu(session, 'FARMER_MY_LISTINGS', 'UPDATE_PRICE');
      return respond('CON', `Enter new price per kg (GHS):\n0. Back`);
    }

    if (input === '2') {
      const updated = await pushMenu(session, 'FARMER_MY_LISTINGS', 'UPDATE_QTY');
      return respond('CON', `Enter new total quantity in kg:\n0. Back`);
    }

    if (input === '3') {
      const updated = await pushMenu(session, 'FARMER_MY_LISTINGS', 'CONFIRM_SOLD');
      return respond('CON', `Confirm mark as sold?\n1. Yes\n0. Cancel`);
    }

    if (input === '4') {
      const updated = await pushMenu(session, 'FARMER_MY_LISTINGS', 'VIEW_ORDERS');
      return await handleMyListings(updated, '', lang, 'VIEW_ORDERS');
    }

    return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
  }

  if (step === 'UPDATE_PRICE') {
    if (input === '') {
      return respond('CON', `Enter new price per kg (GHS):\n0. Back`);
    }

    const price = parseFloat(input);
    if (isNaN(price) || price <= 0) {
      return respond('CON', `${t(lang, 'invalid_price')}\n0. Back`);
    }

    await ListingService.updateListing(session.tempData.listingId, farmerId, { pricePerKg: price });
    const updated = await popMenu(session); // return to MANAGE
    return await handleMyListings(updated, '', lang, 'MANAGE');
  }

  if (step === 'UPDATE_QTY') {
    if (input === '') {
      return respond('CON', `Enter new total quantity in kg:\n0. Back`);
    }

    const qty = parseFloat(input);
    if (isNaN(qty) || qty < 5) {
      return respond('CON', `Invalid quantity. Min 5kg:\n0. Back`);
    }

    await ListingService.updateListing(session.tempData.listingId, farmerId, { quantityKg: qty });
    const updated = await popMenu(session); // return to MANAGE
    return await handleMyListings(updated, '', lang, 'MANAGE');
  }

  if (step === 'CONFIRM_SOLD') {
    if (input === '1') {
      await ListingService.updateListing(session.tempData.listingId, farmerId, { status: ListingStatus.SOLD_OUT });
      const updated = await popMenu(session); // return to MANAGE
      return await handleMyListings(updated, '', lang, 'MANAGE');
    }
    const updated = await popMenu(session); // cancel and return to MANAGE
    return await handleMyListings(updated, '', lang, 'MANAGE');
  }

  if (step === 'VIEW_ORDERS') {
    const listingId = session.tempData.listingId;
    const orders = await prisma.order.findMany({
      where: { listingId, status: { in: [OrderStatus.PENDING, OrderStatus.CONFIRMED] } },
      include: { buyer: true },
      take: 3
    });

    if (input === '') {
      const listing = await prisma.produceListing.findUnique({ where: { id: listingId } });
      const cropChoice = listing ? getCropChoiceIndex(listing.cropType) : '1';
      const crop = t(lang, 'crop_' + cropChoice);

      if (orders.length === 0) {
        return respond('CON', `No pending orders for ${crop}.\n0. Back`);
      }

      const lines = orders.map((o, i) => `${i + 1}. ${o.quantityKg}kg - ${o.status} - Call: ${o.buyer.phone}`);
      return respond('CON', `Orders for ${crop}:\n${lines.join('\n')}\n0. Back`);
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handleMyListings(updated, '', lang, 'MANAGE');
    }

    return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
  }

  return respond('END', t(lang, 'invalid_session'));
}

/**
 * PATH 3: Incoming Orders
 */
async function handleIncomingOrders(session: any, input: string, lang: string, step: string): Promise<string> {
  const farmerId = session.userId;

  if (step === 'LIST') {
    const orders = await prisma.order.findMany({
      where: {
        listing: { farmerId },
        status: { in: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.IN_TRANSIT] }
      },
      include: { listing: true },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    if (input === '') {
      if (orders.length === 0) {
        return respond('CON', `${t(lang, 'no_orders')}\n0. Back`);
      }

      const lines = orders.map((o, i) => {
        const cropChoice = getCropChoiceIndex(o.listing.cropType);
        const crop = t(lang, 'crop_' + cropChoice);
        return `${i + 1}. ${o.quantityKg}kg ${crop} - ${o.status}`;
      });

      return respond('CON', `Your orders:\n${lines.join('\n')}\n0. Back`);
    }

    const idx = parseInt(input, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= orders.length) {
      return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
    }

    const selected = orders[idx];
    const updated = await pushMenu(session, 'FARMER_INCOMING_ORDERS', 'DETAIL', { orderId: selected.id });
    return await handleIncomingOrders(updated, '', lang, 'DETAIL');
  }

  if (step === 'DETAIL') {
    const orderId = session.tempData.orderId;
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { listing: true, buyer: true, deliveryRequest: true }
    });

    if (!order) {
      return respond('END', `Order not found.`);
    }

    if (input === '') {
      const cropChoice = getCropChoiceIndex(order.listing.cropType);
      const crop = t(lang, 'crop_' + cropChoice);
      const shortId = order.id.slice(0, 8);
      const deliveryStatus = order.deliveryRequest?.status || 'N/A';

      return respond('CON', `Order ${shortId}\n${order.quantityKg}kg ${crop}\nBuyer: ${order.buyer.name}\nStatus: ${order.status}\nDelivery: ${deliveryStatus}\n\n1. Call buyer\n0. Back`);
    }

    if (input === '1') {
      return respond('END', `Buyer's number: ${order.buyer.phone}\nDial to contact them.`);
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handleIncomingOrders(updated, '', lang, 'LIST');
    }

    return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
  }

  return respond('END', t(lang, 'invalid_session'));
}

/**
 * PATH 4: Deliveries
 */
async function handleDeliveries(session: any, input: string, lang: string, step: string): Promise<string> {
  const farmerId = session.userId;

  if (step === 'LIST') {
    const deliveries = await prisma.deliveryRequest.findMany({
      where: { order: { listing: { farmerId } } },
      include: { order: { include: { listing: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    if (input === '') {
      if (deliveries.length === 0) {
        return respond('CON', `No delivery requests found.\n0. Back`);
      }

      const lines = deliveries.map((d, i) => {
        const cropChoice = getCropChoiceIndex(d.order.listing.cropType);
        const crop = t(lang, 'crop_' + cropChoice);
        const eta = d.eta ? new Date(d.eta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A';
        return `${i + 1}. ${crop} - ${d.status} - ETA: ${eta}`;
      });

      return respond('CON', `Deliveries:\n${lines.join('\n')}\n0. Back`);
    }

    const idx = parseInt(input, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= deliveries.length) {
      return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
    }

    const selected = deliveries[idx];
    const updated = await pushMenu(session, 'FARMER_DELIVERIES', 'DETAIL', { deliveryId: selected.id });
    return await handleDeliveries(updated, '', lang, 'DETAIL');
  }

  if (step === 'DETAIL') {
    const deliveryId = session.tempData.deliveryId;
    const delivery = await prisma.deliveryRequest.findUnique({
      where: { id: deliveryId },
      include: { transportProvider: true, order: { include: { listing: true } } }
    });

    if (!delivery) {
      return respond('END', `Delivery not found.`);
    }

    if (input === '') {
      const cropChoice = getCropChoiceIndex(delivery.order.listing.cropType);
      const crop = t(lang, 'crop_' + cropChoice);
      const providerName = delivery.transportProvider?.name || 'Unmatched';
      const etaFormatted = delivery.eta ? new Date(delivery.eta).toLocaleString() : 'N/A';

      return respond('CON', `Delivery: ${crop}\nStatus: ${delivery.status}\nTransport: ${providerName}\nETA: ${etaFormatted}\n\n1. Call transporter\n0. Back`);
    }

    if (input === '1') {
      const phone = delivery.transportProvider?.phone;
      if (!phone) {
        return respond('CON', `No transporter matched to call.\n0. Back`);
      }
      return respond('END', `Transporter's number: ${phone}\nDial to contact them.`);
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handleDeliveries(updated, '', lang, 'LIST');
    }

    return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
  }

  return respond('END', t(lang, 'invalid_session'));
}

/**
 * PATH 5: Demand Signals
 */
async function handleDemandSignals(session: any, input: string, lang: string, step: string): Promise<string> {
  const region = session.user?.region || undefined;

  if (step === 'LIST') {
    const { signals } = await PreOrderService.getDemandSignals({ region });

    if (input === '') {
      if (signals.length === 0) {
        return respond('CON', `No regional demand registered.\n0. Back`);
      }

      const lines = signals.slice(0, 5).map((s, i) => {
        const cropChoice = getCropChoiceIndex(s.cropType);
        const crop = t(lang, 'crop_' + cropChoice);
        return `${i + 1}. ${crop} - ${s.totalKgRequested}kg wanted - GHS${s.priceRange.min}-${s.priceRange.max}/kg`;
      });

      return respond('CON', `Demand near you:\n${lines.join('\n')}\n0. Back`);
    }

    const idx = parseInt(input, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= Math.min(5, signals.length)) {
      return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
    }

    const selected = signals[idx];
    const updated = await pushMenu(session, 'FARMER_DEMAND_SIGNALS', 'DETAIL', {
      demandCrop: selected.cropType,
      demandTotalKg: selected.totalKgRequested,
      demandAvgPrice: selected.avgMaxPricePerKg,
      demandEarliestDate: selected.harvestWindow.earliest ? selected.harvestWindow.earliest.toISOString() : null
    });
    return await handleDemandSignals(updated, '', lang, 'DETAIL');
  }

  if (step === 'DETAIL') {
    const cropType = session.tempData.demandCrop as CropType;
    const cropChoice = getCropChoiceIndex(cropType);
    const cropName = t(lang, 'crop_' + cropChoice);
    const totalKg = session.tempData.demandTotalKg;
    const avgPrice = session.tempData.demandAvgPrice;
    const dateStr = session.tempData.demandEarliestDate
      ? new Date(session.tempData.demandEarliestDate).toLocaleDateString()
      : 'Any time';

    if (input === '') {
      return respond('CON', `${cropName} demand:\n${totalKg}kg wanted\nNeeded by: ${dateStr}\nAvg max: GHS${avgPrice}/kg\n\n1. List ${cropName.toLowerCase()}s\n2. Create pre-order\n0. Back`);
    }

    if (input === '1') {
      // Jump to produce listing flow with crop pre-selected
      // Clear demand params first, then transition to list produce QTY step
      const cropIndex = getCropChoiceIndex(cropType);
      const updated = await pushMenu(session, 'FARMER_LIST_PRODUCE', 'QTY', {
        cropTypeChoice: cropIndex,
        cropType: cropType
      });
      return await handleListProduce(updated, '', lang, 'QTY');
    }

    if (input === '2') {
      // Jump to PREORDER module flow
      const updated = await pushMenu(session, 'PREORDER_CREATE', 'START', { cropType });
      return respond('CON', `Redirected to Pre-Order flow.\nDial 1 to continue.\n0. Back`);
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handleDemandSignals(updated, '', lang, 'LIST');
    }

    return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
  }

  return respond('END', t(lang, 'invalid_session'));
}

/**
 * PATH 6: My Earnings
 */
async function handleEarnings(session: any, input: string, lang: string, step: string): Promise<string> {
  const farmerId = session.userId;

  if (step === 'SUMMARY') {
    // 1. Total Completed DELIVERED Earnings
    const completedOrders = await prisma.order.findMany({
      where: { listing: { farmerId }, status: OrderStatus.DELIVERED }
    });
    const total = completedOrders.reduce((sum, o) => sum + o.totalPrice, 0);

    // 2. Monthly DELIVERED Earnings
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const monthly = completedOrders
      .filter(o => new Date(o.createdAt) >= startOfMonth)
      .reduce((sum, o) => sum + o.totalPrice, 0);

    // 3. Pending Earnings
    const pendingOrders = await prisma.order.findMany({
      where: {
        listing: { farmerId },
        status: { in: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.IN_TRANSIT] }
      }
    });
    const pending = pendingOrders.reduce((sum, o) => sum + o.totalPrice, 0);

    if (input === '') {
      return respond('CON', `Earnings summary:\nThis month: GHS ${monthly.toFixed(2)}\nTotal: GHS ${total.toFixed(2)}\nPending: GHS ${pending.toFixed(2)}\n\n1. Withdraw\n2. Transaction history\n0. Back`);
    }

    if (input === '1') {
      const updated = await pushMenu(session, 'FARMER_EARNINGS', 'WITHDRAW', { availableEarnings: total });
      return await handleEarnings(updated, '', lang, 'WITHDRAW');
    }

    if (input === '2') {
      const updated = await pushMenu(session, 'FARMER_EARNINGS', 'HISTORY');
      return await handleEarnings(updated, '', lang, 'HISTORY');
    }

    return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
  }

  if (step === 'WITHDRAW') {
    const available = session.tempData.availableEarnings || 0;
    const phone = session.user?.phone || '';

    if (input === '') {
      return respond('CON', `Withdraw to MoMo?\nNumber: ${phone}\nAmount: GHS ${available.toFixed(2)}\n\n1. Confirm\n2. Enter different amount\n0. Cancel`);
    }

    if (input === '1') {
      if (available <= 0) {
        return respond('CON', `You have GHS 0.00 available to withdraw.\n0. Back`);
      }

      await PaymentService.initiateWithdrawal(farmerId, phone, available);
      await prisma.ussdSession.update({
        where: { id: session.id },
        data: { tempData: {} }
      });
      return respond('END', `Withdrawal of GHS ${available.toFixed(2)} initiated.\nYou will receive an MoMo prompt shortly.`);
    }

    if (input === '2') {
      const updated = await pushMenu(session, 'FARMER_EARNINGS', 'WITHDRAW_AMOUNT');
      return respond('CON', `Enter amount to withdraw (GHS):\n0. Back`);
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handleEarnings(updated, '', lang, 'SUMMARY');
    }

    return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
  }

  if (step === 'WITHDRAW_AMOUNT') {
    const available = session.tempData.availableEarnings || 0;

    if (input === '') {
      return respond('CON', `Enter amount to withdraw (GHS):\n0. Back`);
    }

    const amount = parseFloat(input);
    if (isNaN(amount) || amount <= 0 || amount > available) {
      return respond('CON', `Invalid amount. Available: GHS ${available.toFixed(2)}\n0. Back`);
    }

    const updated = await pushMenu(session, 'FARMER_EARNINGS', 'WITHDRAW_CONFIRM', { withdrawAmount: amount });
    return await handleEarnings(updated, '', lang, 'WITHDRAW_CONFIRM');
  }

  if (step === 'WITHDRAW_CONFIRM') {
    const amount = session.tempData.withdrawAmount;
    const phone = session.user?.phone || '';

    if (input === '') {
      return respond('CON', `Confirm withdraw of GHS ${amount.toFixed(2)} to ${phone}?\n1. Yes\n0. Cancel`);
    }

    if (input === '1') {
      await PaymentService.initiateWithdrawal(farmerId, phone, amount);
      await prisma.ussdSession.update({
        where: { id: session.id },
        data: { tempData: {} }
      });
      return respond('END', `Withdrawal of GHS ${amount.toFixed(2)} initiated.\nYou will receive an MoMo prompt shortly.`);
    }

    // Cancel back to withdraw screen
    const updated = await popMenu(session); // pop custom confirm
    const doubleUpdated = await popMenu(updated); // pop custom amount entry
    return await handleEarnings(doubleUpdated, '', lang, 'WITHDRAW');
  }

  if (step === 'HISTORY') {
    const completedOrders = await prisma.order.findMany({
      where: { listing: { farmerId }, status: OrderStatus.DELIVERED },
      include: { listing: true },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    if (input === '') {
      if (completedOrders.length === 0) {
        return respond('CON', `No transaction history found.\n0. Back`);
      }

      const lines = completedOrders.map(o => {
        const cropChoice = getCropChoiceIndex(o.listing.cropType);
        const crop = t(lang, 'crop_' + cropChoice);
        return `+GHS ${o.totalPrice.toFixed(2)} - ${crop} (${o.quantityKg}kg)`;
      });

      return respond('CON', `Transaction History:\n${lines.join('\n')}\n0. Back`);
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handleEarnings(updated, '', lang, 'SUMMARY');
    }

    return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
  }

  return respond('END', t(lang, 'invalid_session'));
}
