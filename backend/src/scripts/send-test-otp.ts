import { AuthService } from '../services/auth.service';

async function run() {
  const phone = '+233263383755';
  console.log(`Requesting OTP for ${phone} via AuthService...`);
  try {
    process.env.NODE_ENV = 'development';
    await AuthService.requestOtp(phone);
    console.log('✅ OTP requested successfully! Check your phone.');
  } catch (error) {
    console.error('❌ Failed to request OTP:', error);
  }
}

run();
