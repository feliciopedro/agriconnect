import { SmsOutboundService } from '../services/ussd/smsOutbound.service';

async function run() {
  const phone = process.argv[2];
  if (!phone) {
    console.error('Usage: npx ts-node src/scripts/send-test-sms.ts <phone_number>');
    process.exit(1);
  }

  console.log(`Sending test SMS to ${phone} via mNotify...`);
  try {
    // Set environment to development to allow real API request to mNotify
    process.env.NODE_ENV = 'development';

    const result = await SmsOutboundService.sendSms(phone, 'lang_changed', {
      lang: 'English'
    });
    console.log('mNotify Response Result:', result);
    console.log('✅ Outbound SMS request triggered. Check your phone!');
  } catch (error) {
    console.error('❌ Failed to dispatch test SMS:', error);
  }
}

run();
