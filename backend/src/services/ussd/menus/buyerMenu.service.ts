import prisma from '../../../prisma/client';
import { t } from '../../../prisma/ussdTranslations';
import { respond, pushMenu, popMenu, endSession } from '../sessionEngine.service';
import { ListingService } from '../../listing.service';
import { PreOrderService } from '../../preorder.service';
import { PaymentService } from '../../payment.service';
import { OrderService } from '../../order.service';
import { DemandSignalService } from '../../demandSignal.service';
import { CropType, ListingStatus, OrderStatus, PaymentStatus, Role, PreOrderStatus } from '../../../prisma/generated-client';

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
 * Parses user custom DDMM string to a Date object, projecting to next year if it has passed.
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
 * Main handler routing logic for USSD Buyer menus
 */
export async function handle(session: any, input: string): Promise<string> {
  const lang = session.language || 'en';
  const menu = session.currentMenu;
  const step = session.currentStep;

  if (menu === 'BUYER_MENU') {
    return await handleMainMenu(session, input, lang);
  }

  if (menu === 'BUYER_FIND_PRODUCE') {
    return await handleFindProduce(session, input, lang, step);
  }

  if (menu === 'BUYER_MY_ORDERS') {
    return await handleMyOrders(session, input, lang, step);
  }

  if (menu === 'BUYER_PREORDERS') {
    return await handlePreOrders(session, input, lang, step);
  }

  if (menu === 'BUYER_MY_SUPPLIERS') {
    return await handleMySuppliers(session, input, lang, step);
  }

  if (menu === 'BUYER_POST_DEMAND') {
    return await handlePostDemand(session, input, lang, step);
  }

  if (menu === 'BUYER_MY_SPENDING') {
    return await handleMySpending(session, input, lang, step);
  }

  return respond('END', t(lang, 'invalid_session'));
}

/**
 * MAIN BUYER MENU
 */
async function handleMainMenu(session: any, input: string, lang: string): Promise<string> {
  const buyerId = session.userId;

  if (input === '') {
    const activeCount = await prisma.order.count({
      where: {
        buyerId,
        status: { in: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.IN_TRANSIT] }
      }
    });

    const welcome = t(lang, 'welcome');
    const name = session.user?.name || '';
    const text = `${welcome}, ${name}\n1. Find Produce\n2. My Orders (${activeCount})\n3. Pre-Orders\n4. My Suppliers\n5. Post Demand Signal\n6. My Spending\n0. Back`;
    return respond('CON', text);
  }

  if (input === '1') {
    const updated = await pushMenu(session, 'BUYER_FIND_PRODUCE', 'CROP_SELECT');
    return await handleFindProduce(updated, '', lang, 'CROP_SELECT');
  }

  if (input === '2') {
    const updated = await pushMenu(session, 'BUYER_MY_ORDERS', 'LIST');
    return await handleMyOrders(updated, '', lang, 'LIST');
  }

  if (input === '3') {
    const updated = await pushMenu(session, 'BUYER_PREORDERS', 'SUBMENU');
    return await handlePreOrders(updated, '', lang, 'SUBMENU');
  }

  if (input === '4') {
    const updated = await pushMenu(session, 'BUYER_MY_SUPPLIERS', 'LIST');
    return await handleMySuppliers(updated, '', lang, 'LIST');
  }

  if (input === '5') {
    const updated = await pushMenu(session, 'BUYER_POST_DEMAND', 'CROP_SELECT');
    return await handlePostDemand(updated, '', lang, 'CROP_SELECT');
  }

  if (input === '6') {
    const updated = await pushMenu(session, 'BUYER_MY_SPENDING', 'VIEW');
    return await handleMySpending(updated, '', lang, 'VIEW');
  }

  if (input === '0') {
    const updated = await popMenu(session);
    return respond('CON', t(lang, 'main_menu'));
  }

  return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
}

/**
 * PATH 1: Find Produce
 */
async function handleFindProduce(session: any, input: string, lang: string, step: string): Promise<string> {
  const buyerId = session.userId;

  if (step === 'CROP_SELECT') {
    if (input === '') {
      return respond('CON', "What do you need?\n1. Tomato\n2. Pepper\n3. Garden Egg\n4. Okra\n5. Leafy Greens\n6. Other\n0. Back");
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handleMainMenu(updated, '', lang);
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
    const cropName = t(lang, 'crop_' + input);

    const updated = await pushMenu(session, 'BUYER_FIND_PRODUCE', 'LIST_NEARBY', { cropType, cropName });
    return await handleFindProduce(updated, '', lang, 'LIST_NEARBY');
  }

  if (step === 'LIST_NEARBY') {
    const cropType = session.tempData.cropType as CropType;
    const cropName = session.tempData.cropName as string;
    const userLat = session.user?.latitude;
    const userLon = session.user?.longitude;

    // Retrieve listings nearby. Default radius 100km.
    const searchParams: any = {
      cropType,
      status: ListingStatus.AVAILABLE,
      limit: 3
    };

    if (userLat !== null && userLon !== null && userLat !== undefined && userLon !== undefined) {
      searchParams.latitude = userLat;
      searchParams.longitude = userLon;
      searchParams.radiusKm = 100;
    }

    const listingsResult = await ListingService.searchListings(searchParams);
    const listings = listingsResult.data;

    if (input === '') {
      if (listings.length === 0) {
        return respond('END', `No ${cropName} available near you right now.\nTry again later or post a demand signal (option 5).`);
      }

      // Store fetched listings' IDs in tempData so we can retrieve selected one in next step
      const listingIds = listings.map(l => l.id);
      await prisma.ussdSession.update({
        where: { id: session.id },
        data: {
          tempData: {
            ...session.tempData,
            nearbyListings: listingIds
          }
        }
      });

      const lines = listings.map((l, idx) => `${idx + 1}. ${l.farmerName} - ${l.remainingKg}kg - GHS${l.pricePerKg}/kg`);
      return respond('CON', `Available ${cropName} near you:\n${lines.join('\n')}\n\n0. Back`);
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handleFindProduce(updated, '', lang, 'CROP_SELECT');
    }

    const selectedIdx = parseInt(input, 10) - 1;
    const sessionListingIds = session.tempData.nearbyListings as string[] || [];

    if (isNaN(selectedIdx) || selectedIdx < 0 || selectedIdx >= sessionListingIds.length) {
      return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
    }

    const listingId = sessionListingIds[selectedIdx];
    const updated = await pushMenu(session, 'BUYER_FIND_PRODUCE', 'DETAIL', { selectedListingId: listingId });
    return await handleFindProduce(updated, '', lang, 'DETAIL');
  }

  if (step === 'DETAIL') {
    const listingId = session.tempData.selectedListingId as string;
    const listing = await prisma.produceListing.findUnique({
      where: { id: listingId },
      include: { farmer: true }
    });

    if (!listing) {
      return respond('END', t(lang, 'generic_error'));
    }

    if (input === '') {
      const dateStr = listing.harvestDate.toLocaleDateString();
      const text = `${listing.farmer.name}\n${listing.remainingKg}kg available @ GHS${listing.pricePerKg}/kg\nHarvested: ${dateStr}\nGrade: ${listing.qualityGrade}\n\n1. Order\n2. Call farmer\n0. Back`;
      return respond('CON', text);
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handleFindProduce(updated, '', lang, 'LIST_NEARBY');
    }

    if (input === '1') {
      const updated = await pushMenu(session, 'BUYER_FIND_PRODUCE', 'QTY', {
        pricePerKg: listing.pricePerKg,
        remainingKg: listing.remainingKg,
        farmerName: listing.farmer.name
      });
      return await handleFindProduce(updated, '', lang, 'QTY');
    }

    if (input === '2') {
      return respond('END', `Farmer's number: ${listing.farmer.phone}\nDial to contact them.`);
    }

    return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
  }

  if (step === 'QTY') {
    const remaining = session.tempData.remainingKg as number;
    const price = session.tempData.pricePerKg as number;

    if (input === '') {
      return respond('CON', `How many kg?\n(Available: ${remaining}kg)\nTotal = qty x GHS${price}\n0. Back`);
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handleFindProduce(updated, '', lang, 'DETAIL');
    }

    const qty = parseFloat(input);
    if (isNaN(qty) || qty <= 0 || qty > remaining) {
      return respond('CON', `Invalid quantity. Enter between 1 and ${remaining} kg:\n0. Back`);
    }

    const total = parseFloat((qty * price).toFixed(2));
    const cropName = session.tempData.cropName || '';
    const farmerName = session.tempData.farmerName || '';

    const updated = await pushMenu(session, 'BUYER_FIND_PRODUCE', 'CONFIRM', { orderQty: qty, orderTotal: total });
    return await handleFindProduce(updated, '', lang, 'CONFIRM');
  }

  if (step === 'CONFIRM') {
    const qty = session.tempData.orderQty as number;
    const total = session.tempData.orderTotal as number;
    const cropName = session.tempData.cropName as string;
    const farmerName = session.tempData.farmerName as string;
    const listingId = session.tempData.selectedListingId as string;

    if (input === '') {
      const text = `Confirm order:\n${qty}kg ${cropName}\nFrom: ${farmerName}\nTotal: GHS${total}\nDeposit on delivery\n\n1. Confirm\n2. Cancel`;
      return respond('CON', text);
    }

    if (input === '2') {
      const updated = await popMenu(session);
      return await handleFindProduce(updated, '', lang, 'QTY');
    }

    if (input === '1') {
      try {
        const order = await OrderService.createOrder(buyerId, listingId, qty, 'USSD');
        return respond('END', `Order placed!\nRef: ${order.id.slice(0, 8)}\nFarmer will be notified.\nPay GHS${total} on delivery\nor visit app to pay online.`);
      } catch (err: any) {
        console.error('Error creating USSD order:', err);
        return respond('END', `Failed to place order: ${err.message || 'Server error'}`);
      }
    }

    return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
  }

  return respond('END', t(lang, 'invalid_session'));
}

/**
 * PATH 2: My Orders
 */
async function handleMyOrders(session: any, input: string, lang: string, step: string): Promise<string> {
  const buyerId = session.userId;

  if (step === 'LIST') {
    const ordersResult = await OrderService.getOrdersForUser(buyerId, Role.BUYER, { limit: 10 });
    const orders = ordersResult.data;

    if (input === '') {
      if (orders.length === 0) {
        return respond('CON', `You have no orders.\n0. Back`);
      }

      // Save order ids to session
      const orderIds = orders.map(o => o.id);
      await prisma.ussdSession.update({
        where: { id: session.id },
        data: {
          tempData: {
            ...session.tempData,
            myOrderIds: orderIds
          }
        }
      });

      const lines = orders.map((o, idx) => {
        const cropChoice = getCropChoiceIndex(o.listing.cropType);
        const crop = t(lang, 'crop_' + cropChoice);
        return `${idx + 1}. ${o.quantityKg}kg ${crop} - ${o.status}`;
      });

      return respond('CON', `My orders:\n${lines.join('\n')}\nSelect for details\n0. Back`);
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handleMainMenu(updated, '', lang);
    }

    const idx = parseInt(input, 10) - 1;
    const sessionOrderIds = session.tempData.myOrderIds as string[] || [];

    if (isNaN(idx) || idx < 0 || idx >= sessionOrderIds.length) {
      return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
    }

    const orderId = sessionOrderIds[idx];
    const updated = await pushMenu(session, 'BUYER_MY_ORDERS', 'DETAIL', { activeOrderId: orderId });
    return await handleMyOrders(updated, '', lang, 'DETAIL');
  }

  if (step === 'DETAIL') {
    const orderId = session.tempData.activeOrderId as string;
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        listing: { include: { farmer: true } },
        deliveryRequest: true
      }
    });

    if (!order) {
      return respond('END', t(lang, 'generic_error'));
    }

    const cropChoice = getCropChoiceIndex(order.listing.cropType);
    const crop = t(lang, 'crop_' + cropChoice);
    const etaStr = order.deliveryRequest?.eta
      ? new Date(order.deliveryRequest.eta).toLocaleDateString()
      : 'Pending dispatch';

    if (input === '') {
      const text = `Order ${order.id.slice(0, 8)}\n${order.quantityKg}kg ${crop}\nFarmer: ${order.listing.farmer.name}\nStatus: ${order.status}\nDelivery: ${etaStr}\n\n1. Pay now (MoMo)\n2. Call farmer\n3. Cancel\n0. Back`;
      return respond('CON', text);
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handleMyOrders(updated, '', lang, 'LIST');
    }

    if (input === '1') {
      // Direct MoMo charge confirmation screen
      const updated = await pushMenu(session, 'BUYER_MY_ORDERS', 'MOMO_PAY_CONFIRM', {
        payTotal: order.totalPrice,
        payPhone: session.user?.phone || ''
      });
      return await handleMyOrders(updated, '', lang, 'MOMO_PAY_CONFIRM');
    }

    if (input === '2') {
      return respond('END', `Farmer's number: ${order.listing.farmer.phone}\nDial to contact them.`);
    }

    if (input === '3') {
      const updated = await pushMenu(session, 'BUYER_MY_ORDERS', 'CANCEL_CONFIRM');
      return await handleMyOrders(updated, '', lang, 'CANCEL_CONFIRM');
    }

    return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
  }

  if (step === 'MOMO_PAY_CONFIRM') {
    const orderId = session.tempData.activeOrderId as string;
    const total = session.tempData.payTotal as number;
    const phone = session.tempData.payPhone as string;

    if (input === '') {
      return respond('CON', `Pay GHS${total} via MoMo?\nNumber: ${phone}\n\n1. Confirm\n0. Cancel`);
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handleMyOrders(updated, '', lang, 'DETAIL');
    }

    if (input === '1') {
      try {
        await PaymentService.chargeMoMoGhana(orderId, phone);
        return respond('END', `MoMo payment of GHS${total} initiated.\nCheck your phone for the prompt.`);
      } catch (err: any) {
        console.error('Error charging MoMo Ghana:', err);
        return respond('END', `Payment initiation failed: ${err.message || 'Server error'}`);
      }
    }

    return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
  }

  if (step === 'CANCEL_CONFIRM') {
    const orderId = session.tempData.activeOrderId as string;

    if (input === '') {
      return respond('CON', `Are you sure you want to cancel this order?\n\n1. Confirm Cancel\n0. Back`);
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handleMyOrders(updated, '', lang, 'DETAIL');
    }

    if (input === '1') {
      try {
        await OrderService.cancelOrder(orderId, buyerId);
        return respond('END', `Order cancelled successfully.`);
      } catch (err: any) {
        console.error('Error cancelling order:', err);
        return respond('END', `Failed to cancel order: ${err.message || 'Server error'}`);
      }
    }

    return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
  }

  return respond('END', t(lang, 'invalid_session'));
}

/**
 * PATH 3: Pre-Orders
 */
async function handlePreOrders(session: any, input: string, lang: string, step: string): Promise<string> {
  const buyerId = session.userId;

  if (step === 'SUBMENU') {
    const myPreorders = await PreOrderService.getMyPreOrders(buyerId, { limit: 10 });
    const count = myPreorders.total;

    if (input === '') {
      return respond('CON', `Pre-orders:\n1. Browse upcoming produce\n2. My pre-orders (${count})\n0. Back`);
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handleMainMenu(updated, '', lang);
    }

    if (input === '1') {
      const updated = await pushMenu(session, 'BUYER_PREORDERS', 'BROWSE_UPCOMING');
      return await handlePreOrders(updated, '', lang, 'BROWSE_UPCOMING');
    }

    if (input === '2') {
      const updated = await pushMenu(session, 'BUYER_PREORDERS', 'MY_PREORDERS');
      return await handlePreOrders(updated, '', lang, 'MY_PREORDERS');
    }

    return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
  }

  if (step === 'BROWSE_UPCOMING') {
    // Upcoming harvest listings (harvest date in the future)
    const upcomingListings = await prisma.produceListing.findMany({
      where: {
        status: ListingStatus.AVAILABLE,
        harvestDate: { gt: new Date() }
      },
      include: { farmer: true },
      orderBy: { harvestDate: 'asc' },
      take: 5
    });

    if (input === '') {
      if (upcomingListings.length === 0) {
        return respond('CON', `No upcoming harvests listed.\n0. Back`);
      }

      // Save upcoming listings ids to session
      const listingIds = upcomingListings.map(l => l.id);
      await prisma.ussdSession.update({
        where: { id: session.id },
        data: {
          tempData: {
            ...session.tempData,
            upcomingListingIds: listingIds
          }
        }
      });

      const lines = upcomingListings.map((l, idx) => {
        const cropChoice = getCropChoiceIndex(l.cropType);
        const crop = t(lang, 'crop_' + cropChoice);
        const month = l.harvestDate.toLocaleString('en-US', { month: 'short' });
        return `${idx + 1}. ${crop} - ${l.farmer.name} - ${month} harvest - GHS${l.pricePerKg}`;
      });

      return respond('CON', `Upcoming harvests:\n${lines.join('\n')}\n0. Back`);
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handlePreOrders(updated, '', lang, 'SUBMENU');
    }

    const idx = parseInt(input, 10) - 1;
    const sessionListingIds = session.tempData.upcomingListingIds as string[] || [];

    if (isNaN(idx) || idx < 0 || idx >= sessionListingIds.length) {
      return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
    }

    const listingId = sessionListingIds[idx];
    const updated = await pushMenu(session, 'BUYER_PREORDERS', 'UPCOMING_DETAIL', { selectedUpcomingId: listingId });
    return await handlePreOrders(updated, '', lang, 'UPCOMING_DETAIL');
  }

  if (step === 'UPCOMING_DETAIL') {
    const listingId = session.tempData.selectedUpcomingId as string;
    const listing = await prisma.produceListing.findUnique({
      where: { id: listingId },
      include: { farmer: true }
    });

    if (!listing) {
      return respond('END', t(lang, 'generic_error'));
    }

    const DEPOSIT_PCT = parseFloat(process.env.PREORDER_DEPOSIT_PCT || '0.20');
    const depositPct = Math.round(DEPOSIT_PCT * 100);
    const depositAmount = parseFloat((listing.remainingKg * listing.pricePerKg * DEPOSIT_PCT).toFixed(2));
    const cropChoice = getCropChoiceIndex(listing.cropType);
    const crop = t(lang, 'crop_' + cropChoice);

    if (input === '') {
      const dateStr = listing.harvestDate.toLocaleDateString();
      const text = `${listing.farmer.name} - ${crop}\n${listing.remainingKg}kg available\nHarvest: ${dateStr}\nDeposit: ${depositPct}% = GHS${depositAmount}\n\n1. Place pre-order\n0. Back`;
      return respond('CON', text);
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handlePreOrders(updated, '', lang, 'BROWSE_UPCOMING');
    }

    if (input === '1') {
      const updated = await pushMenu(session, 'BUYER_PREORDERS', 'PRE_QTY', {
        prePrice: listing.pricePerKg,
        preRemaining: listing.remainingKg,
        preCrop: crop,
        preFarmerName: listing.farmer.name,
        preDepositPct: depositPct
      });
      return await handlePreOrders(updated, '', lang, 'PRE_QTY');
    }

    return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
  }

  if (step === 'PRE_QTY') {
    const remaining = session.tempData.preRemaining as number;
    const price = session.tempData.prePrice as number;
    const pct = session.tempData.preDepositPct as number;

    if (input === '') {
      return respond('CON', `How many kg?\n(Available: ${remaining}kg)\nTotal Deposit = qty x GHS${price} x ${pct}%\n0. Back`);
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handlePreOrders(updated, '', lang, 'UPCOMING_DETAIL');
    }

    const qty = parseFloat(input);
    if (isNaN(qty) || qty <= 0 || qty > remaining) {
      return respond('CON', `Invalid quantity. Enter between 1 and ${remaining} kg:\n0. Back`);
    }

    const DEPOSIT_PCT = parseFloat(process.env.PREORDER_DEPOSIT_PCT || '0.20');
    const depositAmount = parseFloat((qty * price * DEPOSIT_PCT).toFixed(2));

    const updated = await pushMenu(session, 'BUYER_PREORDERS', 'PRE_CONFIRM', { preQtyInput: qty, preDepositAmount: depositAmount });
    return await handlePreOrders(updated, '', lang, 'PRE_CONFIRM');
  }

  if (step === 'PRE_CONFIRM') {
    const qty = session.tempData.preQtyInput as number;
    const deposit = session.tempData.preDepositAmount as number;
    const crop = session.tempData.preCrop as string;
    const farmerName = session.tempData.preFarmerName as string;
    const listingId = session.tempData.selectedUpcomingId as string;

    if (input === '') {
      return respond('CON', `Confirm pre-order:\n${qty}kg ${crop}\nFrom: ${farmerName}\nTotal Deposit: GHS${deposit}\n\n1. Confirm\n2. Cancel`);
    }

    if (input === '2') {
      const updated = await popMenu(session);
      return await handlePreOrders(updated, '', lang, 'PRE_QTY');
    }

    if (input === '1') {
      try {
        const listing = await prisma.produceListing.findUnique({ where: { id: listingId } });
        if (!listing) return respond('END', t(lang, 'generic_error'));

        // Window surrounding expected harvest: 7 days before and after
        const start = new Date(listing.harvestDate.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const end = new Date(listing.harvestDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

        const result = await PreOrderService.createPreOrder(buyerId, {
          cropType: listing.cropType,
          quantityKg: qty,
          maxPricePerKg: listing.pricePerKg,
          harvestWindowStart: start,
          harvestWindowEnd: end
        });

        // Link it to the specific listing immediately
        await prisma.preOrder.update({
          where: { id: result.preOrder.id },
          data: { matchedListingId: listingId }
        });

        // Initiate payment
        await PaymentService.chargePreOrderDepositMoMo(result.preOrder.id, session.user?.phone || '');

        return respond('END', `Pre-order placed!\nRef: ${result.preOrder.id.slice(0, 8)}\nFarmer will be notified.\nDeposit of GHS${deposit} initiated via MoMo.\nCheck your phone for the prompt.`);
      } catch (err: any) {
        console.error('Error placing pre-order:', err);
        return respond('END', `Pre-order failed: ${err.message || 'Server error'}`);
      }
    }

    return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
  }

  if (step === 'MY_PREORDERS') {
    const preordersResult = await PreOrderService.getMyPreOrders(buyerId, { limit: 10 });
    const preorders = preordersResult.data;

    if (input === '') {
      if (preorders.length === 0) {
        return respond('CON', `You have no pre-orders.\n0. Back`);
      }

      // Save preorder ids
      const preorderIds = preorders.map(p => p.id);
      await prisma.ussdSession.update({
        where: { id: session.id },
        data: {
          tempData: {
            ...session.tempData,
            myPreorderIds: preorderIds
          }
        }
      });

      const lines = preorders.map((p, idx) => {
        const cropChoice = getCropChoiceIndex(p.cropType);
        const crop = t(lang, 'crop_' + cropChoice);
        const dateStr = new Date(p.harvestWindowEnd).toLocaleDateString();
        return `${idx + 1}. ${p.quantityKg}kg ${crop} - ${p.status} - ${dateStr}`;
      });

      return respond('CON', `My pre-orders:\n${lines.join('\n')}\n0. Back`);
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handlePreOrders(updated, '', lang, 'SUBMENU');
    }

    const idx = parseInt(input, 10) - 1;
    const sessionPreorderIds = session.tempData.myPreorderIds as string[] || [];

    if (isNaN(idx) || idx < 0 || idx >= sessionPreorderIds.length) {
      return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
    }

    const preorderId = sessionPreorderIds[idx];
    const updated = await pushMenu(session, 'BUYER_PREORDERS', 'MY_PREORDER_DETAIL', { activePreorderId: preorderId });
    return await handlePreOrders(updated, '', lang, 'MY_PREORDER_DETAIL');
  }

  if (step === 'MY_PREORDER_DETAIL') {
    const preorderId = session.tempData.activePreorderId as string;
    const preorder = await prisma.preOrder.findUnique({
      where: { id: preorderId }
    });

    if (!preorder) {
      return respond('END', t(lang, 'generic_error'));
    }

    const cropChoice = getCropChoiceIndex(preorder.cropType);
    const crop = t(lang, 'crop_' + cropChoice);

    if (input === '') {
      let text = `Pre-Order ${preorder.id.slice(0, 8)}\n${preorder.quantityKg}kg ${crop}\nStatus: ${preorder.status}\nDeposit: GHS${preorder.depositAmount}\n\n`;
      if (preorder.status === PreOrderStatus.DEPOSIT_PENDING) {
        text += `1. Pay Deposit (MoMo)\n2. Cancel pre-order\n0. Back`;
      } else {
        text += `1. Cancel pre-order\n0. Back`;
      }
      return respond('CON', text);
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handlePreOrders(updated, '', lang, 'MY_PREORDERS');
    }

    if (preorder.status === PreOrderStatus.DEPOSIT_PENDING) {
      if (input === '1') {
        const updated = await pushMenu(session, 'BUYER_PREORDERS', 'PREORDER_MOMO_CONFIRM');
        return await handlePreOrders(updated, '', lang, 'PREORDER_MOMO_CONFIRM');
      }
      if (input === '2') {
        const updated = await pushMenu(session, 'BUYER_PREORDERS', 'PREORDER_CANCEL_CONFIRM');
        return await handlePreOrders(updated, '', lang, 'PREORDER_CANCEL_CONFIRM');
      }
    } else {
      if (input === '1') {
        const updated = await pushMenu(session, 'BUYER_PREORDERS', 'PREORDER_CANCEL_CONFIRM');
        return await handlePreOrders(updated, '', lang, 'PREORDER_CANCEL_CONFIRM');
      }
    }

    return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
  }

  if (step === 'PREORDER_MOMO_CONFIRM') {
    const preorderId = session.tempData.activePreorderId as string;
    const preorder = await prisma.preOrder.findUnique({ where: { id: preorderId } });
    if (!preorder) return respond('END', t(lang, 'generic_error'));

    const deposit = preorder.depositAmount;
    const phone = session.user?.phone || '';

    if (input === '') {
      return respond('CON', `Pay deposit GHS${deposit} via MoMo?\nNumber: ${phone}\n\n1. Confirm\n0. Cancel`);
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handlePreOrders(updated, '', lang, 'MY_PREORDER_DETAIL');
    }

    if (input === '1') {
      try {
        await PaymentService.chargePreOrderDepositMoMo(preorderId, phone);
        return respond('END', `Deposit of GHS${deposit} initiated via MoMo.\nCheck your phone for the prompt.`);
      } catch (err: any) {
        console.error('Error initiating pre-order MoMo deposit:', err);
        return respond('END', `Payment initiation failed: ${err.message || 'Server error'}`);
      }
    }

    return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
  }

  if (step === 'PREORDER_CANCEL_CONFIRM') {
    const preorderId = session.tempData.activePreorderId as string;

    if (input === '') {
      return respond('CON', `Are you sure you want to cancel this pre-order?\n\n1. Confirm Cancel\n0. Back`);
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handlePreOrders(updated, '', lang, 'MY_PREORDER_DETAIL');
    }

    if (input === '1') {
      try {
        await PreOrderService.cancelPreOrder(preorderId, buyerId);
        return respond('END', `Pre-order cancelled successfully.`);
      } catch (err: any) {
        console.error('Error cancelling pre-order:', err);
        return respond('END', `Failed to cancel pre-order: ${err.message || 'Server error'}`);
      }
    }

    return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
  }

  return respond('END', t(lang, 'invalid_session'));
}

/**
 * PATH 4: My Suppliers
 */
async function handleMySuppliers(session: any, input: string, lang: string, step: string): Promise<string> {
  const buyerId = session.userId;

  if (step === 'LIST') {
    // Dynamic query: Find farmers ordered from in the past
    const uniqueFarmers = await prisma.user.findMany({
      where: {
        listings: {
          some: {
            orders: {
              some: {
                buyerId: buyerId
              }
            }
          }
        }
      },
      include: {
        farmerProfile: true,
        listings: {
          where: { status: ListingStatus.AVAILABLE },
          select: { cropType: true }
        }
      },
      take: 5
    });

    if (input === '') {
      if (uniqueFarmers.length === 0) {
        return respond('CON', `No suppliers registered.\n0. Back`);
      }

      // Save supplier user ids
      const supplierIds = uniqueFarmers.map(f => f.id);
      await prisma.ussdSession.update({
        where: { id: session.id },
        data: {
          tempData: {
            ...session.tempData,
            mySupplierIds: supplierIds
          }
        }
      });

      const lines = uniqueFarmers.map((f, idx) => {
        const crops = Array.from(new Set(f.listings.map(l => t(lang, 'crop_' + getCropChoiceIndex(l.cropType)))));
        const cropStr = crops.length > 0 ? ` (${crops.slice(0, 2).join(', ')})` : '';
        return `${idx + 1}. ${f.name}${cropStr}`;
      });

      return respond('CON', `My suppliers:\n${lines.join('\n')}\n0. Back`);
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handleMainMenu(updated, '', lang);
    }

    const idx = parseInt(input, 10) - 1;
    const sessionSupplierIds = session.tempData.mySupplierIds as string[] || [];

    if (isNaN(idx) || idx < 0 || idx >= sessionSupplierIds.length) {
      return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
    }

    const supplierId = sessionSupplierIds[idx];
    const updated = await pushMenu(session, 'BUYER_MY_SUPPLIERS', 'DETAIL', { selectedSupplierId: supplierId });
    return await handleMySuppliers(updated, '', lang, 'DETAIL');
  }

  if (step === 'DETAIL') {
    const supplierId = session.tempData.selectedSupplierId as string;
    const supplier = await prisma.user.findUnique({
      where: { id: supplierId },
      include: { farmerProfile: true }
    });

    if (!supplier) {
      return respond('END', t(lang, 'generic_error'));
    }

    if (input === '') {
      const lastOrder = await prisma.order.findFirst({
        where: {
          buyerId,
          listing: { farmerId: supplierId }
        },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true }
      });
      const dateStr = lastOrder ? lastOrder.createdAt.toLocaleDateString() : 'N/A';
      const rating = supplier.farmerProfile?.avgRating || 0;
      const region = supplier.region || 'Ghana';

      const text = `${supplier.name} - ${region}\nAvg rating: ${rating}\nLast order: ${dateStr}\n\n1. See their listings\n2. Call\n0. Back`;
      return respond('CON', text);
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handleMySuppliers(updated, '', lang, 'LIST');
    }

    if (input === '1') {
      const updated = await pushMenu(session, 'BUYER_MY_SUPPLIERS', 'SUPPLIER_LISTINGS');
      return await handleMySuppliers(updated, '', lang, 'SUPPLIER_LISTINGS');
    }

    if (input === '2') {
      return respond('END', `Farmer's number: ${supplier.phone}\nDial to contact them.`);
    }

    return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
  }

  if (step === 'SUPPLIER_LISTINGS') {
    const supplierId = session.tempData.selectedSupplierId as string;
    const listingsResult = await ListingService.searchListings({
      farmerId: supplierId,
      status: ListingStatus.AVAILABLE,
      limit: 3
    });
    const listings = listingsResult.data;

    if (input === '') {
      if (listings.length === 0) {
        return respond('CON', `No active listings for this supplier.\n0. Back`);
      }

      // Save listing ids
      const listingIds = listings.map(l => l.id);
      await prisma.ussdSession.update({
        where: { id: session.id },
        data: {
          tempData: {
            ...session.tempData,
            supplierListingIds: listingIds
          }
        }
      });

      const lines = listings.map((l, idx) => {
        const cropChoice = getCropChoiceIndex(l.cropType);
        const crop = t(lang, 'crop_' + cropChoice);
        return `${idx + 1}. ${crop} - ${l.remainingKg}kg - GHS${l.pricePerKg}/kg`;
      });

      return respond('CON', `Available produce:\n${lines.join('\n')}\n0. Back`);
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handleMySuppliers(updated, '', lang, 'DETAIL');
    }

    const idx = parseInt(input, 10) - 1;
    const sessionListingIds = session.tempData.supplierListingIds as string[] || [];

    if (isNaN(idx) || idx < 0 || idx >= sessionListingIds.length) {
      return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
    }

    const listingId = sessionListingIds[idx];
    // Jump to BUYER_FIND_PRODUCE DETAIL screen
    const updated = await pushMenu(session, 'BUYER_FIND_PRODUCE', 'DETAIL', { selectedListingId: listingId });
    return await handleFindProduce(updated, '', lang, 'DETAIL');
  }

  return respond('END', t(lang, 'invalid_session'));
}

/**
 * PATH 5: Post Demand Signal
 */
async function handlePostDemand(session: any, input: string, lang: string, step: string): Promise<string> {
  const buyerId = session.userId;

  if (step === 'CROP_SELECT') {
    if (input === '') {
      return respond('CON', "What do you need?\n1. Tomato\n2. Pepper\n3. Garden Egg\n4. Okra\n5. Leafy Greens\n6. Other\n0. Back");
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handleMainMenu(updated, '', lang);
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
    const cropName = t(lang, 'crop_' + input);

    const updated = await pushMenu(session, 'BUYER_POST_DEMAND', 'QTY', { demandCrop: cropType, demandCropName: cropName });
    return await handlePostDemand(updated, '', lang, 'QTY');
  }

  if (step === 'QTY') {
    if (input === '') {
      return respond('CON', "How many kg do you need?\n0. Back");
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handlePostDemand(updated, '', lang, 'CROP_SELECT');
    }

    const qty = parseFloat(input);
    if (isNaN(qty) || qty <= 0) {
      return respond('CON', "Invalid quantity. Please enter a valid number:\n0. Back");
    }

    const updated = await pushMenu(session, 'BUYER_POST_DEMAND', 'TIMING', { demandQty: qty });
    return await handlePostDemand(updated, '', lang, 'TIMING');
  }

  if (step === 'TIMING') {
    if (input === '') {
      return respond('CON', "When do you need it?\n1. Within 2 weeks\n2. Within a month\n3. Within 3 months\n4. Enter date (DDMM)\n0. Back");
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handlePostDemand(updated, '', lang, 'QTY');
    }

    let harvestWindowEnd: Date | null = null;
    const now = Date.now();

    if (input === '1') {
      harvestWindowEnd = new Date(now + 14 * 24 * 60 * 60 * 1000);
    } else if (input === '2') {
      harvestWindowEnd = new Date(now + 30 * 24 * 60 * 60 * 1000);
    } else if (input === '3') {
      harvestWindowEnd = new Date(now + 90 * 24 * 60 * 60 * 1000);
    } else if (input === '4') {
      const updated = await pushMenu(session, 'BUYER_POST_DEMAND', 'ENTER_DATE');
      return await handlePostDemand(updated, '', lang, 'ENTER_DATE');
    } else {
      return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
    }

    const updated = await pushMenu(session, 'BUYER_POST_DEMAND', 'PRICE', { demandEnd: harvestWindowEnd.toISOString() });
    return await handlePostDemand(updated, '', lang, 'PRICE');
  }

  if (step === 'ENTER_DATE') {
    if (input === '') {
      return respond('CON', "Enter date (DDMM):\n0. Back");
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handlePostDemand(updated, '', lang, 'TIMING');
    }

    const parsedDate = parseDDMM(input);
    if (!parsedDate) {
      return respond('CON', "Invalid date format. Use DDMM format (e.g. 2510 for 25th Oct):\n0. Back");
    }

    const updated = await pushMenu(session, 'BUYER_POST_DEMAND', 'PRICE', { demandEnd: parsedDate.toISOString() });
    return await handlePostDemand(updated, '', lang, 'PRICE');
  }

  if (step === 'PRICE') {
    if (input === '') {
      return respond('CON', "Maximum price per kg? (GHS)\nOr press 0 to skip\n0. Skip");
    }

    let maxPrice = parseFloat(input);
    if (isNaN(maxPrice) || maxPrice < 0) {
      return respond('CON', "Invalid price. Please enter a valid amount:\n0. Skip");
    }

    const updated = await pushMenu(session, 'BUYER_POST_DEMAND', 'CONFIRM', { demandPrice: maxPrice });
    return await handlePostDemand(updated, '', lang, 'CONFIRM');
  }

  if (step === 'CONFIRM') {
    const crop = session.tempData.demandCrop as CropType;
    const cropName = session.tempData.demandCropName as string;
    const qty = session.tempData.demandQty as number;
    const endStr = session.tempData.demandEnd as string;
    const maxPrice = session.tempData.demandPrice as number;

    const date = new Date(endStr);
    const formattedDate = date.toLocaleDateString();

    if (input === '') {
      const priceText = maxPrice > 0 ? `GHS${maxPrice}/kg` : "Skip (any)";
      const text = `Demand signal:\n${qty}kg ${cropName}\nNeeded by: ${formattedDate}\nMax: ${priceText}\n\n1. Post\n0. Cancel`;
      return respond('CON', text);
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handlePostDemand(updated, '', lang, 'PRICE');
    }

    if (input === '1') {
      try {
        await DemandSignalService.createDemandSignal(buyerId, {
          cropType: crop,
          quantityKg: qty,
          harvestWindowEnd: date,
          maxPricePerKg: maxPrice > 0 ? maxPrice : undefined
        });

        return respond('END', "Signal posted! Farmers in your area will see your demand.\nWe will SMS you when a match is found.");
      } catch (err: any) {
        console.error('Error posting demand signal:', err);
        return respond('END', `Failed to post signal: ${err.message || 'Server error'}`);
      }
    }

    return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
  }

  return respond('END', t(lang, 'invalid_session'));
}

/**
 * PATH 6: My Spending
 */
async function handleMySpending(session: any, input: string, lang: string, step: string): Promise<string> {
  const buyerId = session.userId;

  if (step === 'VIEW') {
    const orders = await prisma.order.findMany({
      where: { buyerId, paymentStatus: PaymentStatus.PAID }
    });
    const totalSpent = orders.reduce((sum, o) => sum + o.totalPrice, 0);
    const orderCount = await prisma.order.count({ where: { buyerId } });
    const preOrderCount = await prisma.preOrder.count({ where: { buyerId } });

    if (input === '') {
      const text = `My Spending:\nTotal spent: GHS ${totalSpent.toFixed(2)}\nOrders: ${orderCount}\nPre-orders: ${preOrderCount}\n\n0. Back`;
      return respond('CON', text);
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handleMainMenu(updated, '', lang);
    }

    return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
  }

  return respond('END', t(lang, 'invalid_session'));
}
