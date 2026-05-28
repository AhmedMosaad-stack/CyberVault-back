import { z } from 'zod';

const loginSchema = z.object({
  bankUserId: z
    .string()
    .min(1, 'bankUserId is required')
    .max(8, 'bankUserId must be at most 8 characters'),
  password: z.string().min(1, 'Password is required'),
});

export { loginSchema };
