import prisma from '../prisma/client';
import jwt from 'jsonwebtoken';
import AfricasTalking from 'africastalking';
import { config } from '../config';
import { createError } from '../utils/errors';
import { Role, BusinessType } from '../prisma/generated-client';
import { JWTPayload } from '../types';

/**
 * Normalizes phone numbers to '+233XX' format.
 * Accepts: '0241234567', '233241234567', '+233241234567'.
 */
export const normalizePhone = (phone: string): string => {
  // Strip all non-numeric characters
  const digits = phone.replace(/\D/g, '');
  
  if (digits.startsWith('233') && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return `+233${digits.substring(1)}`;
  }
  if (digits.length === 9) {
    return `+233${digits}`;
  }
  
  // Return standard formatting or original if fallback
  return phone.startsWith('+') ? phone : `+${phone}`;
};

export class AuthService {
  /**
   * Generates a 6-digit OTP code, stores it, and sends it via Africa's Talking.
   */
  public static async requestOtp(phone: string): Promise<void> {
    const normalizedPhone = normalizePhone(phone);
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    // 1. Rate limiting: count unexpired codes in last 10 minutes
    const activeOtpsCount = await prisma.otpCode.count({
      where: {
        phone: normalizedPhone,
        isUsed: false,
        expiresAt: { gt: new Date() },
        createdAt: { gte: tenMinutesAgo },
      },
    });

    if (activeOtpsCount >= 3) {
      throw createError('Too many verification codes requested. Rate limit exceeded. Try again in 10 minutes.', 'RATE_LIMIT_EXCEEDED', 429);
    }

    // 2. Generate random 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // Valid for 5 minutes

    await prisma.otpCode.create({
      data: {
        phone: normalizedPhone,
        code,
        expiresAt,
      },
    });

    // 3. Send via Africa's Talking
    if (!config.AFRICAS_TALKING_API_KEY || config.AFRICAS_TALKING_API_KEY === 'mock_africas_talking_api_key') {
      console.log(`[DEV OTP] DEV OTP for ${normalizedPhone}: ${code}`);
    } else {
      try {
        const at = AfricasTalking({
          apiKey: config.AFRICAS_TALKING_API_KEY,
          username: config.AFRICAS_TALKING_USERNAME,
        });
        await at.SMS.send({
          to: [normalizedPhone],
          message: `Your AgriConnect verification code is: ${code}. Valid for 5 minutes.`,
        });
      } catch (error) {
        console.error('Failed to dispatch SMS through Africa\'s Talking:', error);
      }
    }
  }

  /**
   * Verifies the OTP, invalidates it, registers user and boots profile if new, and signs a JWT.
   */
  public static async verifyOtp(phone: string, code: string, role?: Role) {
    const normalizedPhone = normalizePhone(phone);

    // 1. Find most recent unexpired and unused OtpCode
    const otpRecord = await prisma.otpCode.findFirst({
      where: {
        phone: normalizedPhone,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord || otpRecord.code !== code) {
      throw createError('Invalid or expired verification code', 'INVALID_OTP', 400);
    }

    // 2. Invalidate OTP code
    await prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { isUsed: true },
    });

    // 3. Find or register User
    let user = await prisma.user.findUnique({
      where: { phone: normalizedPhone },
      include: {
        farmerProfile: true,
        buyerProfile: true,
        transportProfile: true,
      },
    });

    if (!user) {
      if (!role) {
        throw createError('Registration requires a role (FARMER, BUYER, TRANSPORT, ADMIN)', 'ROLE_REQUIRED', 400);
      }

      // Create new user and corresponding profile details
      user = await prisma.user.create({
        data: {
          phone: normalizedPhone,
          name: 'New User',
          role,
          isVerified: false,
          ...(role === Role.FARMER && {
            farmerProfile: {
              create: {
                farmSizeAcres: null,
                primaryCrops: [],
              },
            },
          }),
          ...(role === Role.BUYER && {
            buyerProfile: {
              create: {
                businessType: BusinessType.RETAILER,
              },
            },
          }),
          ...(role === Role.TRANSPORT && {
            transportProfile: {
              create: {
                vehicleType: 'N/A',
                capacityKg: 0,
              },
            },
          }),
        },
        include: {
          farmerProfile: true,
          buyerProfile: true,
          transportProfile: true,
        },
      });
    }

    // 4. Generate JWT payload and token
    const payload: JWTPayload = {
      userId: user.id,
      role: user.role,
    };

    const token = jwt.sign(payload, config.JWT_SECRET, { expiresIn: '30d' });

    return {
      token,
      user,
    };
  }
}
