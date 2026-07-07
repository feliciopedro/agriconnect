import prisma from '../../../prisma/client';
import { t } from '../../../prisma/ussdTranslations';
import { respond, pushMenu, popMenu, endSession, sendUssdSms } from '../sessionEngine.service';
import { DeliveryService } from '../../delivery.service';
import { PaymentService } from '../../payment.service';
import { DeliveryStatus, OrderStatus, Role } from '../../../prisma/generated-client';

interface Stop {
  requestId: string;
  type: 'PICKUP' | 'DROPOFF';
  latitude: number;
  longitude: number;
  cropType: string;
  batchCode: string;
}

interface StopInfo {
  stop: Stop;
  index: number;
  isCompleted: boolean;
}

/**
 * Reconstructs or fetches the current transporter stop sequence.
 */
async function getStopsInfo(transporterId: string): Promise<{ stops: StopInfo[], currentStopIndex: number, rawRequests: any[] }> {
  const activeReqs = await prisma.deliveryRequest.findMany({
    where: {
      transportProviderId: transporterId,
      status: { in: [DeliveryStatus.MATCHED, DeliveryStatus.PICKED_UP] }
    },
    include: {
      order: {
        include: {
          listing: {
            include: { farmer: true }
          },
          buyer: true
        }
      }
    }
  });

  if (activeReqs.length === 0) {
    return { stops: [], currentStopIndex: -1, rawRequests: [] };
  }

  // Find sequence from routeGroupId if grouped
  let sequence: Stop[] = [];
  const groupedReq = activeReqs.find(r => r.routeGroupId !== null);
  if (groupedReq) {
    const groupReqsInGroup = await prisma.deliveryRequest.findMany({
      where: { routeGroupId: groupedReq.routeGroupId }
    });
    const leadReq = groupReqsInGroup.find(r => r.routeSequence !== null);
    if (leadReq && leadReq.routeSequence) {
      sequence = leadReq.routeSequence as any as Stop[];
    }
  }

  // If no optimized sequence, build a basic one
  if (sequence.length === 0) {
    for (const req of activeReqs) {
      sequence.push({
        requestId: req.id,
        type: 'PICKUP',
        latitude: req.pickupLatitude,
        longitude: req.pickupLongitude,
        cropType: req.order.listing.cropType,
        batchCode: req.order.listing.batchCode
      });
      sequence.push({
        requestId: req.id,
        type: 'DROPOFF',
        latitude: req.dropoffLatitude,
        longitude: req.dropoffLongitude,
        cropType: req.order.listing.cropType,
        batchCode: req.order.listing.batchCode
      });
    }
  }

  const stopsInfo: StopInfo[] = [];
  let currentStopIndex = -1;

  for (let i = 0; i < sequence.length; i++) {
    const s = sequence[i];
    const req = activeReqs.find(r => r.id === s.requestId);
    let isCompleted = false;

    if (req) {
      if (s.type === 'PICKUP') {
        isCompleted = req.status === DeliveryStatus.PICKED_UP || req.status === DeliveryStatus.DELIVERED;
      } else {
        isCompleted = req.status === DeliveryStatus.DELIVERED;
      }
    } else {
      isCompleted = true; // Fallback
    }

    stopsInfo.push({
      stop: s,
      index: i,
      isCompleted
    });

    if (!isCompleted && currentStopIndex === -1) {
      currentStopIndex = i;
    }
  }

  return { stops: stopsInfo, currentStopIndex, rawRequests: activeReqs };
}

/**
 * Main USSD transporter routing handler
 */
export async function handle(session: any, input: string): Promise<string> {
  const lang = session.language || 'en';
  const menu = session.currentMenu;
  const step = session.currentStep;

  if (menu === 'TRANSPORT_MENU') {
    return await handleMainMenu(session, input, lang);
  }

  if (menu === 'TRANSPORT_JOBS') {
    return await handleJobsMenu(session, input, lang, step);
  }

  if (menu === 'TRANSPORT_ACTIVE_ROUTE') {
    return await handleActiveRouteMenu(session, input, lang, step);
  }

  if (menu === 'TRANSPORT_AVAILABILITY') {
    return await handleToggleAvailability(session, input, lang, step);
  }

  if (menu === 'TRANSPORT_EARNINGS') {
    return await handleEarnings(session, input, lang, step);
  }

  return respond('END', t(lang, 'invalid_session'));
}

/**
 * MAIN TRANSPORTER MENU
 */
async function handleMainMenu(session: any, input: string, lang: string): Promise<string> {
  const transporterId = session.userId;

  if (input === '') {
    // 1. Available Jobs Count
    let count = 0;
    try {
      const { ungrouped, groupedRoutes } = await DeliveryService.findAvailableDeliveryRequests(transporterId);
      count = ungrouped.length + groupedRoutes.length;
    } catch (e) {
      // transproter location might be missing, count remains 0
    }

    const welcome = t(lang, 'welcome');
    const name = session.user?.name || '';
    const text = `${welcome}, ${name}\n1. Available Jobs (${count})\n2. My Active Route\n3. Toggle Availability\n4. My Earnings\n0. Back`;
    return respond('CON', text);
  }

  if (input === '1') {
    // Check if location is missing
    const user = await prisma.user.findUnique({
      where: { id: transporterId }
    });
    if (!user || user.latitude === null || user.longitude === null) {
      return respond('CON', `Please update your location on the app to view available jobs.\n0. Back`);
    }

    const updated = await pushMenu(session, 'TRANSPORT_JOBS', 'LIST');
    return await handleJobsMenu(updated, '', lang, 'LIST');
  }

  if (input === '2') {
    const updated = await pushMenu(session, 'TRANSPORT_ACTIVE_ROUTE', 'VIEW');
    return await handleActiveRouteMenu(updated, '', lang, 'VIEW');
  }

  if (input === '3') {
    const updated = await pushMenu(session, 'TRANSPORT_AVAILABILITY', 'TOGGLE');
    return await handleToggleAvailability(updated, '', lang, 'TOGGLE');
  }

  if (input === '4') {
    const updated = await pushMenu(session, 'TRANSPORT_EARNINGS', 'SUMMARY');
    return await handleEarnings(updated, '', lang, 'SUMMARY');
  }

  if (input === '0') {
    const updated = await popMenu(session);
    return respond('CON', t(lang, 'main_menu'));
  }

  return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
}

/**
 * PATH 1: Available Jobs
 */
async function handleJobsMenu(session: any, input: string, lang: string, step: string): Promise<string> {
  const transporterId = session.userId;

  if (step === 'LIST') {
    const { ungrouped, groupedRoutes } = await DeliveryService.findAvailableDeliveryRequests(transporterId);

    const jobsList: any[] = [];
    for (const gr of groupedRoutes) {
      jobsList.push({
        type: 'GROUP',
        id: gr.routeGroupId,
        stopCount: gr.members.length * 2,
        totalKm: gr.members[0]?.routeDistanceKm || 0,
        totalEarn: gr.members.reduce((sum, m) => sum + (m.estimatedCost || 0), 0),
        leadRequestId: gr.members[0]?.id
      });
    }
    for (const ug of ungrouped) {
      const cropChoice = ug.order.listing.cropType;
      jobsList.push({
        type: 'SINGLE',
        id: ug.id,
        crop: cropChoice,
        qty: ug.order.quantityKg,
        dist: ug.routeDistanceKm || 0,
        earn: ug.estimatedCost || 0
      });
    }

    const displayJobs = jobsList.slice(0, 5);

    if (input === '') {
      if (displayJobs.length === 0) {
        return respond('CON', `No delivery jobs near you.\n0. Back`);
      }

      // Save jobs to session
      await prisma.ussdSession.update({
        where: { id: session.id },
        data: {
          tempData: {
            ...session.tempData,
            jobsList: displayJobs
          }
        }
      });

      const lines = displayJobs.map((j, idx) => {
        if (j.type === 'GROUP') {
          return `★ Group: ${j.stopCount} stops - ${j.totalKm}km - GHS${j.totalEarn}`;
        } else {
          return `${idx + 1}. ${j.crop} - ${j.qty}kg - ${j.dist}km - GHS${j.earn}`;
        }
      });

      return respond('CON', `Jobs near you:\n${lines.join('\n')}\n0. Back`);
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handleMainMenu(updated, '', lang);
    }

    const idx = parseInt(input, 10) - 1;
    const sessionJobs = session.tempData.jobsList as any[] || [];

    if (isNaN(idx) || idx < 0 || idx >= sessionJobs.length) {
      return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
    }

    const job = sessionJobs[idx];
    const updated = await pushMenu(session, 'TRANSPORT_JOBS', 'DETAIL', { activeJob: job });
    return await handleJobsMenu(updated, '', lang, 'DETAIL');
  }

  if (step === 'DETAIL') {
    const job = session.tempData.activeJob;

    if (job.type === 'SINGLE') {
      const request = await prisma.deliveryRequest.findUnique({
        where: { id: job.id },
        include: {
          order: {
            include: {
              listing: { include: { farmer: true } },
              buyer: true
            }
          }
        }
      });

      if (!request) return respond('END', t(lang, 'generic_error'));

      if (input === '') {
        const crop = request.order.listing.cropType;
        const text = `Job detail:\n${crop} ${request.order.quantityKg}kg\nPickup: ${request.order.listing.farmer.district || 'Farmer'}\nDrop: ${request.order.buyer.district || 'Buyer'}\nDistance: ${job.dist}km\nEarnings: GHS${job.earn}\n\n1. Accept\n0. Back`;
        return respond('CON', text);
      }
    } else {
      // Grouped route detail
      if (input === '') {
        const text = `Grouped Route detail:\nStops: ${job.stopCount}\nTotal Distance: ${job.totalKm}km\nTotal Earnings: GHS${job.totalEarn}\n\n1. Accept\n0. Back`;
        return respond('CON', text);
      }
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handleJobsMenu(updated, '', lang, 'LIST');
    }

    if (input === '1') {
      try {
        const targetId = job.type === 'GROUP' ? job.leadRequestId : job.id;
        const acceptResult = await DeliveryService.acceptDeliveryRequest(targetId, transporterId);

        // Send SMS details
        const transporterPhone = session.user?.phone || '';
        if (job.type === 'GROUP') {
          const groupReqs = await prisma.deliveryRequest.findMany({
            where: { routeGroupId: job.id },
            include: {
              order: {
                include: {
                  listing: { include: { farmer: true } },
                  buyer: true
                }
              }
            }
          });
          const leadReq = groupReqs.find(r => r.routeSequence !== null) || groupReqs[0];
          const seq = leadReq.routeSequence as any as Stop[] || [];

          const smsLines = [];
          for (let i = 0; i < seq.length; i++) {
            const stop = seq[i];
            const r = groupReqs.find(req => req.id === stop.requestId);
            if (r) {
              if (stop.type === 'PICKUP') {
                smsLines.push(`${i + 1}. PICKUP ${stop.cropType} at ${r.order.listing.farmer.name} (${r.order.listing.farmer.phone})`);
              } else {
                smsLines.push(`${i + 1}. DROPOFF to ${r.order.buyer.name} (${r.order.buyer.phone})`);
              }
            }
          }
          const smsText = `Grouped Route: ${job.stopCount} stops, ${job.totalKm}km. Stops:\n${smsLines.join('\n')}`;
          await sendUssdSms(transporterPhone, smsText, 'ROUTE_DETAILS');

          return respond('END', `Route accepted!\n${groupReqs.length * 2} stops\n${job.totalKm}km total\nEarnings: GHS${job.totalEarn}\nSMS with stop details sent.`);
        } else {
          // Single job details
          const request = await prisma.deliveryRequest.findUnique({
            where: { id: job.id },
            include: {
              order: {
                include: {
                  listing: { include: { farmer: true } },
                  buyer: true
                }
              }
            }
          });
          if (request) {
            const smsText = `Delivery details:\n1. PICKUP ${request.order.listing.cropType} at ${request.order.listing.farmer.name} (${request.order.listing.farmer.phone})\n2. DROPOFF to ${request.order.buyer.name} (${request.order.buyer.phone})\nEarnings: GHS ${request.estimatedCost}`;
            await sendUssdSms(transporterPhone, smsText, 'DELIVERY_DETAILS');
          }

          return respond('END', `Job accepted!\nFarmer and Buyer will be notified.\nEarnings: GHS${job.earn}\nSMS details sent.`);
        }
      } catch (err: any) {
        console.error('Error accepting delivery:', err);
        return respond('END', `Accept failed: ${err.message || 'Server error'}`);
      }
    }

    return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
  }

  return respond('END', t(lang, 'invalid_session'));
}

/**
 * PATH 2: My Active Route
 */
async function handleActiveRouteMenu(session: any, input: string, lang: string, step: string): Promise<string> {
  const transporterId = session.userId;

  const { stops, currentStopIndex, rawRequests } = await getStopsInfo(transporterId);

  if (step === 'VIEW') {
    if (stops.length === 0) {
      if (input === '') {
        return respond('CON', `You have no active route.\n0. Back`);
      }
      if (input === '0') {
        const updated = await popMenu(session);
        return await handleMainMenu(updated, '', lang);
      }
      return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
    }

    const currentStopInfo = stops[currentStopIndex];
    const stop = currentStopInfo.stop;
    const req = rawRequests.find(r => r.id === stop.requestId);

    if (input === '') {
      const etaStr = req?.eta
        ? new Date(req.eta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'N/A';

      const typeLabel = stop.type === 'PICKUP' ? 'Pickup' : 'Dropoff';
      const text = `Active route:\nStop ${currentStopIndex + 1}/${stops.length}\nNext: ${typeLabel} - ${stop.cropType}\nETA: ${etaStr}\n\n1. I have arrived\n2. Mark complete\n3. See all stops\n0. Back`;
      return respond('CON', text);
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handleMainMenu(updated, '', lang);
    }

    if (input === '1') {
      // Arrived flow
      try {
        await DeliveryService.updateStopStatus(stop.requestId, transporterId, 'ARRIVED');
        const updated = await pushMenu(session, 'TRANSPORT_ACTIVE_ROUTE', 'ARRIVED_CONFIRM');
        return await handleActiveRouteMenu(updated, '', lang, 'ARRIVED_CONFIRM');
      } catch (err: any) {
        console.error('Error in Arrived status update:', err);
        return respond('END', `Failed to mark arrival: ${err.message || 'Server error'}`);
      }
    }

    if (input === '2') {
      // Direct completion confirmation screen
      const updated = await pushMenu(session, 'TRANSPORT_ACTIVE_ROUTE', 'COMPLETE_CONFIRM');
      return await handleActiveRouteMenu(updated, '', lang, 'COMPLETE_CONFIRM');
    }

    if (input === '3') {
      // See all stops
      const updated = await pushMenu(session, 'TRANSPORT_ACTIVE_ROUTE', 'STOPS_LIST');
      return await handleActiveRouteMenu(updated, '', lang, 'STOPS_LIST');
    }

    return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
  }

  if (step === 'ARRIVED_CONFIRM') {
    if (input === '') {
      return respond('CON', `Marked arrived at stop ${currentStopIndex + 1}.\n1. Mark as complete\n0. Back`);
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handleActiveRouteMenu(updated, '', lang, 'VIEW');
    }

    if (input === '1') {
      const updated = await pushMenu(session, 'TRANSPORT_ACTIVE_ROUTE', 'COMPLETE_CONFIRM');
      return await handleActiveRouteMenu(updated, '', lang, 'COMPLETE_CONFIRM');
    }

    return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
  }

  if (step === 'COMPLETE_CONFIRM') {
    const currentStopInfo = stops[currentStopIndex];
    const stop = currentStopInfo.stop;
    const req = rawRequests.find(r => r.id === stop.requestId);
    if (!req) return respond('END', t(lang, 'generic_error'));

    if (input === '') {
      const typeLabel = stop.type === 'PICKUP' ? 'PICKUP' : 'DELIVERY';
      return respond('CON', `Confirm completing ${typeLabel} of ${stop.cropType}?\n\n1. Confirm\n0. Cancel`);
    }

    if (input === '0') {
      // Pop back twice if we were in arrived confirm, else once
      const updated = await popMenu(session);
      if (updated.currentStep === 'ARRIVED_CONFIRM') {
        const doubleUpdated = await popMenu(updated);
        return await handleActiveRouteMenu(doubleUpdated, '', lang, 'VIEW');
      }
      return await handleActiveRouteMenu(updated, '', lang, 'VIEW');
    }

    if (input === '1') {
      try {
        const newStatus = stop.type === 'PICKUP' ? DeliveryStatus.PICKED_UP : DeliveryStatus.DELIVERED;
        await DeliveryService.updateDeliveryStatus(stop.requestId, newStatus, transporterId);

        if (stop.type === 'PICKUP') {
          // Send confirmations to farmer + buyer
          const farmerPhone = req.order.listing.farmer.phone;
          const buyerPhone = req.order.buyer.phone;
          await sendUssdSms(farmerPhone, `AgriConnect: Farmer ${req.order.listing.farmer.name}, your ${stop.cropType} has been picked up.`, 'DELIVERY_PICKED_UP');
          await sendUssdSms(buyerPhone, `AgriConnect: Buyer ${req.order.buyer.name}, your ${stop.cropType} order is on the way.`, 'DELIVERY_PICKED_UP');

          // Look up next stop
          const nextIndex = currentStopIndex + 1;
          if (nextIndex < stops.length) {
            const nextStopInfo = stops[nextIndex];
            const nextReq = rawRequests.find(r => r.id === nextStopInfo.stop.requestId);
            const nextType = nextStopInfo.stop.type === 'PICKUP' ? 'Pickup' : 'Dropoff';
            const nextDistrict = nextStopInfo.stop.type === 'PICKUP'
              ? nextReq?.order.listing.farmer.district
              : nextReq?.order.buyer.district;

            const nextEtaStr = nextReq?.eta
              ? new Date(nextReq.eta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'N/A';

            return respond('END', `Pickup confirmed!\nNext: ${nextType}\n${nextStopInfo.stop.cropType} at ${nextDistrict || 'Destination'}\nETA: ${nextEtaStr}`);
          }

          return respond('END', `Pickup confirmed! Cargo is in transit.`);
        } else {
          // Dropoff completed
          const remaining = stops.length - (currentStopIndex + 1);
          return respond('END', `Delivery confirmed!\nGHS${req.estimatedCost} earned on this stop.\n${remaining} stops remaining.`);
        }
      } catch (err: any) {
        console.error('Error completing stop:', err);
        return respond('END', `Failed to complete stop: ${err.message || 'Server error'}`);
      }
    }

    return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
  }

  if (step === 'STOPS_LIST') {
    if (input === '') {
      const lines = stops.map((si, idx) => {
        const prefix = si.isCompleted ? '✓' : (idx === currentStopIndex ? '→' : '·');
        const stopTypeLabel = si.stop.type === 'PICKUP' ? 'Pickup' : 'Dropoff';
        const req = rawRequests.find(r => r.id === si.stop.requestId);
        const name = si.stop.type === 'PICKUP' ? req?.order.listing.farmer.name : req?.order.buyer.name;
        const statusLabel = si.isCompleted ? 'done' : (idx === currentStopIndex ? 'next' : 'pending');

        return `${idx + 1}. ${prefix} ${stopTypeLabel} - ${name} (${statusLabel})`;
      });

      return respond('CON', `All stops:\n${lines.join('\n')}\n0. Back`);
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handleActiveRouteMenu(updated, '', lang, 'VIEW');
    }

    return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
  }

  return respond('END', t(lang, 'invalid_session'));
}

/**
 * PATH 3: Toggle Availability
 */
async function handleToggleAvailability(session: any, input: string, lang: string, step: string): Promise<string> {
  const transporterId = session.userId;

  const profile = await prisma.transportProfile.findUnique({
    where: { userId: transporterId }
  });

  if (!profile) return respond('END', t(lang, 'generic_error'));

  if (input === '') {
    const statusLabel = profile.isAvailable ? 'AVAILABLE' : 'BUSY';
    return respond('CON', `You are currently: ${statusLabel}\n\n1. Set Available\n2. Set Busy\n0. Back`);
  }

  if (input === '0') {
    const updated = await popMenu(session);
    return await handleMainMenu(updated, '', lang);
  }

  if (input === '1') {
    await prisma.transportProfile.update({
      where: { userId: transporterId },
      data: { isAvailable: true }
    });
    return respond('END', `Availability updated: Set to AVAILABLE.`);
  }

  if (input === '2') {
    await prisma.transportProfile.update({
      where: { userId: transporterId },
      data: { isAvailable: false }
    });
    return respond('END', `Availability updated: Set to BUSY.`);
  }

  return respond('CON', `${t(lang, 'invalid_selection')}\n0. Back`);
}

/**
 * PATH 4: My Earnings
 */
async function handleEarnings(session: any, input: string, lang: string, step: string): Promise<string> {
  const transporterId = session.userId;

  if (step === 'SUMMARY') {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Monthly Earnings (transporter)
    const monthlyDeliveries = await prisma.deliveryRequest.findMany({
      where: {
        transportProviderId: transporterId,
        status: DeliveryStatus.DELIVERED,
        updatedAt: { gte: startOfMonth }
      }
    });
    const monthly = monthlyDeliveries.reduce((sum, d) => sum + (d.estimatedCost || 0), 0);

    // Total Earnings
    const totalDeliveries = await prisma.deliveryRequest.findMany({
      where: {
        transportProviderId: transporterId,
        status: DeliveryStatus.DELIVERED
      }
    });
    const total = totalDeliveries.reduce((sum, d) => sum + (d.estimatedCost || 0), 0);

    // Pending Earnings
    const pendingDeliveries = await prisma.deliveryRequest.findMany({
      where: {
        transportProviderId: transporterId,
        status: { in: [DeliveryStatus.MATCHED, DeliveryStatus.PICKED_UP] }
      }
    });
    const pending = pendingDeliveries.reduce((sum, d) => sum + (d.estimatedCost || 0), 0);

    if (input === '') {
      return respond('CON', `Earnings summary:\nThis month: GHS ${monthly.toFixed(2)}\nTotal: GHS ${total.toFixed(2)}\nPending: GHS ${pending.toFixed(2)}\n\n1. Withdraw\n2. Transaction history\n0. Back`);
    }

    if (input === '1') {
      const updated = await pushMenu(session, 'TRANSPORT_EARNINGS', 'WITHDRAW', { availableEarnings: total });
      return await handleEarnings(updated, '', lang, 'WITHDRAW');
    }

    if (input === '2') {
      const updated = await pushMenu(session, 'TRANSPORT_EARNINGS', 'HISTORY');
      return await handleEarnings(updated, '', lang, 'HISTORY');
    }

    if (input === '0') {
      const updated = await popMenu(session);
      return await handleMainMenu(updated, '', lang);
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

      await PaymentService.initiateWithdrawal(transporterId, phone, available);
      await prisma.ussdSession.update({
        where: { id: session.id },
        data: { tempData: {} }
      });
      return respond('END', `Withdrawal of GHS ${available.toFixed(2)} initiated.\nYou will receive an MoMo prompt shortly.`);
    }

    if (input === '2') {
      const updated = await pushMenu(session, 'TRANSPORT_EARNINGS', 'WITHDRAW_AMOUNT');
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

    const updated = await pushMenu(session, 'TRANSPORT_EARNINGS', 'WITHDRAW_CONFIRM', { withdrawAmount: amount });
    return await handleEarnings(updated, '', lang, 'WITHDRAW_CONFIRM');
  }

  if (step === 'WITHDRAW_CONFIRM') {
    const amount = session.tempData.withdrawAmount;
    const phone = session.user?.phone || '';

    if (input === '') {
      return respond('CON', `Confirm withdraw of GHS ${amount.toFixed(2)} to ${phone}?\n1. Yes\n0. Cancel`);
    }

    if (input === '1') {
      await PaymentService.initiateWithdrawal(transporterId, phone, amount);
      await prisma.ussdSession.update({
        where: { id: session.id },
        data: { tempData: {} }
      });
      return respond('END', `Withdrawal of GHS ${amount.toFixed(2)} initiated.\nYou will receive an MoMo prompt shortly.`);
    }

    const updated = await popMenu(session); // pop confirm
    const doubleUpdated = await popMenu(updated); // pop amount entry
    return await handleEarnings(doubleUpdated, '', lang, 'WITHDRAW');
  }

  if (step === 'HISTORY') {
    const completedDeliveries = await prisma.deliveryRequest.findMany({
      where: { transportProviderId: transporterId, status: DeliveryStatus.DELIVERED },
      include: {
        order: {
          include: {
            listing: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: 5
    });

    if (input === '') {
      if (completedDeliveries.length === 0) {
        return respond('CON', `No transaction history found.\n0. Back`);
      }

      const lines = completedDeliveries.map(d => {
        return `+GHS ${(d.estimatedCost || 0).toFixed(2)} - Job: ${d.order.listing.cropType}`;
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
