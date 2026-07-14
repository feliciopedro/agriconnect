import nodemailer from 'nodemailer';

export class EmailService {
  private static transporter = nodemailer.createTransport(
    (process.env.SMTP_HOST && process.env.SMTP_USER
      ? {
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
          secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        }
      : {
          jsonTransport: true,
        }) as any
  );

  /**
   * Dispatches email notifications to the Super Admin upon new user registration.
   */
  public static async notifySuperAdminOnRegistration(user: {
    id: string;
    phone: string;
    role: string;
    name?: string;
  }) {
    const superAdminEmail = process.env.SUPERADMIN_EMAIL || 'superadmin@agriconnect.com';
    const smtpFrom = process.env.SMTP_FROM || 'no-reply@agriconnect.com';

    const subject = `🔔 AgriConnect: New User Registered (${user.role})`;
    
    const textContent = `
Hello Super Admin,

A new user has registered on AgriConnect and is awaiting verification:

- Name: ${user.name || 'New User'}
- Phone: ${user.phone}
- Role: ${user.role}
- User ID: ${user.id}
- Registered At: ${new Date().toLocaleString()}

Please log in to the AgriConnect Admin Panel to verify this user:
https://agriconnect-frontend-pearl.vercel.app/admin

Best regards,
AgriConnect System Notification
    `;

    try {
      if (process.env.SMTP_HOST && process.env.SMTP_USER) {
        await this.transporter.sendMail({
          from: smtpFrom,
          to: superAdminEmail,
          subject,
          text: textContent,
        });
        console.log(`✉️ SMTP Notification Sent: Superadmin notified of registration for User ID: ${user.id}`);
      } else {
        console.log(`✉️ [DEV EMAIL LOG]
To: ${superAdminEmail}
From: ${smtpFrom}
Subject: ${subject}
Content:
${textContent}
=======================================`);
      }
    } catch (err) {
      console.error('Failed to send registration email notification to super admin:', err);
    }
  }
}
