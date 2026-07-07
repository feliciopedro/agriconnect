import app from '../app';
import prisma from '../prisma/client';
import http from 'http';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { Role } from '../prisma/generated-client';

async function runInteractiveUssd() {
  console.log('🧪 Starting Interactive AgriConnect USSD Test Runner...\n');

  // 1. Parse arguments
  const args = process.argv.slice(2);
  const langArg = args.find((a) => a.startsWith('--lang='))?.split('=')[1] || 'en';
  const roleArg = (args.find((a) => a.startsWith('--role='))?.split('=')[1] || 'FARMER').toUpperCase();

  const validLangs = ['en', 'tw', 'ew', 'ha'];
  if (!validLangs.includes(langArg)) {
    console.error(`❌ Invalid language: ${langArg}. Supported: en, tw, ew, ha`);
    process.exit(1);
  }

  const validRoles = ['FARMER', 'BUYER', 'TRANSPORT', 'ADMIN'];
  if (!validRoles.includes(roleArg)) {
    console.error(`❌ Invalid role: ${roleArg}. Supported: ${validRoles.join(', ')}`);
    process.exit(1);
  }

  const port = 5011;
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(port, resolve));
  console.log(`📡 Local test server listening on http://localhost:${port}`);

  const testPhone = '+233249999999';
  const sessionId = `AT_INTERACTIVE_USSD_${Date.now()}`;

  // 2. Clean up previous test user and pre-create
  await prisma.ussdSession.deleteMany({ where: { phone: testPhone } });
  await prisma.user.deleteMany({ where: { phone: testPhone } });

  const user = await prisma.user.create({
    data: {
      phone: testPhone,
      name: 'Interactive Tester',
      role: roleArg as Role,
      preferredLanguage: langArg,
      isVerified: true,
      ...(roleArg === 'FARMER' && {
        farmerProfile: {
          create: { farmSizeAcres: 5, primaryCrops: ['TOMATO', 'PEPPER'] }
        }
      }),
      ...(roleArg === 'BUYER' && {
        buyerProfile: {
          create: { businessType: 'RETAILER' }
        }
      }),
      ...(roleArg === 'TRANSPORT' && {
        transportProfile: {
          create: { vehicleType: 'TRUCK', capacityKg: 2000, serviceRadiusKm: 50, isAvailable: true }
        }
      })
    }
  });

  console.log(`👤 Created test user: ${testPhone} (${roleArg}, Lang: ${langArg})`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const sessionLog: {
    timestamp: string;
    phone: string;
    role: string;
    lang: string;
    steps: Array<{ step: number; input: string; response: string }>;
  } = {
    timestamp: new Date().toISOString(),
    phone: testPhone,
    role: roleArg,
    lang: langArg,
    steps: []
  };

  const dialPath: string[] = [];
  let stepCount = 0;

  const queryUssd = async (text: string) => {
    const res = await fetch(`http://localhost:${port}/api/ussd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        serviceCode: '*920*11#',
        phoneNumber: testPhone,
        text
      })
    });
    return await res.text();
  };

  const askNextStep = async (): Promise<void> => {
    stepCount++;
    const currentText = dialPath.join('*');
    
    try {
      const response = await queryUssd(currentText);
      const charCount = response.length;
      
      console.log(`\n================ STEP ${stepCount} ================`);
      console.log(`Dial Path: *920*11#${dialPath.length > 0 ? '*' + currentText : ''}`);
      console.log(`Response Type: ${response.substring(0, 3)} (${charCount} chars)`);
      console.log(`-----------------------------------`);
      console.log(response.substring(4)); // Strip CON/END prefix for output
      console.log(`-----------------------------------`);

      if (charCount > 182) {
        console.warn(`⚠️ WARNING: Response exceeds Africa's Talking 182-character limit! (${charCount}/182)`);
      }

      sessionLog.steps.push({
        step: stepCount,
        input: currentText,
        response
      });

      if (response.startsWith('END')) {
        console.log('\n🏁 Session ended by the server.');
        return;
      }

      // Prompt for next choice
      const nextInput = await new Promise<string>((resolve) => {
        rl.question('Enter your choice (or type "exit" to quit): ', resolve);
      });

      const trimmedInput = nextInput.trim();
      if (trimmedInput.toLowerCase() === 'exit') {
        console.log('\n👋 Session terminated by user.');
        return;
      }

      if (trimmedInput === '0') {
        // Handle Back navigation by popping path
        if (dialPath.length > 0) {
          dialPath.pop();
        }
      } else {
        dialPath.push(trimmedInput);
      }

      await askNextStep();
    } catch (err: any) {
      console.error('❌ Error executing step:', err.message);
    }
  };

  try {
    await askNextStep();
    
    // Save session logs
    const logsDir = path.join(__dirname, 'test-sessions');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    const filename = `${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const logPath = path.join(logsDir, filename);
    fs.writeFileSync(logPath, JSON.stringify(sessionLog, null, 2), 'utf-8');
    console.log(`💾 Session logs saved to: ${logPath}`);

    // Clean up created records
    await prisma.ussdSession.deleteMany({ where: { phone: testPhone } });
    await prisma.user.deleteMany({ where: { phone: testPhone } });
    console.log('🧹 Cleaned up database records.');

  } catch (error: any) {
    console.error('❌ Simulation aborted:', error.message);
  } finally {
    rl.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    console.log('🔌 Test server shut down.');
    process.exit(0);
  }
}

runInteractiveUssd();
