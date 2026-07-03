import { z } from 'zod';

export const BanUserSchema = z.object({
  reason: z.string().min(1, 'Reason for suspension is required'),
  expiresAt: z
    .string()
    .datetime({ message: 'Invalid expiration date format. Must be an ISO-8601 string.' })
    .nullable()
    .optional(),
});

export const UpdateConfigSchema = z.object({
  key: z.string().min(1, 'Configuration key is required'),
  value: z.string().min(1, 'Configuration value cannot be empty'),
});
