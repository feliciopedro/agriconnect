import app from '../app';
import prisma from '../prisma/client';
import http from 'http';

async function runUssdSimulation() {
  console.log('🧪 Starting AgriConnect USSD Simulation script...\n');

  const port = 5011;
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(port, resolve));
  console.log(`📡 Local test server listening on http://localhost:${port}`);

  const testPhone = '+233240000000';
  const sessionId = 'AT_USSD_SIM_SESSION_123456';

  // 1. Clean up any previous test listings
  await prisma.traceEvent.deleteMany({ where: { listing: { batchCode: { startsWith: 'AGC-' } }, recordedByUserId: { not: null } } });
  await prisma.produceListing.deleteMany({ where: { farmer: { phone: testPhone } } });
  await prisma.user.deleteMany({ where: { phone: testPhone } });

  const queryUssd = async (text: string) => {
    const res = await fetch(`http://localhost:${port}/api/ussd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        phoneNumber: testPhone,
        text,
      }),
    });
    return await res.text();
  };

  try {
    // Step 1: text="" -> expect main menu
    console.log('--- Step 1: Dialing USSD (text="") ---');
    const resp1 = await queryUssd('');
    console.log(`Response:\n${resp1}\n`);
    if (!resp1.startsWith('CON')) throw new Error('Step 1 failed: Expected CON main menu');

    // Step 2: text="1" -> expect crop selection menu
    console.log('--- Step 2: Selecting option 1 "List Produce" (text="1") ---');
    const resp2 = await queryUssd('1');
    console.log(`Response:\n${resp2}\n`);
    if (!resp2.startsWith('CON') || !resp2.includes('Select crop')) {
      throw new Error('Step 2 failed: Expected crop selection menu');
    }

    // Step 3: text="1*1" -> expect quantity prompt (choosing Tomato)
    console.log('--- Step 3: Selecting Crop option 1 "Tomato" (text="1*1") ---');
    const resp3 = await queryUssd('1*1');
    console.log(`Response:\n${resp3}\n`);
    if (!resp3.startsWith('CON') || !resp3.includes('quantity')) {
      throw new Error('Step 3 failed: Expected quantity prompt');
    }

    // Step 4: text="1*1*50" -> expect price prompt
    console.log('--- Step 4: Entering quantity 50kg (text="1*1*50") ---');
    const resp4 = await queryUssd('1*1*50');
    console.log(`Response:\n${resp4}\n`);
    if (!resp4.startsWith('CON') || !resp4.includes('price')) {
      throw new Error('Step 4 failed: Expected price prompt');
    }

    // Step 5: text="1*1*50*5" -> expect confirmation
    console.log('--- Step 5: Entering price GHS 5/kg (text="1*1*50*5") ---');
    const resp5 = await queryUssd('1*1*50*5');
    console.log(`Response:\n${resp5}\n`);
    if (!resp5.startsWith('CON') || !resp5.includes('Confirm listing')) {
      throw new Error('Step 5 failed: Expected confirmation screen');
    }

    // Step 6: text="1*1*50*5*1" -> expect END with batch code
    console.log('--- Step 6: Confirming listing (text="1*1*50*5*1") ---');
    const resp6 = await queryUssd('1*1*50*5*1');
    console.log(`Response:\n${resp6}\n`);
    if (!resp6.startsWith('END') || !resp6.includes('Batch code')) {
      throw new Error('Step 6 failed: Expected END with batch code');
    }

    console.log('🎉 USSD simulation finished successfully!');

    // Clean up created records
    await prisma.traceEvent.deleteMany({ where: { listing: { farmer: { phone: testPhone } } } });
    await prisma.produceListing.deleteMany({ where: { farmer: { phone: testPhone } } });
    await prisma.user.deleteMany({ where: { phone: testPhone } });
    console.log('🧹 Cleaned up created simulation records.');

  } catch (error: any) {
    console.error('❌ USSD Simulation failed:', error.message);
    process.exit(1);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    console.log('🔌 Test server shut down.');
    process.exit(0);
  }
}

runUssdSimulation();
