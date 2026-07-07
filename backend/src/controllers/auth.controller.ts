import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import prisma from '../prisma/client';
import { createError } from '../utils/errors';
import { hashPassword } from '../utils/crypto';
import bcrypt from 'bcryptjs';

export class AuthController {
  /**
   * Request an OTP token for a specific phone number.
   */
  public static async requestOtp(req: Request, res: Response): Promise<void> {
    const { phone } = req.body;
    await AuthService.requestOtp(phone);
    res.status(200).json({ message: 'Verification code sent successfully.' });
  }

  /**
   * Verify the OTP token and return a signed JWT access token.
   */
  public static async verifyOtp(req: Request, res: Response): Promise<void> {
    const { phone, code, role } = req.body;
    const result = await AuthService.verifyOtp(phone, code, role);
    res.status(200).json(result);
  }

  /**
   * Get the current authenticated user and profile information.
   */
  public static async getMe(req: Request, res: Response): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: {
        farmerProfile: true,
        buyerProfile: true,
        transportProfile: true,
      },
    });

    if (!user) {
      throw createError('User session not found', 'USER_NOT_FOUND', 404);
    }

    res.status(200).json(user);
  }

  /**
   * Update the user profile attributes (name, region, district, lat/lng).
   */
  public static async updateProfile(req: Request, res: Response): Promise<void> {
    const {
      name,
      region,
      district,
      latitude,
      longitude,
      vehicleType,
      capacityKg,
      serviceRadiusKm,
      businessType,
      isAvailable,
      password,
      preferredLanguage,
      ussdPin,
    } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
    });

    if (ussdPin !== undefined) {
      if (!/^\d{4}$/.test(ussdPin)) {
        throw createError('USSD PIN must be a 4-digit numeric code', 'INVALID_PIN', 400);
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        ...(name !== undefined && { name }),
        ...(region !== undefined && { region }),
        ...(district !== undefined && { district }),
        ...(latitude !== undefined && { latitude }),
        ...(longitude !== undefined && { longitude }),
        ...(preferredLanguage !== undefined && { preferredLanguage }),
        ...(ussdPin !== undefined && {
          ussdPin: await bcrypt.hash(ussdPin, await bcrypt.genSalt(10)),
          ussdPinSetAt: new Date(),
        }),
        ...(password !== undefined && { passwordHash: hashPassword(password) }),
        ...(user?.role === 'TRANSPORT' && (vehicleType !== undefined || capacityKg !== undefined || serviceRadiusKm !== undefined || isAvailable !== undefined) && {
          transportProfile: {
            update: {
              ...(vehicleType !== undefined && { vehicleType }),
              ...(capacityKg !== undefined && { capacityKg }),
              ...(serviceRadiusKm !== undefined && { serviceRadiusKm }),
              ...(isAvailable !== undefined && { isAvailable }),
            },
          },
        }),
        ...(user?.role === 'BUYER' && businessType !== undefined && {
          buyerProfile: {
            update: {
              businessType: businessType as any,
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

    res.status(200).json(updatedUser);
  }

  /**
   * Log in a user using their phone and PBKDF2 password.
   */
  public static async loginPassword(req: Request, res: Response): Promise<void> {
    const { phone, password, role } = req.body;
    const result = await AuthService.loginWithPassword(phone, password, role);
    res.status(200).json(result);
  }
}
