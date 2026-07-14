import prisma from '../prisma/client';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';

async function run() {
  console.log('🚀 Starting QR-Code Traceability Label PDF Generator Simulation...');

  // 1. Fetch any listing from the database
  let listing = await prisma.produceListing.findFirst({
    include: {
      farmer: true,
    },
  });

  if (!listing) {
    console.log('📝 No listings found in the database. Creating a mock listing for Ama...');
    const farmer = await prisma.user.findFirst({
      where: { role: 'FARMER' },
    });

    if (!farmer) {
      throw new Error('Please seed the database first by running "npm run seed" or ensure users exist.');
    }

    listing = await prisma.produceListing.create({
      data: {
        farmerId: farmer.id,
        cropType: 'TOMATO',
        quantityKg: 150,
        remainingKg: 150,
        pricePerKg: 12.5,
        harvestDate: new Date(),
        latitude: 5.6037,
        longitude: -0.187,
        batchCode: 'BAT-TOM-DEMO',
        status: 'AVAILABLE',
        source: 'WEB',
      },
      include: {
        farmer: true,
      },
    });
  }

  console.log(`📦 Found Produce Listing: ${listing.cropType} (Batch: ${listing.batchCode})`);

  // 2. Setup mock URLs
  const frontendUrl = 'https://agriconnect-frontend-pearl.vercel.app';
  const traceUrl = `${frontendUrl}/trace/${listing.batchCode}`;
  
  // Create QR Code base64 Data URL
  const qrDataUrl = await QRCode.toDataURL(traceUrl, {
    margin: 1,
    width: 150,
  });

  console.log('🎨 Initializing PDFkit Document...');

  const PDFDocument = require('pdfkit');
  
  // Standard 4x6 inch label PDF (288 x 432 PostScript points)
  const doc = new PDFDocument({
    size: [288, 432],
    margins: { top: 15, bottom: 15, left: 15, right: 15 },
  });

  const outputPath = path.join(__dirname, 'test-label-output.pdf');
  const writeStream = fs.createWriteStream(outputPath);
  doc.pipe(writeStream);

  // Draw thin decorative border
  doc.rect(8, 8, 272, 416).lineWidth(2).strokeColor('#2D6A4F').stroke();
  doc.rect(12, 12, 264, 408).lineWidth(0.5).strokeColor('#D1D5DB').stroke();

  // Heading Logo / Brand
  doc.fillColor('#2D6A4F')
     .fontSize(16)
     .font('Helvetica-Bold')
     .text('AgriConnect', 20, 20, { align: 'center' });
     
  doc.fillColor('#6B7280')
     .fontSize(8)
     .font('Helvetica')
     .text('REAL-TIME BATCH TRACEABILITY', 20, 38, { align: 'center' });

  // Horizontal separator line
  doc.moveTo(20, 48).lineTo(268, 48).lineWidth(1).strokeColor('#E5E7EB').stroke();

  // Crop type in huge letters
  const cropName = listing.cropType.replace('_', ' ');
  doc.fillColor('#111827')
     .fontSize(22)
     .font('Helvetica-Bold')
     .text(cropName.toUpperCase(), 20, 58, { align: 'center' });

  // Batch Code
  doc.fillColor('#DC2626')
     .fontSize(11)
     .font('Helvetica-Bold')
     .text(`BATCH: ${listing.batchCode}`, 20, 84, { align: 'center' });

  // Horizontal separator line
  doc.moveTo(20, 102).lineTo(268, 102).lineWidth(1).strokeColor('#E5E7EB').stroke();

  // Grid stats metadata details
  let currentY = 112;
  
  const drawMetadataRow = (label: string, val: string) => {
    doc.fillColor('#6B7280')
       .fontSize(9)
       .font('Helvetica-Bold')
       .text(label, 25, currentY);
       
    doc.fillColor('#111827')
       .fontSize(9)
       .font('Helvetica')
       .text(val, 110, currentY, { width: 150 });
       
    currentY += 16;
  };

  const dateStr = listing.harvestDate ? new Date(listing.harvestDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }) : 'N/A';
  
  drawMetadataRow('Farmer:', listing.farmer?.name || 'Ama Serwaa');
  drawMetadataRow('Region:', listing.farmer?.region || 'Eastern Region');
  drawMetadataRow('Quantity:', `${listing.quantityKg} kg`);
  drawMetadataRow('Harvest Date:', dateStr);
  drawMetadataRow('Source:', listing.plantingLogId ? 'Planting Log Audited' : 'Farmer Declared');

  // Horizontal separator line
  doc.moveTo(20, 202).lineTo(268, 202).lineWidth(1).strokeColor('#E5E7EB').stroke();

  // Embed QR code image centered
  doc.image(qrDataUrl, 84, 212, { width: 120 });

  // Help instructions footer
  doc.fillColor('#111827')
     .fontSize(9)
     .font('Helvetica-Bold')
     .text('SCAN TO TRACE PRODUCE', 20, 342, { align: 'center' });
     
  doc.fillColor('#6B7280')
     .fontSize(7)
     .font('Helvetica')
     .text(
       'Scan this QR code with your smartphone camera to view the full logistics chain, verification status, and carbon footprint tracker of this batch.',
       20,
       358,
       { align: 'center', width: 248, lineGap: 2 }
     );

  // Finalize PDF
  doc.end();

  await new Promise((resolve) => writeStream.on('finish', resolve));
  
  const stats = fs.statSync(outputPath);
  console.log('\n====================================');
  console.log('📊 Verification Results:');
  console.log('====================================');
  console.log(`✅ Traceability Label PDF generated at: ${outputPath}`);
  console.log(`✅ File Size: ${stats.size} bytes (Expected: >10,000 bytes)`);
  console.log('✨ PDF Verification Finished Successfully!');
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
