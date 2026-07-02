import { Router, Request, Response } from 'express';
import prisma from '../prisma/client';
import { normalizePhone } from '../services/auth.service';
import { ListingService } from '../services/listing.service';
import { config } from '../config';
import { CropType, ListingStatus, OrderStatus, Role } from '../prisma/generated-client';
import AfricasTalking = require('africastalking');

const router = Router();

/**
 * Utility helper to send replying SMS.
 */
async function replySms(to: string, message: string) {
  if (
    config.AFRICAS_TALKING_API_KEY &&
    config.AFRICAS_TALKING_API_KEY !== 'mock_africas_talking_api_key'
  ) {
    try {
      const at = AfricasTalking({
        apiKey: config.AFRICAS_TALKING_API_KEY,
        username: config.AFRICAS_TALKING_USERNAME || 'sandbox',
      });
      await at.SMS.send({ to: [to], message });
    } catch (error) {
      console.error('Failed to send inbound reply SMS:', error);
    }
  } else {
    console.log(`[SMS REPLY] to ${to}: ${message}`);
  }
}

/**
 * Public inbound SMS Webhook (Africa's Talking callback).
 * Receives: from, to, text, date
 */
router.post('/sms-inbound', async (req: Request, res: Response) => {
  const { from, text } = req.body;

  if (!from || text === undefined) {
    res.status(400).json({ error: 'Missing from or text body parameters.' });
    return;
  }

  const normalizedPhone = normalizePhone(from);
  const cleanText = text.trim();
  const tokens = cleanText.split(/\s+/);
  const command = tokens[0].toUpperCase();

  // 1. Fetch or create Farmer user
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

  try {
    // -------------------------------------------------------------
    // COMMAND: LIST <CROP> <QTY> <PRICE>
    // -------------------------------------------------------------
    if (command === 'LIST') {
      if (tokens.length < 4) {
        await replySms(
          normalizedPhone,
          'Invalid LIST format. Use: LIST <CROP> <QTY> <PRICE>. Example: LIST TOMATO 100 5'
        );
        res.status(200).json({ success: true });
        return;
      }

      const cropToken = tokens[1].toUpperCase().replace(/[^A-Z_]/g, '');
      let cropType: CropType | null = null;

      if (cropToken === 'TOMATO') cropType = CropType.TOMATO;
      else if (cropToken === 'PEPPER') cropType = CropType.PEPPER;
      else if (cropToken === 'GARDEN_EGG' || cropToken === 'GARDENEGG') cropType = CropType.GARDEN_EGG;
      else if (cropToken === 'OKRA') cropType = CropType.OKRA;
      else if (cropToken === 'LEAFY_GREENS' || cropToken === 'LEAFYGREENS') cropType = CropType.LEAFY_GREENS;

      if (!cropType) {
        await replySms(
          normalizedPhone,
          'Invalid crop. Available crops: TOMATO, PEPPER, GARDEN_EGG, OKRA, LEAFY_GREENS'
        );
        res.status(200).json({ success: true });
        return;
      }

      const qty = parseFloat(tokens[2]);
      const price = parseFloat(tokens[3]);

      if (isNaN(qty) || qty <= 0 || isNaN(price) || price <= 0) {
        await replySms(normalizedPhone, 'Invalid quantity or price. Numbers must be greater than 0.');
        res.status(200).json({ success: true });
        return;
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

      await replySms(
        normalizedPhone,
        `Listed: ${qty}kg ${cropType} at GHS${price}/kg. Code: ${listing.batchCode}`
      );
      res.status(200).json({ success: true });
      return;
    }

    // -------------------------------------------------------------
    // COMMAND: STATUS
    // -------------------------------------------------------------
    if (command === 'STATUS') {
      const listings = await prisma.produceListing.findMany({
        where: { farmerId: farmerUser.id, status: ListingStatus.AVAILABLE },
        orderBy: { createdAt: 'desc' },
        take: 3,
      });

      if (listings.length === 0) {
        await replySms(normalizedPhone, 'You have no active listings.');
      } else {
        const summary = listings
          .map((l) => `${l.cropType} - ${l.remainingKg}kg at GHS${l.pricePerKg}/kg`)
          .join('\n');
        await replySms(normalizedPhone, `Your listings:\n${summary}`);
      }
      res.status(200).json({ success: true });
      return;
    }

    // -------------------------------------------------------------
    // COMMAND: ORDERS
    // -------------------------------------------------------------
    if (command === 'ORDERS') {
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
        await replySms(normalizedPhone, 'No pending orders.');
      } else {
        const summary = orders
          .map((o) => `${o.quantityKg}kg ${o.listing.cropType} - ${o.status} - Call: ${o.buyer.phone}`)
          .join('\n');
        await replySms(normalizedPhone, `Pending orders:\n${summary}`);
      }
      res.status(200).json({ success: true });
      return;
    }

    // -------------------------------------------------------------
    // COMMAND: HELP
    // -------------------------------------------------------------
    if (command === 'HELP') {
      await replySms(normalizedPhone, 'Commands: LIST TOMATO 50 5 | STATUS | ORDERS | HELP');
      res.status(200).json({ success: true });
      return;
    }

    // -------------------------------------------------------------
    // UNRECOGNIZED COMMANDS
    // -------------------------------------------------------------
    await replySms(normalizedPhone, 'Unknown command. Send HELP for instructions.');
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Failed to process inbound SMS:', error);
    res.status(500).json({ error: 'Internal server error processing SMS.' });
  }
});

export default router;
