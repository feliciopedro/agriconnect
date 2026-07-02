/**
 * Unit tests for the Invoicing & Tax Receipts module.
 * Covers: access guards, order state transitions, and PDF Kit buffer rendering.
 */

// Mock Prisma client
jest.mock('../prisma/client', () => ({
  __esModule: true,
  default: {
    order: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    $disconnect: jest.fn(),
  },
}));

import prisma from '../prisma/client';
import { InvoiceService } from '../services/invoice.service';
import { OrderStatus, Role } from '../prisma/generated-client';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('InvoiceService.generateInvoicePdf', () => {
  const baseOrder = {
    id: 'order-inv-01',
    buyerId: 'buyer-inv-01',
    quantityKg: 100,
    depositCredit: 50,
    status: OrderStatus.DELIVERED,
    createdAt: new Date(),
    buyer: {
      id: 'buyer-inv-01',
      name: 'Retailer Yaw',
      phone: '+233240000001',
      region: 'Eastern',
      district: 'New Juaben',
    },
    deliveryRequest: {
      estimatedCost: 100,
      status: 'DELIVERED',
    },
    listing: {
      cropType: 'TOMATO',
      batchCode: 'BAT-TOM-01',
      pricePerKg: 5.0,
      farmerId: 'farmer-inv-01',
      farmer: {
        id: 'farmer-inv-01',
        name: 'Farmer Kwame',
        phone: '+233240000002',
        region: 'Eastern',
        district: 'Koforidua',
      },
    },
  };

  it('generates a valid PDF buffer starting with %PDF- for authorized buyer', async () => {
    (prisma.order.findUnique as jest.Mock).mockResolvedValue(baseOrder);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'buyer-inv-01', role: Role.BUYER });

    const buffer = await InvoiceService.generateInvoicePdf('order-inv-01', 'buyer-inv-01');

    expect(Buffer.isBuffer(buffer)).toBe(true);
    // Verify standard PDF magic bytes signature: %PDF-
    const pdfSignature = buffer.slice(0, 5).toString('utf-8');
    expect(pdfSignature).toBe('%PDF-');
  });

  it('allows access for listing farmer', async () => {
    (prisma.order.findUnique as jest.Mock).mockResolvedValue(baseOrder);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'farmer-inv-01', role: Role.FARMER });

    const buffer = await InvoiceService.generateInvoicePdf('order-inv-01', 'farmer-inv-01');
    expect(Buffer.isBuffer(buffer)).toBe(true);
  });

  it('allows access for admins', async () => {
    (prisma.order.findUnique as jest.Mock).mockResolvedValue(baseOrder);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'admin-inv-01', role: Role.ADMIN });

    const buffer = await InvoiceService.generateInvoicePdf('order-inv-01', 'admin-inv-01');
    expect(Buffer.isBuffer(buffer)).toBe(true);
  });

  it('throws 403 error for unauthorized third parties', async () => {
    (prisma.order.findUnique as jest.Mock).mockResolvedValue(baseOrder);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'stranger-inv-01', role: Role.BUYER });

    await expect(
      InvoiceService.generateInvoicePdf('order-inv-01', 'stranger-inv-01')
    ).rejects.toThrow('Access forbidden');
  });

  it('throws 400 error if order is not completed (status is not DELIVERED)', async () => {
    const pendingOrder = {
      ...baseOrder,
      status: OrderStatus.PENDING,
    };
    (prisma.order.findUnique as jest.Mock).mockResolvedValue(pendingOrder);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'buyer-inv-01', role: Role.BUYER });

    await expect(
      InvoiceService.generateInvoicePdf('order-inv-01', 'buyer-inv-01')
    ).rejects.toThrow('Invoice cannot be generated for orders in PENDING state');
  });

  it('throws 404 error if order is not found', async () => {
    (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      InvoiceService.generateInvoicePdf('non-existent-order', 'buyer-inv-01')
    ).rejects.toThrow('Order not found');
  });
});
