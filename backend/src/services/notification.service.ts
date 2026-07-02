import prisma from '../prisma/client';
import { config } from '../config';
import AfricasTalking = require('africastalking');

export class NotificationService {
  /**
   * Always inserts a Notification in the database.
   * If sendSms = true, sends an SMS via Africa's Talking SDK, falling back to console log in development.
   */
  public static async createNotification(
    userId: string,
    type: string,
    message: string,
    sendSms = false,
    tx?: any
  ) {
    const client = tx || prisma;
    // 1. Create the database record
    const notification = await client.notification.create({
      data: {
        userId,
        type,
        message,
        isRead: false,
      },
    });

    // 2. Dispatch optional SMS
    if (sendSms) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
        });

        if (user && user.phone) {
          if (
            config.AFRICAS_TALKING_API_KEY &&
            config.AFRICAS_TALKING_API_KEY !== 'mock_africas_talking_api_key'
          ) {
            const at = AfricasTalking({
              apiKey: config.AFRICAS_TALKING_API_KEY,
              username: config.AFRICAS_TALKING_USERNAME || 'sandbox',
            });
            await at.SMS.send({
              to: [user.phone],
              message,
            });
          } else {
            console.log(`[DEV SMS] to ${user.phone}: ${message}`);
          }
        }
      } catch (error) {
        // Log the error but do NOT throw so the primary transaction doesn't fail
        console.error('Failed to dispatch SMS through Africa\'s Talking:', error);
      }
    }

    return notification;
  }
}
