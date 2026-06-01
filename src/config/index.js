// import dotenv from 'dotenv';
import { z } from 'zod';



const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test', 'staging']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),

  // MySQL
  DB_HOST: z.string().min(1, 'DB_HOST is required'),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_NAME: z.string().min(1, 'DB_NAME is required'),
  DB_USER: z.string().min(1, 'DB_USER is required'),
  DB_PASSWORD: z.string().min(1, 'DB_PASSWORD is required'),
  DB_NAME_TEST: z.string().default('bank_test'),

  // JWT
  JWT_SECRET: z.string().min(64, 'JWT_SECRET must be at least 64 characters'),
  JWT_REFRESH_SECRET: z.string().min(64, 'JWT_REFRESH_SECRET must be at least 64 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('10m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // Encryption
  ENCRYPTION_KEY: z
    .string()
    .length(64, 'ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)')
    .regex(/^[0-9a-fA-F]+$/, 'ENCRYPTION_KEY must be a hex string'),

  // CORS
  CORS_ORIGINS: z.string().min(1, 'CORS_ORIGINS is required'),

  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'silent']).default('info'),

  // Email (future)
  CONTACT_EMAIL: z.string().email().default('mbadwy480@gmail.com'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const formatted = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  // eslint-disable-next-line no-console
  console.error(`\nEnvironment validation failed:\n${formatted}\n`);
  process.exit(1);
}

const config = Object.freeze({
  NODE_ENV: parsed.data.NODE_ENV,
  PORT: parsed.data.PORT,
  DB_HOST: parsed.data.DB_HOST,
  DB_PORT: parsed.data.DB_PORT,
  DB_NAME: parsed.data.NODE_ENV === 'test' ? parsed.data.DB_NAME_TEST : parsed.data.DB_NAME,
  DB_USER: parsed.data.DB_USER,
  DB_PASSWORD: parsed.data.DB_PASSWORD,
  DB_NAME_TEST: parsed.data.DB_NAME_TEST,
  JWT_SECRET: parsed.data.JWT_SECRET,
  JWT_REFRESH_SECRET: parsed.data.JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRES_IN: parsed.data.JWT_ACCESS_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN: parsed.data.JWT_REFRESH_EXPIRES_IN,
  ENCRYPTION_KEY: parsed.data.ENCRYPTION_KEY,
  CORS_ORIGINS: parsed.data.CORS_ORIGINS.split(',').map((s) => s.trim()),
  LOG_LEVEL: parsed.data.LOG_LEVEL,
  CONTACT_EMAIL: parsed.data.CONTACT_EMAIL,
});

export default config;
