/**
 * Unit tests for src/utils/accountNumber.js
 * Tests generateAccountNumber function with mocked repositories.
 */

import { jest } from '@jest/globals';

// Mock AccountRepository to prevent DB calls
jest.unstable_mockModule('../../../src/repositories/AccountRepository.js', () => ({
  default: {
    findByAccountNumberHash: jest.fn().mockResolvedValue(null),
  },
}));

// Dynamic import after mock setup (required for ESM)
const { generateAccountNumber } = await import('../../../src/utils/accountNumber.js');

describe('generateAccountNumber', () => {
  test('returns a 14-digit numeric string', async () => {
    const num = await generateAccountNumber();

    expect(num).toMatch(/^\d{14}$/);
  });

  test('1000 generated numbers have no duplicates', async () => {
    const nums = [];
    for (let i = 0; i < 1000; i++) {
      const num = await generateAccountNumber();
      nums.push(num);
    }

    expect(new Set(nums).size).toBe(1000);
  });
});
