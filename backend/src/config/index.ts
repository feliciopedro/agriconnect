import dotenv from 'dotenv';
import { z } from 'zod';

// Load variables from .env file
dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  FRONTEND_URL: z.string().min(1, 'FRONTEND_URL is required'),
  AFRICAS_TALKING_USERNAME: z.string().default('sandbox'),
  AFRICAS_TALKING_API_KEY: z.string().default('mock_api_key'),
  PAYSTACK_SECRET_KEY: z.string().min(1, 'PAYSTACK_SECRET_KEY is required'),
  MNOTIFY_API_KEY: z.string().default('n2KEdiQig7Ru5OAOM7NRKNq7E'),
  MNOTIFY_SENDER_ID: z.string().default('mNotify'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid or missing environment configuration:');
  console.error(JSON.stringify(parsed.error.format(), null, 2));
  throw new Error('Invalid or missing environment configuration. Check server logs for details.');
}

export const config = parsed.data;
