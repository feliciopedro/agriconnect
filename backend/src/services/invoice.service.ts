import prisma from '../prisma/client';
import { createError } from '../utils/errors';
import { OrderStatus, Role } from '../prisma/generated-client';
import PDFDocument from 'pdfkit';

export class InvoiceService {
  /**
   * Generates a PDF invoice buffer for a completed (DELIVERED) order.
   * Restricts access to the buyer, farmer, and admin roles.
   */
  public static async generateInvoicePdf(orderId: string, requestingUserId: string): Promise<Buffer> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: { select: { id: true, name: true, phone: true, region: true, district: true } },
        deliveryRequest: { select: { estimatedCost: true, status: true } },
        listing: {
          include: {
            farmer: { select: { id: true, name: true, phone: true, region: true, district: true } },
          },
        },
      },
    });

    if (!order) {
      throw createError('Order not found', 'ORDER_NOT_FOUND', 404);
    }

    // Access control: only buyer, listing farmer, or admin can download invoice
    const isBuyer = order.buyerId === requestingUserId;
    const isFarmer = order.listing.farmerId === requestingUserId;

    // Fetch user role for admin check
    const requestingUser = await prisma.user.findUnique({ where: { id: requestingUserId } });
    const isAdmin = requestingUser?.role === Role.ADMIN;

    if (!isBuyer && !isFarmer && !isAdmin) {
      throw createError(
        'Access forbidden: you do not have permissions to access this invoice',
        'FORBIDDEN_INVOICE_ACCESS',
        403
      );
    }

    // State control: Invoices/Tax receipts are only generated for DELIVERED (completed) orders
    if (order.status !== OrderStatus.DELIVERED) {
      throw createError(
        `Invoice cannot be generated for orders in ${order.status} state. Only DELIVERED orders can have invoices.`,
        'INVALID_ORDER_STATE',
        400
      );
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      // --- Calculations ---
      const subtotal = order.quantityKg * order.listing.pricePerKg;
      const deliveryFee = order.deliveryRequest?.estimatedCost || 0.0;
      
      // Ghana Taxes: VAT (15%), Levies: NHIL (2.5%) + GETFund (2.5%) + Covid-19 Health Recovery Levy (1%) = 6%
      const vat = subtotal * 0.15;
      const levies = subtotal * 0.06;
      const depositCredit = order.depositCredit || 0.0;
      
      const totalAmount = subtotal + deliveryFee + vat + levies - depositCredit;

      // --- Header Design ---
      doc
        .fillColor('#1b4d3e') // Premium dark agricultural green
        .fontSize(22)
        .text('AgriConnect Ghana', 50, 50)
        .fontSize(10)
        .fillColor('#666666')
        .text('Sustainable Agricultural Sourcing & Logistics Hub', 50, 75)
        .text('Accra, Ghana | support@agriconnect.gh', 50, 88);

      doc
        .fillColor('#333333')
        .fontSize(14)
        .text('INVOICE & TAX RECEIPT', 380, 50, { align: 'right' })
        .fontSize(9)
        .fillColor('#555555')
        .text(`Invoice No: AGC-INV-${order.id.slice(0, 8).toUpperCase()}`, 380, 70, { align: 'right' })
        .text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, 380, 83, { align: 'right' })
        .text(`Payment: Paid via Paystack`, 380, 96, { align: 'right' });

      // Horizontal separator rule
      doc.moveTo(50, 120).lineTo(545, 120).strokeColor('#e5e7eb').lineWidth(1).stroke();

      // --- Bill To / Sourced From Details ---
      doc
        .fillColor('#1b4d3e')
        .fontSize(11)
        .text('Billed To (Buyer):', 50, 135)
        .fillColor('#333333')
        .fontSize(9)
        .text(order.buyer.name, 50, 150)
        .text(`Phone: ${order.buyer.phone}`, 50, 163)
        .text(`Location: ${order.buyer.district || ''}, ${order.buyer.region || ''} Region`, 50, 176);

      doc
        .fillColor('#1b4d3e')
        .fontSize(11)
        .text('Sourced From (Farmer):', 300, 135)
        .fillColor('#333333')
        .fontSize(9)
        .text(order.listing.farmer.name, 300, 150)
        .text(`Phone: ${order.listing.farmer.phone}`, 300, 163)
        .text(`Farm Location: ${order.listing.farmer.district || ''}, ${order.listing.farmer.region || ''} Region`, 300, 176);

      // Horizontal separator rule
      doc.moveTo(50, 205).lineTo(545, 205).strokeColor('#e5e7eb').lineWidth(1).stroke();

      // --- Table Headers ---
      doc
        .fillColor('#1b4d3e')
        .fontSize(10)
        .text('Crop Description', 50, 220)
        .text('Batch Code', 200, 220)
        .text('Qty (Kg)', 300, 220, { align: 'right', width: 60 })
        .text('Unit Price (GHS)', 380, 220, { align: 'right', width: 80 })
        .text('Subtotal (GHS)', 475, 220, { align: 'right', width: 70 });

      // Table line separator
      doc.moveTo(50, 235).lineTo(545, 235).strokeColor('#1b4d3e').lineWidth(1.5).stroke();

      // --- Table Row ---
      doc
        .fillColor('#333333')
        .fontSize(9.5)
        .text(order.listing.cropType, 50, 245)
        .text(order.listing.batchCode, 200, 245)
        .text(order.quantityKg.toFixed(1), 300, 245, { align: 'right', width: 60 })
        .text(order.listing.pricePerKg.toFixed(2), 380, 245, { align: 'right', width: 80 })
        .text(subtotal.toFixed(2), 475, 245, { align: 'right', width: 70 });

      // Table bottom rule
      doc.moveTo(50, 265).lineTo(545, 265).strokeColor('#e5e7eb').lineWidth(1).stroke();

      // --- Summary / Totals Breakdown ---
      const labelX = 320;
      const valX = 475;
      const startY = 285;
      const rowHeight = 18;

      doc.fontSize(9).fillColor('#666666');

      doc.text('Subtotal:', labelX, startY).text(subtotal.toFixed(2), valX, startY, { align: 'right', width: 70 });
      
      const y2 = startY + rowHeight;
      doc.text('Delivery & Transport Fee:', labelX, y2).text(deliveryFee.toFixed(2), valX, y2, { align: 'right', width: 70 });

      const y3 = y2 + rowHeight;
      doc.text('VAT (15.0%):', labelX, y3).text(vat.toFixed(2), valX, y3, { align: 'right', width: 70 });

      const y4 = y3 + rowHeight;
      doc.text('NHIL, GETFund & COVID Levies (6.0%):', labelX, y4).text(levies.toFixed(2), valX, y4, { align: 'right', width: 70 });

      const y5 = y4 + rowHeight;
      if (depositCredit > 0) {
        doc.text('Pre-order Deposit Offset:', labelX, y5).text(`-${depositCredit.toFixed(2)}`, valX, y5, { align: 'right', width: 70 });
      }

      const totalY = depositCredit > 0 ? y5 + rowHeight + 10 : y4 + rowHeight + 10;

      // Total rule
      doc.moveTo(labelX, totalY - 5).lineTo(545, totalY - 5).strokeColor('#1b4d3e').lineWidth(1.5).stroke();

      doc
        .fillColor('#1b4d3e')
        .fontSize(11)
        .text('Final Amount Paid (GHS):', labelX, totalY)
        .text(totalAmount.toFixed(2), valX, totalY, { align: 'right', width: 70 });

      // --- Footer / Compliance Notice ---
      doc
        .fillColor('#888888')
        .fontSize(8)
        .text('This document serves as an official tax invoice and payment receipt generated dynamically by AgriConnect. Transactions are verified and processed securely through Paystack.', 50, 480, { align: 'center', width: 495 })
        .fillColor('#1b4d3e')
        .fontSize(9)
        .text('Thank you for supporting sustainable agriculture in Ghana!', 50, 520, { align: 'center', width: 495 });

      doc.end();
    });
  }
}
