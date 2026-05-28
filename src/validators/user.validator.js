import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least 1 uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least 1 number')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain at least 1 special character');

const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Phone is required'),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format'),
  gender: z.enum(['male', 'female'], {
    errorMap: () => ({ message: 'Gender must be male or female' }),
  }),
  nationalId: z.string().optional(),
  account: z.object({
    accountType: z.enum(['saving', 'current', 'business'], {
      errorMap: () => ({ message: 'Account type must be saving, current, or business' }),
    }),
    currency: z.enum(['EGP', 'USD', 'EUR'], {
      errorMap: () => ({ message: 'Currency must be EGP, USD, or EUR' }),
    }),
    balance: z
      .number()
      .min(0, 'Balance must be >= 0')
      .multipleOf(0.01, 'Balance must have at most 2 decimal places'),
  }),
});

const createEmployeeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Phone is required'),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format'),
  gender: z.enum(['male', 'female'], {
    errorMap: () => ({ message: 'Gender must be male or female' }),
  }),
  nationalId: z.string().optional(),
  department: z.object({
    departmentName: z.string().min(1, 'Department name is required'),
    departmentRegion: z.string().min(1, 'Department region is required'),
    departmentRole: z.enum(['admin', 'employee'], {
      errorMap: () => ({ message: 'Department role must be admin or employee' }),
    }),
  }),
});

const updateUserSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  phone: z.string().optional(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format')
    .optional(),
  gender: z.enum(['male', 'female']).optional(),
  isActive: z.boolean().optional(),
  departmentName: z.string().optional(),
  departmentRegion: z.string().optional(),
});

const updateProfileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  phone: z.string().optional(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format')
    .optional(),
  gender: z.enum(['male', 'female']).optional(),
  departmentName: z.string().optional(),
  departmentRegion: z.string().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

export {
  createUserSchema,
  createEmployeeSchema,
  updateUserSchema,
  updateProfileSchema,
  changePasswordSchema,
  passwordSchema,
};
