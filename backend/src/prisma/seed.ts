import prisma from './client';
import {
  Role,
  CropType,
  ListingStatus,
  QualityGrade,
  OrderStatus,
  PaymentStatus,
  DeliveryStatus,
  BusinessType,
  TraceEventType
} from './generated-client';
import { hashPassword } from '../utils/crypto';

async function main() {
  console.log('🌱 Starting AgriConnect database seed...');
  const defaultHash = hashPassword('password123');

  // 1. Clean existing records in dependency order
  await (prisma as any).spoilageRiskLog.deleteMany();
  await (prisma as any).flashSaleClaim.deleteMany();
  await (prisma as any).flashSaleNotification.deleteMany();
  await (prisma as any).flashSale.deleteMany();
  await prisma.review.deleteMany();
  await prisma.deliveryRequest.deleteMany();
  await prisma.preOrder.deleteMany();
  await prisma.order.deleteMany();
  await prisma.traceEvent.deleteMany();
  await prisma.traceabilityRecord.deleteMany();
  await prisma.produceListing.deleteMany();
  await prisma.plantingInput.deleteMany();
  await prisma.plantingLog.deleteMany();
  await prisma.farmerProfile.deleteMany();
  await prisma.buyerProfile.deleteMany();
  await prisma.transportProfile.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.message.deleteMany();
  await prisma.otpCode.deleteMany();
  await prisma.ussdSession.deleteMany();
  await prisma.userBan.deleteMany();
  await prisma.systemConfig.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();

  console.log('🧹 Cleaned existing database records.');

  // 2. Create Users & Profiles
  // Farmers located in the Eastern Region (Koforidua, Akropong, Somanya, Nkawkaw, Suhum, Nsawam)
  const farmersData = [
    { name: 'Kwame Boateng', phone: '+233241234567', region: 'Eastern', district: 'New Juaben South', lat: 6.0945, lng: -0.2591, size: 4.5, crops: ['TOMATO', 'PEPPER'] },
    { name: 'Abena Osei', phone: '+233241234568', region: 'Eastern', district: 'Akuapem North', lat: 5.9764, lng: -0.0847, size: 2.2, crops: ['OKRA', 'LEAFY_GREENS'] },
    { name: 'Kofi Mensah', phone: '+233241234569', region: 'Eastern', district: 'Yilo Krobo', lat: 6.1039, lng: -0.0150, size: 6.0, crops: ['GARDEN_EGG', 'TOMATO'] },
    { name: 'Akosua Agyei', phone: '+233241234570', region: 'Eastern', district: 'Kwahu West', lat: 6.5519, lng: -0.7675, size: 3.8, crops: ['PEPPER', 'OKRA'] },
    { name: 'Yaw Ansah', phone: '+233241234571', region: 'Eastern', district: 'Suhum', lat: 6.0384, lng: -0.4497, size: 5.0, crops: ['TOMATO', 'GARDEN_EGG'] },
    { name: 'Amma Serwaa', phone: '+233241234572', region: 'Eastern', district: 'Nsawam Adoagyiri', lat: 5.8083, lng: -0.3503, size: 1.5, crops: ['LEAFY_GREENS'] },
    { name: 'Kwadwo Kyei', phone: '+233241234573', region: 'Eastern', district: 'New Juaben South', lat: 6.0912, lng: -0.2604, size: 8.0, crops: ['TOMATO', 'PEPPER', 'OKRA'] },
    { name: 'Afua Poku', phone: '+233241234574', region: 'Eastern', district: 'Akuapem North', lat: 5.9712, lng: -0.0812, size: 3.0, crops: ['GARDEN_EGG'] },
    { name: 'Kwabena Addo', phone: '+233241234575', region: 'Eastern', district: 'Yilo Krobo', lat: 6.1011, lng: -0.0121, size: 4.0, crops: ['PEPPER'] },
    { name: 'Yaa Gyamfi', phone: '+233241234576', region: 'Eastern', district: 'Kwahu West', lat: 6.5501, lng: -0.7634, size: 2.5, crops: ['OKRA', 'TOMATO'] },
  ];

  const farmers: any[] = [];
  for (const f of farmersData) {
    const user = await prisma.user.create({
      data: {
        phone: f.phone,
        name: f.name,
        role: Role.FARMER,
        latitude: f.lat,
        longitude: f.lng,
        region: f.region,
        district: f.district,
        isVerified: true,
        passwordHash: defaultHash,
        farmerProfile: {
          create: {
            farmSizeAcres: f.size,
            primaryCrops: f.crops,
            avgRating: 4.2,
            totalReviews: 2,
          }
        }
      },
      include: { farmerProfile: true }
    });
    farmers.push(user);
  }
  console.log(`👨‍🌾 Created ${farmers.length} Farmers and profiles.`);

  // 2b. Seed Planting Logs and Inputs
  const plantingLogs: any[] = [];
  const logSetup = [
    // Completed harvests (for yield prediction calculations: TOMATO, PEPPER)
    { farmerIdx: 0, crop: CropType.TOMATO, acreage: 2.0, plantingOffset: 120, harvestOffset: 30, yield: 24000 }, // 12000 kg/acre
    { farmerIdx: 0, crop: CropType.TOMATO, acreage: 3.0, plantingOffset: 240, harvestOffset: 150, yield: 36000 }, // 12000 kg/acre
    { farmerIdx: 0, crop: CropType.PEPPER, acreage: 1.5, plantingOffset: 100, harvestOffset: 40, yield: 12000 }, // 8000 kg/acre
    // Active planting logs (can be linked to Listings)
    { farmerIdx: 0, crop: CropType.TOMATO, acreage: 2.5, plantingOffset: 85, harvestOffset: null, yield: null }, // idx 3
    { farmerIdx: 2, crop: CropType.TOMATO, acreage: 1.8, plantingOffset: 70, harvestOffset: null, yield: null }, // idx 4
    { farmerIdx: 0, crop: CropType.PEPPER, acreage: 1.0, plantingOffset: 65, harvestOffset: null, yield: null }, // idx 5
    { farmerIdx: 3, crop: CropType.OKRA, acreage: 1.2, plantingOffset: 55, harvestOffset: null, yield: null },  // idx 6
  ];

  const harvestBase = new Date();

  for (let idx = 0; idx < logSetup.length; idx++) {
    const spec = logSetup[idx];
    const farmer = farmers[spec.farmerIdx];
    const log = await prisma.plantingLog.create({
      data: {
        farmerId: farmer.id,
        cropType: spec.crop,
        acreage: spec.acreage,
        plantingDate: new Date(harvestBase.getTime() - spec.plantingOffset * 24 * 60 * 60 * 1000),
        expectedHarvestDate: new Date(harvestBase.getTime() - (spec.plantingOffset - 90) * 24 * 60 * 60 * 1000),
        actualHarvestDate: spec.harvestOffset ? new Date(harvestBase.getTime() - spec.harvestOffset * 24 * 60 * 60 * 1000) : null,
        actualYieldKg: spec.yield,
        notes: `Seeded field journal entry #${idx + 1}`,
      }
    });

    // Seed some inputs for each log
    await prisma.plantingInput.createMany({
      data: [
        { plantingLogId: log.id, type: 'FERTILIZER', name: 'Natures Organic Fertilizer', quantity: 2, unit: 'bags' },
        { plantingLogId: log.id, type: 'IRRIGATION', name: 'Drip system', quantity: 12, unit: 'hours' },
        { plantingLogId: log.id, type: 'PESTICIDE', name: 'Neem Oil spray', quantity: 500, unit: 'ml' },
      ]
    });

    plantingLogs.push(log);
  }
  console.log(`🌱 Seeded ${plantingLogs.length} Planting logs with associated inputs.`);

  // Buyers
  const buyersData = [
    { name: 'Grace Agro Retail', phone: '+233242234567', region: 'Greater Accra', district: 'Accra Metropolitan', lat: 5.6037, lng: -0.1870, biz: BusinessType.RETAILER },
    { name: 'John Chop Bar', phone: '+233242234568', region: 'Eastern', district: 'New Juaben South', lat: 6.0930, lng: -0.2580, biz: BusinessType.RESTAURANT },
    { name: 'Volta Foods', phone: '+233242234569', region: 'Eastern', district: 'Yilo Krobo', lat: 6.1020, lng: -0.0140, biz: BusinessType.PROCESSOR },
    { name: 'Royal Supermarket', phone: '+233242234570', region: 'Greater Accra', district: 'Accra Metropolitan', lat: 5.6010, lng: -0.1850, biz: BusinessType.EXPORTER },
    { name: 'Adjoa Household', phone: '+233242234571', region: 'Eastern', district: 'Akuapem North', lat: 5.9750, lng: -0.0830, biz: BusinessType.HOUSEHOLD },
  ];

  const buyers: any[] = [];
  for (const b of buyersData) {
    const user = await prisma.user.create({
      data: {
        phone: b.phone,
        name: b.name,
        role: Role.BUYER,
        latitude: b.lat,
        longitude: b.lng,
        region: b.region,
        district: b.district,
        isVerified: true,
        passwordHash: defaultHash,
        buyerProfile: {
          create: {
            businessType: b.biz,
            avgRating: 4.5,
            totalReviews: 1,
          }
        }
      },
      include: { buyerProfile: true }
    });
    buyers.push(user);
  }
  console.log(`💼 Created ${buyers.length} Buyers and profiles.`);

  // Transporters
  const transportersData = [
    { name: 'Kwame Logistics', phone: '+233243234567', region: 'Eastern', district: 'Suhum', lat: 6.0380, lng: -0.4490, vehicle: 'Tricycle (Aboboyaa)', capacity: 800.0, radius: 25.0 },
    { name: 'Emmanuel Trucking', phone: '+233243234568', region: 'Eastern', district: 'New Juaben South', lat: 6.0940, lng: -0.2590, vehicle: 'Kia Bongo Box Truck', capacity: 3000.0, radius: 60.0 },
    { name: 'Kojo Moto', phone: '+233243234569', region: 'Eastern', district: 'Yilo Krobo', lat: 6.1030, lng: -0.0150, vehicle: 'Motorbike with carrier', capacity: 150.0, radius: 15.0 },
  ];

  const transporters: any[] = [];
  for (const t of transportersData) {
    const user = await prisma.user.create({
      data: {
        phone: t.phone,
        name: t.name,
        role: Role.TRANSPORT,
        latitude: t.lat,
        longitude: t.lng,
        region: t.region,
        district: t.district,
        isVerified: true,
        passwordHash: defaultHash,
        transportProfile: {
          create: {
            vehicleType: t.vehicle,
            capacityKg: t.capacity,
            serviceRadiusKm: t.radius,
            isAvailable: true,
            avgRating: 4.8,
            totalReviews: 3,
          }
        }
      },
      include: { transportProfile: true }
    });
    transporters.push(user);
  }
  console.log(`🚚 Created ${transporters.length} Transporters and profiles.`);

  // Admin user
  const adminUser = await prisma.user.create({
    data: {
      phone: '+233241112223',
      name: 'System Admin',
      role: Role.ADMIN,
      isVerified: true,
      passwordHash: defaultHash,
    }
  });

  // Super Admin user
  const superAdminUser = await prisma.user.create({
    data: {
      phone: '+233999999999',
      name: 'Super Admin',
      role: Role.SUPERADMIN,
      isVerified: true,
      passwordHash: defaultHash,
    }
  });
  console.log('👑 Created Super Admin.');

  // System configurations seed
  await prisma.systemConfig.createMany({
    data: [
      {
        key: 'platform_fee_percent',
        value: '3.5',
        description: 'Default platform transaction fee in percentage',
        updatedBy: superAdminUser.id,
      },
      {
        key: 'delivery_base_fee_ghs',
        value: '15',
        description: 'Base delivery fee in GHS',
        updatedBy: superAdminUser.id,
      },
      {
        key: 'delivery_rate_per_km',
        value: '2.5',
        description: 'Delivery rate per kilometer in GHS',
        updatedBy: superAdminUser.id,
      },
      {
        key: 'max_listing_duration_days',
        value: '14',
        description: 'Maximum lifetime of a produce listing in days',
        updatedBy: superAdminUser.id,
      },
    ],
  });
  console.log('⚙️ Seeded system configurations.');

  // 3. Create Produce Listings (20 listings spread crops, prices, statuses)
  const cropsSetup = [
    { crop: CropType.TOMATO, price: 4.5, qty: 150, remaining: 150, status: ListingStatus.AVAILABLE, grade: QualityGrade.A, farmerIdx: 0, batch: 'BAT-TOM-001' },
    { crop: CropType.TOMATO, price: 3.2, qty: 200, remaining: 0, status: ListingStatus.SOLD_OUT, grade: QualityGrade.B, farmerIdx: 2, batch: 'BAT-TOM-002' },
    { crop: CropType.TOMATO, price: 5.0, qty: 100, remaining: 100, status: ListingStatus.AVAILABLE, grade: QualityGrade.A, farmerIdx: 4, batch: 'BAT-TOM-003' },
    { crop: CropType.TOMATO, price: 6.5, qty: 180, remaining: 180, status: ListingStatus.AVAILABLE, grade: QualityGrade.A, farmerIdx: 6, batch: 'BAT-TOM-004' },
    { crop: CropType.PEPPER, price: 8.0, qty: 80, remaining: 80, status: ListingStatus.AVAILABLE, grade: QualityGrade.A, farmerIdx: 0, batch: 'BAT-PEP-001' },
    { crop: CropType.PEPPER, price: 7.0, qty: 120, remaining: 0, status: ListingStatus.SOLD_OUT, grade: QualityGrade.B, farmerIdx: 3, batch: 'BAT-PEP-002' },
    { crop: CropType.PEPPER, price: 9.5, qty: 50, remaining: 50, status: ListingStatus.AVAILABLE, grade: QualityGrade.A, farmerIdx: 6, batch: 'BAT-PEP-003' },
    { crop: CropType.PEPPER, price: 5.5, qty: 150, remaining: 150, status: ListingStatus.AVAILABLE, grade: QualityGrade.C, farmerIdx: 8, batch: 'BAT-PEP-004' },
    { crop: CropType.GARDEN_EGG, price: 3.5, qty: 300, remaining: 300, status: ListingStatus.AVAILABLE, grade: QualityGrade.B, farmerIdx: 2, batch: 'BAT-GEG-001' },
    { crop: CropType.GARDEN_EGG, price: 4.0, qty: 180, remaining: 0, status: ListingStatus.SOLD_OUT, grade: QualityGrade.A, farmerIdx: 4, batch: 'BAT-GEG-002' },
    { crop: CropType.GARDEN_EGG, price: 3.0, qty: 250, remaining: 250, status: ListingStatus.AVAILABLE, grade: QualityGrade.C, farmerIdx: 7, batch: 'BAT-GEG-003' },
    { crop: CropType.OKRA, price: 6.0, qty: 90, remaining: 90, status: ListingStatus.AVAILABLE, grade: QualityGrade.A, farmerIdx: 1, batch: 'BAT-OKR-001' },
    { crop: CropType.OKRA, price: 5.0, qty: 110, remaining: 0, status: ListingStatus.SOLD_OUT, grade: QualityGrade.B, farmerIdx: 3, batch: 'BAT-OKR-002' },
    { crop: CropType.OKRA, price: 4.5, qty: 140, remaining: 140, status: ListingStatus.AVAILABLE, grade: QualityGrade.B, farmerIdx: 9, batch: 'BAT-OKR-003' },
    { crop: CropType.LEAFY_GREENS, price: 2.5, qty: 80, remaining: 80, status: ListingStatus.AVAILABLE, grade: QualityGrade.B, farmerIdx: 1, batch: 'BAT-LFG-001' },
    { crop: CropType.LEAFY_GREENS, price: 3.0, qty: 100, remaining: 0, status: ListingStatus.SOLD_OUT, grade: QualityGrade.A, farmerIdx: 5, batch: 'BAT-LFG-002' },
    { crop: CropType.OTHER, price: 12.0, qty: 50, remaining: 50, status: ListingStatus.AVAILABLE, grade: QualityGrade.A, farmerIdx: 6, batch: 'BAT-OTH-001' },
    { crop: CropType.TOMATO, price: 5.5, qty: 120, remaining: 120, status: ListingStatus.AVAILABLE, grade: QualityGrade.UNGRADED, farmerIdx: 9, batch: 'BAT-TOM-005' },
    { crop: CropType.PEPPER, price: 8.5, qty: 90, remaining: 90, status: ListingStatus.AVAILABLE, grade: QualityGrade.UNGRADED, farmerIdx: 8, batch: 'BAT-PEP-005' },
    { crop: CropType.GARDEN_EGG, price: 3.8, qty: 200, remaining: 200, status: ListingStatus.AVAILABLE, grade: QualityGrade.UNGRADED, farmerIdx: 7, batch: 'BAT-GEG-004' },
  ];

  const listings: any[] = [];
  for (let i = 0; i < cropsSetup.length; i++) {
    const c = cropsSetup[i];
    const farmer = farmers[c.farmerIdx];

    // Guarantee at least 3 listings have expiryEstimate within 48 hours
    let expiry = new Date(harvestBase.getTime() + 10 * 24 * 60 * 60 * 1000);
    if (i === 0 || i === 4 || i === 8) {
      expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // Expires in 24 hours
    }

    let plantingLogId: string | null = null;
    let inputsUsed = ['Natures Organic Fertilizer', 'Rainwater irrigation'];
    let plantingDate = new Date(harvestBase.getTime() - 90 * 24 * 60 * 60 * 1000);

    if (i === 0) {
      plantingLogId = plantingLogs[3].id;
      plantingDate = plantingLogs[3].plantingDate;
      inputsUsed = ['FERTILIZER: Natures Organic Fertilizer (2 bags)', 'IRRIGATION: Drip system (12 hours)', 'PESTICIDE: Neem Oil spray (500 ml)'];
    } else if (i === 1) {
      plantingLogId = plantingLogs[4].id;
      plantingDate = plantingLogs[4].plantingDate;
      inputsUsed = ['FERTILIZER: Natures Organic Fertilizer (2 bags)', 'IRRIGATION: Drip system (12 hours)', 'PESTICIDE: Neem Oil spray (500 ml)'];
    } else if (i === 4) {
      plantingLogId = plantingLogs[5].id;
      plantingDate = plantingLogs[5].plantingDate;
      inputsUsed = ['FERTILIZER: Natures Organic Fertilizer (2 bags)', 'IRRIGATION: Drip system (12 hours)', 'PESTICIDE: Neem Oil spray (500 ml)'];
    } else if (i === 14) {
      plantingLogId = plantingLogs[6].id;
      plantingDate = plantingLogs[6].plantingDate;
      inputsUsed = ['FERTILIZER: Natures Organic Fertilizer (2 bags)', 'IRRIGATION: Drip system (12 hours)', 'PESTICIDE: Neem Oil spray (500 ml)'];
    }

    const listing = await prisma.produceListing.create({
      data: {
        farmerId: farmer.id,
        cropType: c.crop,
        quantityKg: c.qty,
        remainingKg: c.remaining,
        pricePerKg: c.price,
        images: ['https://example.com/crop.jpg'],
        harvestDate: new Date(harvestBase.getTime() - 2 * 24 * 60 * 60 * 1000),
        expiryEstimate: expiry,
        qualityGrade: c.grade,
        qualityGradeSource: c.grade === QualityGrade.UNGRADED ? 'UNGRADED' : 'AI',
        status: c.status,
        latitude: farmer.latitude!,
        longitude: farmer.longitude!,
        batchCode: c.batch,
        plantingLogId,
        traceability: {
          create: {
            plantingDate,
            inputsUsed,
            qualityCheckImages: ['https://example.com/quality.jpg']
          }
        }
      }
    });

    // Create Listing trace event log
    await prisma.traceEvent.create({
      data: {
        listingId: listing.id,
        eventType: TraceEventType.LISTED,
        latitude: listing.latitude,
        longitude: listing.longitude,
        recordedByUserId: farmer.id,
        notes: `Batch registered: ${listing.quantityKg}kg of ${listing.cropType}`,
      }
    });

    listings.push(listing);
  }
  console.log(`🍅 Seeded ${listings.length} Produce Listings and Traceability details.`);

  // 4. Create Orders (Including 5 DELIVERED completed flow orders, and 2 IN_TRANSIT orders)
  const ordersSetup = [
    { buyerIdx: 0, listingIdx: 0, qty: 50, status: OrderStatus.PENDING, payment: PaymentStatus.UNPAID },
    { buyerIdx: 1, listingIdx: 1, qty: 200, status: OrderStatus.DELIVERED, payment: PaymentStatus.PAID },
    { buyerIdx: 2, listingIdx: 2, qty: 30, status: OrderStatus.CONFIRMED, payment: PaymentStatus.PAID },
    { buyerIdx: 3, listingIdx: 5, qty: 120, status: OrderStatus.DELIVERED, payment: PaymentStatus.PAID },
    { buyerIdx: 4, listingIdx: 6, qty: 20, status: OrderStatus.CANCELLED, payment: PaymentStatus.UNPAID },
    { buyerIdx: 0, listingIdx: 9, qty: 180, status: OrderStatus.DELIVERED, payment: PaymentStatus.PAID },
    { buyerIdx: 2, listingIdx: 12, qty: 110, status: OrderStatus.DELIVERED, payment: PaymentStatus.PAID },
    { buyerIdx: 1, listingIdx: 15, qty: 100, status: OrderStatus.DELIVERED, payment: PaymentStatus.PAID },
    // 2 orders in IN_TRANSIT status
    { buyerIdx: 0, listingIdx: 3, qty: 40, status: OrderStatus.IN_TRANSIT, payment: PaymentStatus.PAID },
    { buyerIdx: 1, listingIdx: 7, qty: 50, status: OrderStatus.IN_TRANSIT, payment: PaymentStatus.PAID },
  ];

  const orders: any[] = [];
  for (const o of ordersSetup) {
    const buyer = buyers[o.buyerIdx];
    const listing = listings[o.listingIdx];
    const totalPrice = o.qty * listing.pricePerKg;

    const order = await prisma.order.create({
      data: {
        buyerId: buyer.id,
        listingId: listing.id,
        quantityKg: o.qty,
        totalPrice: totalPrice,
        status: o.status,
        paymentStatus: o.payment,
      }
    });

    // Create TraceEvents for status changes
    if (
      o.status === OrderStatus.CONFIRMED ||
      o.status === OrderStatus.IN_TRANSIT ||
      o.status === OrderStatus.DELIVERED
    ) {
      await prisma.traceEvent.create({
        data: {
          listingId: listing.id,
          eventType: TraceEventType.RESERVED,
          latitude: listing.latitude,
          longitude: listing.longitude,
          recordedByUserId: buyer.id,
          notes: `Batch reserved by buyer order ${order.id.slice(0, 8)}`,
        }
      });
    }

    if (o.status === OrderStatus.IN_TRANSIT || o.status === OrderStatus.DELIVERED) {
      // Picked up
      await prisma.traceEvent.create({
        data: {
          listingId: listing.id,
          eventType: TraceEventType.PICKED_UP,
          latitude: listing.latitude,
          longitude: listing.longitude,
          recordedByUserId: transporters[0].id,
          notes: `Cargo picked up by courier (in transit)`,
        }
      });
    }

    if (o.status === OrderStatus.DELIVERED) {
      // Delivered
      await prisma.traceEvent.create({
        data: {
          listingId: listing.id,
          eventType: TraceEventType.DELIVERED,
          latitude: buyer.latitude!,
          longitude: buyer.longitude!,
          recordedByUserId: buyer.id,
          notes: `Delivery completed successfully`,
        }
      });
    }

    // Set up Delivery Request
    if (o.status === OrderStatus.DELIVERED || o.status === OrderStatus.CONFIRMED) {
      const transporter = transporters[o.buyerIdx % transporters.length];
      await prisma.deliveryRequest.create({
        data: {
          orderId: order.id,
          transportProviderId: transporter.id,
          pickupLatitude: listing.latitude,
          pickupLongitude: listing.longitude,
          dropoffLatitude: buyer.latitude!,
          dropoffLongitude: buyer.longitude!,
          scheduledPickup: new Date(harvestBase.getTime() + 1 * 24 * 60 * 60 * 1000),
          scheduledDropoff: new Date(harvestBase.getTime() + 2 * 24 * 60 * 60 * 1000),
          estimatedCost: 120.0,
          status: o.status === OrderStatus.DELIVERED ? DeliveryStatus.DELIVERED : DeliveryStatus.MATCHED,
          routeGroupId: 'rg-' + order.id.slice(0, 8),
        }
      });
    } else if (o.status === OrderStatus.IN_TRANSIT) {
      const transporter = transporters[o.buyerIdx % transporters.length];
      await prisma.deliveryRequest.create({
        data: {
          orderId: order.id,
          transportProviderId: transporter.id,
          pickupLatitude: listing.latitude,
          pickupLongitude: listing.longitude,
          dropoffLatitude: buyer.latitude!,
          dropoffLongitude: buyer.longitude!,
          scheduledPickup: new Date(harvestBase.getTime() + 1 * 24 * 60 * 60 * 1000),
          scheduledDropoff: new Date(harvestBase.getTime() + 2 * 24 * 60 * 60 * 1000),
          estimatedCost: 110.0,
          status: DeliveryStatus.PICKED_UP,
        }
      });
    } else if (o.status === OrderStatus.PENDING) {
      await prisma.deliveryRequest.create({
        data: {
          orderId: order.id,
          pickupLatitude: listing.latitude,
          pickupLongitude: listing.longitude,
          dropoffLatitude: buyer.latitude!,
          dropoffLongitude: buyer.longitude!,
          estimatedCost: 80.0,
          status: DeliveryStatus.REQUESTED,
        }
      });
    }

    orders.push(order);
  }
  console.log(`📦 Seeded ${orders.length} Orders (including 5 DELIVERED and 2 IN_TRANSIT) and associated DeliveryRequests.`);

  // 5. Create Reviews (5 reviews, only on DELIVERED orders)
  const deliveredOrders = orders.filter((o) => o.status === OrderStatus.DELIVERED);
  const reviewsSetup = [
    { rating: 5, comment: 'Superb okra, very fresh and well handled!' },
    { rating: 5, comment: 'Excellent tomatoes, fast shipping.' },
    { rating: 4, comment: 'Pungent habanero peppers. Will order again.' },
    { rating: 5, comment: 'Great garden eggs, nice grade.' },
    { rating: 5, comment: 'Fresh leafy greens, great packaging.' },
  ];

  let reviewCount = 0;
  for (let i = 0; i < Math.min(deliveredOrders.length, reviewsSetup.length); i++) {
    const order = deliveredOrders[i];
    const dbOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: { listing: true }
    });

    if (dbOrder) {
      await prisma.review.create({
        data: {
          fromUserId: dbOrder.buyerId,
          toUserId: dbOrder.listing.farmerId,
          orderId: dbOrder.id,
          rating: reviewsSetup[i].rating,
          comment: reviewsSetup[i].comment,
        }
      });
      reviewCount++;
    }
  }
  console.log(`⭐ Seeded ${reviewCount} Reviews on completed orders.`);

  // 6. Seed Pre-Orders (demand signals)
  const now = new Date();
  const preOrdersSetup = [
    // OPEN: 3 buyers seeking upcoming harvests
    {
      buyerIdx: 0, crop: CropType.TOMATO, qty: 200, maxPrice: 5.5,
      region: 'Eastern',
      start: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      end: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
      depositPaid: true, status: 'OPEN' as const,
      notes: 'Need for retail distribution to Accra markets',
    },
    {
      buyerIdx: 1, crop: CropType.PEPPER, qty: 80, maxPrice: 9.0,
      region: null,
      start: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000),
      end: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000),
      depositPaid: true, status: 'OPEN' as const,
      notes: 'Chop bar weekly supply',
    },
    {
      buyerIdx: 2, crop: CropType.GARDEN_EGG, qty: 150, maxPrice: 4.2,
      region: 'Eastern',
      start: new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000),
      end: new Date(now.getTime() + 100 * 24 * 60 * 60 * 1000),
      depositPaid: true, status: 'OPEN' as const,
      notes: 'Processing facility bulk purchase',
    },
    // DEPOSIT_PENDING: buyer created but hasn't paid yet
    {
      buyerIdx: 3, crop: CropType.OKRA, qty: 60, maxPrice: 6.5,
      region: null,
      start: new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000),
      end: new Date(now.getTime() + 70 * 24 * 60 * 60 * 1000),
      depositPaid: false, status: 'DEPOSIT_PENDING' as const,
      notes: null,
    },
    // MATCHED: linked to existing listings
    {
      buyerIdx: 0, crop: CropType.TOMATO, qty: 50, maxPrice: 7.0,
      region: 'Eastern',
      start: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      end: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      depositPaid: true, status: 'MATCHED' as const,
      matchedListingIdx: 0,
      notes: null,
    },
    // CANCELLED: buyer changed their mind
    {
      buyerIdx: 4, crop: CropType.LEAFY_GREENS, qty: 40, maxPrice: 3.5,
      region: null,
      start: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
      end: new Date(now.getTime() + 50 * 24 * 60 * 60 * 1000),
      depositPaid: false, status: 'CANCELLED' as const,
      notes: 'Changed sourcing plans',
    },
    // EXPIRED: harvest window has passed
    {
      buyerIdx: 1, crop: CropType.TOMATO, qty: 100, maxPrice: 4.0,
      region: 'Eastern',
      start: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
      end: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      depositPaid: true, status: 'EXPIRED' as const,
      notes: null,
    },
  ];

  let preOrderCount = 0;
  for (const p of preOrdersSetup) {
    const buyer = buyers[p.buyerIdx];
    const depositAmount = parseFloat((p.qty * p.maxPrice * 0.20).toFixed(2));
    const matchedListingId = (p as any).matchedListingIdx !== undefined
      ? listings[(p as any).matchedListingIdx].id
      : null;

    await prisma.preOrder.create({
      data: {
        buyerId: buyer.id,
        cropType: p.crop,
        quantityKg: p.qty,
        maxPricePerKg: p.maxPrice,
        preferredRegion: p.region,
        harvestWindowStart: p.start,
        harvestWindowEnd: p.end,
        notes: p.notes,
        depositAmount,
        depositPaid: p.depositPaid,
        paystackReference: p.depositPaid ? `PRE-seed-${preOrderCount}-${Date.now()}` : null,
        status: p.status,
        matchedListingId,
      },
    });
    preOrderCount++;
  }
  console.log(`🛒 Seeded ${preOrderCount} Pre-Orders (demand signals).`);

  // 6.5. Seed Spoilage Risk and Flash Sales
  console.log('🌾 Seeding Spoilage Flash Sales & Risk Logs...');

  // Get referenced IDs
  const seedFarmer = await prisma.user.findFirst({ where: { role: Role.FARMER } });
  const seedBuyer = await prisma.user.findFirst({ where: { role: Role.BUYER } });
  
  if (!seedFarmer || !seedBuyer) {
    throw new Error('Farmer or Buyer not found for seeding flash sales');
  }

  // Create 3 listings with expiryEstimate within 12 hours, status=AVAILABLE
  const listingsToCreate = [
    {
      cropType: CropType.TOMATO,
      quantityKg: 100,
      pricePerKg: 10,
      hoursOffset: 4,
      currentRiskBand: 'CRITICAL',
      currentRiskScore: 92.5,
    },
    {
      cropType: CropType.PEPPER,
      quantityKg: 200,
      pricePerKg: 15,
      hoursOffset: 6,
      currentRiskBand: 'CRITICAL',
      currentRiskScore: 88.0,
    },
    {
      cropType: CropType.GARDEN_EGG,
      quantityKg: 150,
      pricePerKg: 8,
      hoursOffset: 9,
      currentRiskBand: 'CRITICAL',
      currentRiskScore: 82.0,
    },
  ];

  const spawnedListings: any[] = [];
  let listingIdx = 1;
  for (const item of listingsToCreate) {
    const list = await prisma.produceListing.create({
      data: {
        farmerId: seedFarmer.id,
        cropType: item.cropType,
        quantityKg: item.quantityKg,
        remainingKg: item.quantityKg,
        pricePerKg: item.pricePerKg,
        harvestDate: new Date(Date.now() - 48 * 60 * 60 * 1000),
        expiryEstimate: new Date(Date.now() + item.hoursOffset * 60 * 60 * 1000),
        qualityGrade: QualityGrade.B,
        qualityGradeSource: 'AI',
        status: ListingStatus.AVAILABLE,
        latitude: seedFarmer.latitude || 6.0945,
        longitude: seedFarmer.longitude || -0.2591,
        batchCode: `BAT-FLASH-00${listingIdx}`,
        source: 'WEB',
        currentRiskBand: item.currentRiskBand as any,
        currentRiskScore: item.currentRiskScore,
        lastRiskCalculatedAt: new Date(),
      },
    });
    spawnedListings.push(list);
    listingIdx++;

    // Seed SpoilageRiskLog
    await (prisma as any).spoilageRiskLog.create({
      data: {
        listingId: list.id,
        previousBand: 'HIGH',
        newBand: item.currentRiskBand as any,
        riskScore: item.currentRiskScore,
        hoursUntilExpiry: item.hoursOffset,
        remainingKg: item.quantityKg,
        triggeredFlashSale: true,
      },
    });
  }

  // Create 2 FlashSale records in ACTIVE status
  const sale1 = await (prisma as any).flashSale.create({
    data: {
      listingId: spawnedListings[0].id,
      farmerId: seedFarmer.id,
      originalPricePerKg: 10,
      discountPercent: 30,
      flashPricePerKg: 7,
      quantityKg: 100,
      soldKg: 40,
      riskBand: 'CRITICAL',
      riskScore: 92.5,
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
      farmerApproved: true,
      notificationsSent: 1,
      buyersClaimed: 1,
    },
  });

  await (prisma as any).flashSaleClaim.create({
    data: {
      flashSaleId: sale1.id,
      buyerId: seedBuyer.id,
      quantityKg: 40,
      pricePerKg: 7,
      totalPrice: 280,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  const sale2 = await (prisma as any).flashSale.create({
    data: {
      listingId: spawnedListings[1].id,
      farmerId: seedFarmer.id,
      originalPricePerKg: 15,
      discountPercent: 40,
      flashPricePerKg: 9,
      quantityKg: 200,
      soldKg: 110,
      riskBand: 'CRITICAL',
      riskScore: 88.0,
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
      farmerApproved: true,
      notificationsSent: 2,
      buyersClaimed: 2,
    },
  });

  await (prisma as any).flashSaleClaim.create({
    data: {
      flashSaleId: sale2.id,
      buyerId: seedBuyer.id,
      quantityKg: 50,
      pricePerKg: 9,
      totalPrice: 450,
      status: 'CONFIRMED',
      expiresAt: new Date(Date.now() - 5 * 60 * 1000),
    },
  });

  const seedBuyer2 = await prisma.user.findFirst({
    where: { role: Role.BUYER, id: { not: seedBuyer.id } },
  });
  if (seedBuyer2) {
    await (prisma as any).flashSaleClaim.create({
      data: {
        flashSaleId: sale2.id,
        buyerId: seedBuyer2.id,
        quantityKg: 60,
        pricePerKg: 9,
        totalPrice: 540,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
  }

  // Create 1 FlashSale record in EXPIRED status
  const expiredListing = await prisma.produceListing.create({
    data: {
      farmerId: seedFarmer.id,
      cropType: CropType.OKRA,
      quantityKg: 80,
      remainingKg: 80,
      pricePerKg: 6,
      harvestDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      expiryEstimate: new Date(Date.now() - 2 * 60 * 60 * 1000),
      qualityGrade: QualityGrade.C,
      qualityGradeSource: 'MANUAL',
      status: ListingStatus.EXPIRED,
      latitude: seedFarmer.latitude || 6.0945,
      longitude: seedFarmer.longitude || -0.2591,
      batchCode: `BAT-FLASH-EXP`,
      source: 'WEB',
      currentRiskBand: 'CRITICAL',
      currentRiskScore: 100,
    },
  });

  await (prisma as any).flashSale.create({
    data: {
      listingId: expiredListing.id,
      farmerId: seedFarmer.id,
      originalPricePerKg: 6,
      discountPercent: 50,
      flashPricePerKg: 3,
      quantityKg: 80,
      soldKg: 0,
      riskBand: 'CRITICAL',
      riskScore: 100,
      status: 'EXPIRED',
      expiresAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      farmerApproved: false,
    },
  });

  // Create 1 FlashSale record in SOLD status
  const soldListing = await prisma.produceListing.create({
    data: {
      farmerId: seedFarmer.id,
      cropType: CropType.TOMATO,
      quantityKg: 120,
      remainingKg: 0,
      pricePerKg: 12,
      harvestDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      expiryEstimate: new Date(Date.now() + 10 * 60 * 1000),
      qualityGrade: QualityGrade.A,
      qualityGradeSource: 'AI',
      status: ListingStatus.SOLD_OUT,
      latitude: seedFarmer.latitude || 6.0945,
      longitude: seedFarmer.longitude || -0.2591,
      batchCode: `BAT-FLASH-SOLD`,
      source: 'WEB',
      currentRiskBand: 'CRITICAL',
      currentRiskScore: 98.0,
    },
  });

  await (prisma as any).flashSale.create({
    data: {
      listingId: soldListing.id,
      farmerId: seedFarmer.id,
      originalPricePerKg: 12,
      discountPercent: 25,
      flashPricePerKg: 9,
      quantityKg: 120,
      soldKg: 120,
      riskBand: 'CRITICAL',
      riskScore: 98.0,
      status: 'SOLD',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      farmerApproved: true,
      buyersClaimed: 1,
    },
  });

  // Seed notification for buyer
  await (prisma as any).flashSaleNotification.create({
    data: {
      flashSaleId: sale1.id,
      buyerId: seedBuyer.id,
      channel: 'SMS',
      status: 'SENT',
      sentAt: new Date(),
    },
  });

  // 7. Print database summary counts
  const totalUsers = await prisma.user.count();
  const totalListings = await prisma.produceListing.count();
  const totalOrders = await prisma.order.count();
  const totalTraceEvents = await prisma.traceEvent.count();
  const totalPreOrders = await prisma.preOrder.count();
  const totalPlantingLogs = await prisma.plantingLog.count();

  console.log('\n=============================================');
  console.log('📊 AGRICONNECT SEED DATA SUMMARY REPORT');
  console.log('=============================================');
  console.log(`👤 Total Users Registered:      ${totalUsers}`);
  console.log(`🍅 Total Produce Listings:      ${totalListings}`);
  console.log(`📦 Total Customer Orders:       ${totalOrders}`);
  console.log(`📋 Total Trace Timeline Events:  ${totalTraceEvents}`);
  console.log(`🛒 Total Pre-Orders:             ${totalPreOrders}`);
  console.log(`🌱 Total Planting Logs:          ${totalPlantingLogs}`);
  console.log('=============================================\n');

  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('💥 Seeding failed:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
