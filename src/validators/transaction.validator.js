import { z } from 'zod';

const amountSchema = z
  .number()
  .positive('Amount must be greater than 0')
  .multipleOf(0.01, 'Amount must have at most 2 decimal places');

const creditSchema = z.object({
  accountNumber: z.string().min(1, 'Account number is required'),
  amount: amountSchema,
  description: z.string().optional(),
});

const debitSchema = z.object({
  accountNumber: z.string().min(1, 'Account number is required'),
  amount: amountSchema,
  description: z.string().optional(),
});

const transferSchema = z.object({
  sourceAccountNumber: z.string().min(1, 'Source account number is required'),
  destinationAccountNumber: z.string().min(1, 'Destination account number is required'),
  amount: amountSchema,
  description: z.string().optional(),
});

export { creditSchema, debitSchema, transferSchema };
