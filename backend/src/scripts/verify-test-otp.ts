import { AuthService } from '../services/auth.service';

async function run() {
  const phone = '+233263383755';
  const code = '651105';
  console.log(`Verifying OTP ${code} for ${phone} as a FARMER...`);
  try {
    const result = await AuthService.verifyOtp(phone, code, 'FARMER' as any);
    console.log('✅ OTP Verification Successful!');
    console.log('Login Response:', result);
  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

run();
