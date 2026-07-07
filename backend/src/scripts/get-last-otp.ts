import prisma from '../prisma/client';

async function run() {
  const phone = '+233263383755';
  const otpRecord = await prisma.otpCode.findFirst({
    where: {
      phone,
      isUsed: false,
      expiresAt: { gt: new Date() }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (otpRecord) {
    console.log(`🔑 The active OTP code for ${phone} is: ${otpRecord.code}`);
  } else {
    console.log(`❌ No active OTP code found for ${phone}`);
  }
}

run();
