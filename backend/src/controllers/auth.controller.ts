import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import prisma from '../prisma/client';
import { createError } from '../utils/errors';

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
    const { name, region, district, latitude, longitude } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        ...(name !== undefined && { name }),
        ...(region !== undefined && { region }),
        ...(district !== undefined && { district }),
        ...(latitude !== undefined && { latitude }),
        ...(longitude !== undefined && { longitude }),
      },
      include: {
        farmerProfile: true,
        buyerProfile: true,
        transportProfile: true,
      },
    });

    res.status(200).json(updatedUser);
  }
}
