import prisma from '../prisma/client';
import { AuthService } from '../services/auth.service';
import { Role } from '../prisma/generated-client';

async function run() {
  console.log('🚀 Starting Super Admin Registration Email Notification Simulation...');

  const testPhone = '+233550000401';
  const testCode = '123456';

  // 1. Clean up previous test runs
  await prisma.user.deleteMany({ where: { phone: testPhone } });
  await prisma.otpCode.deleteMany({ where: { phone: testPhone } });

  // 2. Create valid OTP code in the database
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await prisma.otpCode.create({
    data: {
      phone: testPhone,
      code: testCode,
      expiresAt,
    },
  });

  console.log(`🔑 Created mock OTP verification code: ${testCode} for phone: ${testPhone}`);

  // 3. Trigger registration via verifyOtp
  console.log('\n📝 Verifying OTP to trigger registration and super admin email alert...');
  
  const result = await AuthService.verifyOtp(testPhone, testCode, Role.BUYER);
  
  console.log('\n====================================');
  console.log('📊 Verification Results:');
  console.log('====================================');
  console.log(`👤 User Created Successfully!`);
  console.log(`   - ID: ${result.user.id}`);
  console.log(`   - Phone: ${result.user.phone}`);
  console.log(`   - Role: ${result.user.role}`);
  console.log(`   - Verified status: ${result.user.isVerified ? 'VERIFIED' : 'UNVERIFIED (Awaiting admin approval)'}`);
  
  // Wait a small timeout to let the asynchronous email notify function complete and log its console output
  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log('\n✨ Registration Email Simulation Finished Successfully!');
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
