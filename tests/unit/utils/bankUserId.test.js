/**
 * Unit tests for src/utils/bankUserId.js
 * Tests generateBankUserId function with mocked UserRepository.
 */

import { jest } from '@jest/globals';

// Mock the UserRepository to prevent DB calls
jest.unstable_mockModule('../../../src/repositories/UserRepository.js', () => ({
  default: {
    findByBankUserId: jest.fn().mockResolvedValue(null),
  },
}));

// Dynamic import after mock setup (required for ESM)
const { generateBankUserId } = await import('../../../src/utils/bankUserId.js');

describe('generateBankUserId', () => {
  test('returns an 8-digit numeric string', async () => {
    const id = await generateBankUserId();

    expect(id).toMatch(/^\d{8}$/);
  });

  test('1000 generated IDs have no duplicates', async () => {
    const ids = [];
    for (let i = 0; i < 1000; i++) {
      const id = await generateBankUserId();
      ids.push(id);
    }

    expect(new Set(ids).size).toBe(1000);
  });
});
