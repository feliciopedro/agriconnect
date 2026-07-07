import prisma from '../../prisma/client';
import { t } from '../../prisma/ussdTranslations';
import { normalizePhone } from '../auth.service';
import { config } from '../../config';
import * as https from 'https';

/**
 * Helper function to send an SMS via mNotify.
 */
function sendMnotifyRequest(apiKey: string, recipient: string, message: string, senderId: string = 'mNotify'): Promise<any> {
  return new Promise((resolve, reject) => {
    // Remove leading '+' from phone number if present
    const formattedPhone = recipient.replace(/^\+/, '');
    const url = `https://api.mnotify.com/api/sms/quick?key=${apiKey}`;
    
    const payload = JSON.stringify({
      recipient: [formattedPhone],
      sender: senderId,
      message: message
    });

    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch (e) {
          resolve({ status: 'error', message: body });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(payload);
    req.end();
  });
}

export class SmsOutboundService {
  /**
   * Looks up the translated template, substitutes placeholders, and sends via mNotify.
   */
  public static async sendSms(
    toPhone: string,
    templateKey: string,
    vars: Record<string, any>,
    lang?: string
  ): Promise<any> {
    const normalizedPhone = normalizePhone(toPhone);

    // Look up user to determine language if not provided
    const user = await prisma.user.findUnique({
      where: { phone: normalizedPhone }
    });

    const finalLang = lang || user?.preferredLanguage || 'en';
    const message = t(finalLang, templateKey, vars);

    const smsRecord = await prisma.ussdShortMessage.create({
      data: {
        toPhone: normalizedPhone,
        message,
        triggerAction: templateKey,
        status: 'QUEUED',
      }
    });

    try {
      if (
        config.MNOTIFY_API_KEY &&
        config.MNOTIFY_API_KEY !== 'mock_mnotify_key' &&
        process.env.NODE_ENV !== 'test'
      ) {
        const response = await sendMnotifyRequest(config.MNOTIFY_API_KEY, normalizedPhone, message, config.MNOTIFY_SENDER_ID);
        console.log(`[mNotify SMS Success] Response:`, response);

        return await prisma.ussdShortMessage.update({
          where: { id: smsRecord.id },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            attemptCount: { increment: 1 }
          }
        });
      } else {
        console.log(`[DEV SMS] to ${normalizedPhone}: ${message}`);
        return await prisma.ussdShortMessage.update({
          where: { id: smsRecord.id },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            attemptCount: { increment: 1 }
          }
        });
      }
    } catch (error: any) {
      console.error(`Failed to send outbound SMS to ${normalizedPhone}:`, error);

      return await prisma.ussdShortMessage.update({
        where: { id: smsRecord.id },
        data: {
          status: 'FAILED',
          errorMessage: error.message || String(error),
          attemptCount: { increment: 1 }
        }
      });
    }
  }

  /**
   * Retries all failed UssdShortMessages with less than 3 attempts.
   */
  public static async retryStaleSms(): Promise<{ retried: number; succeeded: number }> {
    const failedMessages = await prisma.ussdShortMessage.findMany({
      where: {
        status: 'FAILED',
        attemptCount: { lt: 3 }
      }
    });

    let succeeded = 0;

    for (const msg of failedMessages) {
      try {
        if (
          config.MNOTIFY_API_KEY &&
          config.MNOTIFY_API_KEY !== 'mock_mnotify_key' &&
          process.env.NODE_ENV !== 'test'
        ) {
          await sendMnotifyRequest(config.MNOTIFY_API_KEY, msg.toPhone, msg.message, config.MNOTIFY_SENDER_ID);
        } else {
          console.log(`[DEV SMS RETRY] to ${msg.toPhone}: ${msg.message}`);
        }

        await prisma.ussdShortMessage.update({
          where: { id: msg.id },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            attemptCount: { increment: 1 },
            errorMessage: null
          }
        });
        succeeded++;
      } catch (error: any) {
        console.error(`Retry failed for SMS ${msg.id} to ${msg.toPhone}:`, error);

        await prisma.ussdShortMessage.update({
          where: { id: msg.id },
          data: {
            attemptCount: { increment: 1 },
            errorMessage: error.message || String(error)
          }
        });
      }
    }

    return {
      retried: failedMessages.length,
      succeeded
    };
  }

  /**
   * Identifies all AVAILABLE listings with a CRITICAL spoilage risk (expiry < 24h)
   * and dispatches SMS alerts to their respective farmers.
   */
  public static async runSpoilageAlertJob(): Promise<number> {
    const now = new Date();
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const criticalListings = await prisma.produceListing.findMany({
      where: {
        status: 'AVAILABLE',
        expiryEstimate: {
          gt: now,
          lte: oneDayFromNow
        }
      },
      include: {
        farmer: true
      }
    });

    let alertsSent = 0;

    for (const listing of criticalListings) {
      if (listing.expiryEstimate) {
        const exp = new Date(listing.expiryEstimate);
        const hours = Math.max(1, Math.round((exp.getTime() - now.getTime()) / (1000 * 60 * 60)));
        try {
          await SmsOutboundService.sendSms(listing.farmer.phone, 'spoilage_alert', {
            qty: listing.remainingKg,
            crop: listing.cropType,
            hours
          });
          alertsSent++;
        } catch (err) {
          console.error(`Failed to send spoilage alert for listing ${listing.id}:`, err);
        }
      }
    }

    return alertsSent;
  }
}
