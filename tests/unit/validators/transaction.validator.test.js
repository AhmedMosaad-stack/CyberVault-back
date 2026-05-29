/**
 * Unit tests for src/validators/transaction.validator.js
 * Tests creditSchema, debitSchema, transferSchema.
 */

import { creditSchema, debitSchema, transferSchema } from '../../../src/validators/transaction.validator.js';

describe('transaction validators', () => {
  describe('creditSchema', () => {
    test('valid input passes', () => {
      const result = creditSchema.safeParse({
        accountNumber: '10000000000001',
        amount: 500.00,
      });
      expect(result.success).toBe(true);
    });

    test('amount = 0 fails', () => {
      const result = creditSchema.safeParse({
        accountNumber: '10000000000001',
        amount: 0,
      });
      expect(result.success).toBe(false);
    });

    test('negative amount fails', () => {
      const result = creditSchema.safeParse({
        accountNumber: '10000000000001',
        amount: -100,
      });
      expect(result.success).toBe(false);
    });

    test('more than 2 decimal places fails', () => {
      const result = creditSchema.safeParse({
        accountNumber: '10000000000001',
        amount: 100.123,
      });
      expect(result.success).toBe(false);
    });

    test('missing accountNumber fails', () => {
      const result = creditSchema.safeParse({
        amount: 500,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('debitSchema', () => {
    test('valid input passes', () => {
      const result = debitSchema.safeParse({
        accountNumber: '10000000000001',
        amount: 250.50,
      });
      expect(result.success).toBe(true);
    });

    test('amount = 0 fails', () => {
      const result = debitSchema.safeParse({
        accountNumber: '10000000000001',
        amount: 0,
      });
      expect(result.success).toBe(false);
    });

    test('negative amount fails', () => {
      const result = debitSchema.safeParse({
        accountNumber: '10000000000001',
        amount: -50,
      });
      expect(result.success).toBe(false);
    });

    test('missing accountNumber fails', () => {
      const result = debitSchema.safeParse({
        amount: 100,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('transferSchema', () => {
    test('valid input passes', () => {
      const result = transferSchema.safeParse({
        sourceAccountNumber: '10000000000001',
        destinationAccountNumber: '10000000000002',
        amount: 300.00,
      });
      expect(result.success).toBe(true);
    });

    test('missing destinationAccountNumber fails', () => {
      const result = transferSchema.safeParse({
        sourceAccountNumber: '10000000000001',
        amount: 300,
      });
      expect(result.success).toBe(false);
    });

    test('amount = 0 fails', () => {
      const result = transferSchema.safeParse({
        sourceAccountNumber: '10000000000001',
        destinationAccountNumber: '10000000000002',
        amount: 0,
      });
      expect(result.success).toBe(false);
    });

    test('missing sourceAccountNumber fails', () => {
      const result = transferSchema.safeParse({
        destinationAccountNumber: '10000000000002',
        amount: 300,
      });
      expect(result.success).toBe(false);
    });
  });
});
