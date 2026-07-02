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

async function main() {
  console.log('🌱 Starting AgriConnect database seed...');

  // 1. Clean existing records in dependency order
  await prisma.review.deleteMany();
  await prisma.deliveryRequest.deleteMany();
  await prisma.order.deleteMany();
  await prisma.traceEvent.deleteMany();
  await prisma.traceabilityRecord.deleteMany();
  await prisma.produceListing.deleteMany();
  await prisma.farmerProfile.deleteMany();
  await prisma.buyerProfile.deleteMany();
  await prisma.transportProfile.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.message.deleteMany();
  await prisma.otpCode.deleteMany();
  await prisma.ussdSession.deleteMany();
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
  const harvestBase = new Date();
  for (const c of cropsSetup) {
    const farmer = farmers[c.farmerIdx];
    const listing = await prisma.produceListing.create({
      data: {
        farmerId: farmer.id,
        cropType: c.crop,
        quantityKg: c.qty,
        remainingKg: c.remaining,
        pricePerKg: c.price,
        images: ['https://example.com/crop.jpg'],
        harvestDate: new Date(harvestBase.getTime() - 2 * 24 * 60 * 60 * 1000),
        expiryEstimate: new Date(harvestBase.getTime() + 10 * 24 * 60 * 60 * 1000),
        qualityGrade: c.grade,
        qualityGradeSource: c.grade === QualityGrade.UNGRADED ? 'UNGRADED' : 'AI',
        status: c.status,
        latitude: farmer.latitude!,
        longitude: farmer.longitude!,
        batchCode: c.batch,
        traceability: {
          create: {
            plantingDate: new Date(harvestBase.getTime() - 90 * 24 * 60 * 60 * 1000),
            inputsUsed: ['Natures Organic Fertilizer', 'Rainwater irrigation'],
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

  // 4. Create Orders (8 orders, mixed statuses, linking listings and buyers)
  const ordersSetup = [
    { buyerIdx: 0, listingIdx: 0, qty: 50, status: OrderStatus.PENDING, payment: PaymentStatus.UNPAID },
    { buyerIdx: 1, listingIdx: 1, qty: 200, status: OrderStatus.DELIVERED, payment: PaymentStatus.PAID },
    { buyerIdx: 2, listingIdx: 2, qty: 30, status: OrderStatus.CONFIRMED, payment: PaymentStatus.PAID },
    { buyerIdx: 3, listingIdx: 5, qty: 120, status: OrderStatus.DELIVERED, payment: PaymentStatus.PAID },
    { buyerIdx: 4, listingIdx: 6, qty: 20, status: OrderStatus.CANCELLED, payment: PaymentStatus.UNPAID },
    { buyerIdx: 0, listingIdx: 9, qty: 180, status: OrderStatus.DELIVERED, payment: PaymentStatus.PAID },
    { buyerIdx: 2, listingIdx: 12, qty: 110, status: OrderStatus.DELIVERED, payment: PaymentStatus.PAID },
    { buyerIdx: 1, listingIdx: 15, qty: 100, status: OrderStatus.DELIVERED, payment: PaymentStatus.PAID },
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
    if (o.status === OrderStatus.CONFIRMED || o.status === OrderStatus.DELIVERED) {
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

    if (o.status === OrderStatus.DELIVERED) {
      // Picked up
      await prisma.traceEvent.create({
        data: {
          listingId: listing.id,
          eventType: TraceEventType.PICKED_UP,
          latitude: listing.latitude,
          longitude: listing.longitude,
          recordedByUserId: transporters[0].id,
          notes: `Cargo picked up by courier`,
        }
      });

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
    if (o.status !== OrderStatus.PENDING && o.status !== OrderStatus.CANCELLED) {
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
  console.log(`📦 Seeded ${orders.length} Orders and associated DeliveryRequests/TraceEvents.`);

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
