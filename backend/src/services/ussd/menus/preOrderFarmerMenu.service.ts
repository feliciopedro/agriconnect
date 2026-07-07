import prisma from '../../../prisma/client';
import { t } from '../../../prisma/ussdTranslations';
import { respond, pushMenu, popMenu, endSession } from '../sessionEngine.service';
import { PreOrderListingService } from '../../preOrderListing.service';
import { CropType, ListingStatus } from '../../../prisma/generated-client';

const CROPS = ['TOMATO', 'PEPPER', 'GARDEN_EGG', 'OKRA', 'LEAFY_GREENS', 'OTHER'];

function getMonthName(monthIndex: number): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[monthIndex % 12];
}

export async function handle(session: any, input: string): Promise<string> {
  const lang = session.language || 'en';
  const menu = session.currentMenu;
  const step = session.currentStep;
  const farmerId = session.userId;

  if (menu === 'FARMER_PREORDER_MAIN') {
    if (input === '') {
      const plansCount = await prisma.produceListing.count({
        where: { farmerId, harvestDate: { gt: new Date() } }
      });

      return respond(
        'CON',
        `Pre-orders:\n1. Create planting plan\n2. My plans (${plansCount})\n3. Incoming deposits\n0. Back`
      );
    }

    if (input === '1') {
      const updated = await pushMenu(session, 'FARMER_PREORDER_CREATE', 'CROP');
      return await handleCreatePlan(updated, '', lang, 'CROP');
    }

    if (input === '2') {
      const updated = await pushMenu(session, 'FARMER_PREORDER_PLANS', 'LIST');
      return await handleMyPlans(updated, '', lang, 'LIST');
    }

    if (input === '3') {
      const updated = await pushMenu(session, 'FARMER_PREORDER_DEPOSITS', 'VIEW');
      return await handleIncomingDeposits(updated, '', lang, 'VIEW');
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return respond('CON', t(lang, 'main_menu'));
    }

    return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
  }

  if (menu.startsWith('FARMER_PREORDER_CREATE')) {
    return await handleCreatePlan(session, input, lang, step);
  }

  if (menu.startsWith('FARMER_PREORDER_PLANS')) {
    return await handleMyPlans(session, input, lang, step);
  }

  if (menu.startsWith('FARMER_PREORDER_DEPOSITS')) {
    return await handleIncomingDeposits(session, input, lang, step);
  }

  return respond('END', t(lang, 'invalid_session'));
}

/**
 * PATH 1: Create planting plan
 */
async function handleCreatePlan(session: any, input: string, lang: string, step: string): Promise<string> {
  const farmerId = session.userId;

  if (step === 'CROP') {
    if (input === '') {
      return respond(
        'CON',
        `What do you need?\n1. Tomato\n2. Pepper\n3. Garden Egg\n4. Okra\n5. Leafy Greens\n6. Other\n0. Back`
      );
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handle(updated, '');
    }

    const idx = parseInt(input, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= CROPS.length) {
      return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
    }

    const crop = CROPS[idx];
    const updated = await pushMenu(session, 'FARMER_PREORDER_CREATE', 'QTY', { createPlanCrop: crop });
    return respond('CON', `How many kg do you plan to grow?\n0. Back`);
  }

  if (step === 'QTY') {
    if (input === '') {
      return respond('CON', `How many kg do you plan to grow?\n0. Back`);
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handleCreatePlan(updated, '', lang, 'CROP');
    }

    const qty = parseFloat(input);
    if (isNaN(qty) || qty <= 0) {
      return respond('CON', `Invalid quantity. Enter again (kg):\n0. Back`);
    }

    const updated = await pushMenu(session, 'FARMER_PREORDER_CREATE', 'PRICE', { createPlanQty: qty });
    return respond('CON', `Price per kg (GHS)?\n0. Back`);
  }

  if (step === 'PRICE') {
    if (input === '') {
      return respond('CON', `Price per kg (GHS)?\n0. Back`);
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handleCreatePlan(updated, '', lang, 'QTY');
    }

    const price = parseFloat(input);
    if (isNaN(price) || price <= 0) {
      return respond('CON', `Invalid price. Enter again (GHS):\n0. Back`);
    }

    const nextMonthIdx = new Date().getMonth() + 1;
    const nextMonth = getMonthName(nextMonthIdx);
    const m2 = getMonthName(nextMonthIdx + 1);
    const m3 = getMonthName(nextMonthIdx + 2);
    const m4 = getMonthName(nextMonthIdx + 3);

    const updated = await pushMenu(session, 'FARMER_PREORDER_CREATE', 'HARVEST', { createPlanPrice: price });
    return respond(
      'CON',
      `Expected harvest? (pick month)\n1. ${nextMonth}\n2. ${m2}\n3. ${m3}\n4. ${m4}\n0. Back`
    );
  }

  if (step === 'HARVEST') {
    if (input === '') {
      const nextMonthIdx = new Date().getMonth() + 1;
      const nextMonth = getMonthName(nextMonthIdx);
      const m2 = getMonthName(nextMonthIdx + 1);
      const m3 = getMonthName(nextMonthIdx + 2);
      const m4 = getMonthName(nextMonthIdx + 3);
      return respond(
        'CON',
        `Expected harvest? (pick month)\n1. ${nextMonth}\n2. ${m2}\n3. ${m3}\n4. ${m4}\n0. Back`
      );
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handleCreatePlan(updated, '', lang, 'PRICE');
    }

    const choice = parseInt(input, 10);
    if (isNaN(choice) || choice < 1 || choice > 4) {
      return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
    }

    const targetMonthOffset = choice; // 1 = nextMonth, 2 = month+2, etc.
    const harvestDate = new Date();
    harvestDate.setMonth(harvestDate.getMonth() + targetMonthOffset);
    harvestDate.setDate(15); // default middle of the month

    const updated = await pushMenu(session, 'FARMER_PREORDER_CREATE', 'MIN_KG', { createPlanHarvestDate: harvestDate.toISOString() });
    return respond('CON', `Minimum kg per buyer?\n0. Back`);
  }

  if (step === 'MIN_KG') {
    if (input === '') {
      return respond('CON', `Minimum kg per buyer?\n0. Back`);
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handleCreatePlan(updated, '', lang, 'HARVEST');
    }

    const minKg = parseFloat(input);
    const qty = session.tempData.createPlanQty || 0;
    if (isNaN(minKg) || minKg <= 0 || minKg > qty) {
      return respond('CON', `Invalid minimum weight. Enter again (kg):\n0. Back`);
    }

    const crop = session.tempData.createPlanCrop;
    const price = session.tempData.createPlanPrice;
    const dateStr = session.tempData.createPlanHarvestDate;
    const harvestDate = new Date(dateStr);
    const harvestMonth = getMonthName(harvestDate.getMonth());

    const updated = await pushMenu(session, 'FARMER_PREORDER_CREATE', 'CONFIRM', { createPlanMinKg: minKg });
    return respond(
      'CON',
      `Confirm planting plan:\n${crop} ${qty}kg\nPrice: GHS ${price}/kg\nHarvest: ${harvestMonth}\nMin order: ${minKg}kg\n\n1. Confirm\n0. Cancel`
    );
  }

  if (step === 'CONFIRM') {
    if (input === '') {
      const crop = session.tempData.createPlanCrop;
      const qty = session.tempData.createPlanQty;
      const price = session.tempData.createPlanPrice;
      const dateStr = session.tempData.createPlanHarvestDate;
      const harvestDate = new Date(dateStr);
      const harvestMonth = getMonthName(harvestDate.getMonth());
      const minKg = session.tempData.createPlanMinKg;
      return respond(
        'CON',
        `Confirm planting plan:\n${crop} ${qty}kg\nPrice: GHS ${price}/kg\nHarvest: ${harvestMonth}\nMin order: ${minKg}kg\n\n1. Confirm\n0. Cancel`
      );
    }

    if (input === '0' || input === '2') {
      // Pop all create plan states to main pre-order menu
      let current = session;
      while (current.currentMenu.startsWith('FARMER_PREORDER_CREATE')) {
        current = await popMenu(current);
      }
      return await handle(current, '');
    }

    if (input === '1') {
      try {
        const crop = session.tempData.createPlanCrop as CropType;
        const qty = session.tempData.createPlanQty;
        const price = session.tempData.createPlanPrice;
        const dateStr = session.tempData.createPlanHarvestDate;
        const minKg = session.tempData.createPlanMinKg;

        const listing = await PreOrderListingService.createPreOrderListing(farmerId, {
          cropType: crop,
          quantityKg: qty,
          pricePerKg: price,
          harvestDate: new Date(dateStr),
          minimumKg: minKg
        });

        await PreOrderListingService.publishPreOrderListing(listing.id);

        await prisma.ussdSession.update({
          where: { id: session.id },
          data: { tempData: {} }
        });

        return respond(
          'END',
          `Plan published!\nBuyers can now place deposits.\nSMS when threshold is met.`
        );
      } catch (err: any) {
        console.error('Error creating pre-order plan:', err);
        return respond('END', `Failed to create plan: ${err.message || 'Server error'}`);
      }
    }

    return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
  }

  return respond('END', t(lang, 'invalid_session'));
}

/**
 * PATH 2: My plans
 */
async function handleMyPlans(session: any, input: string, lang: string, step: string): Promise<string> {
  const farmerId = session.userId;

  if (step === 'LIST') {
    const plans = await prisma.produceListing.findMany({
      where: { farmerId, harvestDate: { gt: new Date() } },
      include: { preOrders: true },
      orderBy: { harvestDate: 'asc' }
    });

    if (input === '') {
      if (plans.length === 0) {
        return respond('CON', `You have no planting plans.\n0. Back`);
      }

      // Store in session
      await prisma.ussdSession.update({
        where: { id: session.id },
        data: {
          tempData: {
            ...session.tempData,
            farmerPlans: plans.map(p => ({ id: p.id, cropType: p.cropType, quantityKg: p.quantityKg, status: p.status }))
          }
        }
      });

      const lines = plans.map((p, idx) => {
        const deposits = p.preOrders.filter(po => po.depositPaid).length;
        return `${idx + 1}. ${p.cropType} ${p.quantityKg}kg - ${deposits} deposits - ${p.status}`;
      });

      return respond('CON', `My plans:\n${lines.join('\n')}\n0. Back`);
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handle(updated, '');
    }

    const idx = parseInt(input, 10) - 1;
    const sessionPlans = session.tempData.farmerPlans as any[] || [];

    if (isNaN(idx) || idx < 0 || idx >= sessionPlans.length) {
      return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
    }

    const selectedPlan = sessionPlans[idx];
    const updated = await pushMenu(session, 'FARMER_PREORDER_PLANS', 'DETAIL', { activePlanId: selectedPlan.id });
    return await handleMyPlans(updated, '', lang, 'DETAIL');
  }

  if (step === 'DETAIL') {
    const planId = session.tempData.activePlanId;
    const plan = await prisma.produceListing.findUnique({
      where: { id: planId },
      include: { preOrders: true }
    });

    if (!plan) return respond('END', t(lang, 'generic_error'));

    if (input === '') {
      const depositsCount = plan.preOrders.filter(po => po.depositPaid).length;
      const totalDepositsValue = plan.preOrders.filter(po => po.depositPaid).reduce((sum, po) => sum + po.depositAmount, 0);

      const text = `${plan.cropType} ${plan.quantityKg}kg\nDeposits: ${depositsCount} (${totalDepositsValue} GHS)\nStatus: ${plan.status}\n\n1. Confirm planting\n2. Post update\n3. Mark harvest ready\n0. Back`;
      return respond('CON', text);
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handleMyPlans(updated, '', lang, 'LIST');
    }

    if (input === '1') {
      // Confirm planting
      try {
        await PreOrderListingService.confirmPlanting(planId);
        return respond('END', `Planting confirmed! Logged to trace ledger successfully.`);
      } catch (err: any) {
        return respond('END', `Action failed: ${err.message || 'Server error'}`);
      }
    }

    if (input === '2') {
      // Post update text
      const updated = await pushMenu(session, 'FARMER_PREORDER_PLANS', 'POST_UPDATE');
      return respond('CON', `Enter growing status update:\n0. Back`);
    }

    if (input === '3') {
      // Mark ready
      const updated = await pushMenu(session, 'FARMER_PREORDER_PLANS', 'MARK_READY');
      return respond('CON', `Confirm harvest ready for ${plan.cropType}?\n\n1. Yes\n0. Cancel`);
    }

    return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
  }

  if (step === 'POST_UPDATE') {
    const planId = session.tempData.activePlanId;

    if (input === '') {
      return respond('CON', `Enter growing status update:\n0. Back`);
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handleMyPlans(updated, '', lang, 'DETAIL');
    }

    try {
      await PreOrderListingService.updateGrowingStatus(planId, input);
      return respond('END', `Update posted! Buyers will see this in their trace updates.`);
    } catch (err: any) {
      return respond('END', `Action failed: ${err.message || 'Server error'}`);
    }
  }

  if (step === 'MARK_READY') {
    const planId = session.tempData.activePlanId;

    if (input === '') {
      return respond('CON', `Confirm harvest ready?\n\n1. Yes\n0. Cancel`);
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handleMyPlans(updated, '', lang, 'DETAIL');
    }

    if (input === '1') {
      try {
        await PreOrderListingService.markHarvestReady(planId);
        return respond(
          'END',
          `Harvest marked ready!\nBuyers will be notified.\nFulfil via app or dial *920*11#.`
        );
      } catch (err: any) {
        return respond('END', `Action failed: ${err.message || 'Server error'}`);
      }
    }

    return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
  }

  return respond('END', t(lang, 'invalid_session'));
}

/**
 * PATH 3: Incoming deposits
 */
async function handleIncomingDeposits(session: any, input: string, lang: string, step: string): Promise<string> {
  const farmerId = session.userId;

  if (step === 'VIEW') {
    const deposits = await prisma.preOrder.findMany({
      where: {
        matchedListing: { farmerId },
        depositPaid: true
      },
      include: { buyer: true, matchedListing: true }
    });

    if (input === '') {
      if (deposits.length === 0) {
        return respond('CON', `No incoming pre-order deposits.\n0. Back`);
      }

      const totalVal = deposits.reduce((sum, po) => sum + po.depositAmount, 0);

      const lines = deposits.slice(0, 5).map(po => {
        return `· ${po.cropType}: GHS${po.depositAmount} (${po.buyer.name.split(' ')[0]})`;
      });

      return respond(
        'CON',
        `Deposits received:\n${lines.join('\n')}\nTotal matched: GHS ${totalVal.toFixed(2)}\n0. Back`
      );
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handle(updated, '');
    }

    return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
  }

  return respond('END', t(lang, 'invalid_session'));
}
