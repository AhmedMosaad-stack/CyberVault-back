/**
 * Unit tests for src/validators/auth.validator.js
 * Tests loginSchema valid and invalid inputs.
 */

import { loginSchema } from '../../../src/validators/auth.validator.js';

describe('auth validators', () => {
  describe('loginSchema', () => {
    test('valid loginSchema input passes', () => {
      const result = loginSchema.safeParse({
        bankUserId: '10000001',
        password: 'Admin@12345',
      });
      expect(result.success).toBe(true);
    });

    test('missing bankUserId fails', () => {
      const result = loginSchema.safeParse({
        password: 'Admin@12345',
      });
      expect(result.success).toBe(false);
    });

    test('empty password fails', () => {
      const result = loginSchema.safeParse({
        bankUserId: '10000001',
        password: '',
      });
      expect(result.success).toBe(false);
    });

    test('missing password fails', () => {
      const result = loginSchema.safeParse({
        bankUserId: '10000001',
      });
      expect(result.success).toBe(false);
    });

    test('empty bankUserId fails', () => {
      const result = loginSchema.safeParse({
        bankUserId: '',
        password: 'Admin@12345',
      });
      expect(result.success).toBe(false);
    });
  });
});
