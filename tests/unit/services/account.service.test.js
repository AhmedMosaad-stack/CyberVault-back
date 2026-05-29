/**
 * Unit tests for src/services/account.service.js
 */
import { jest } from '@jest/globals';

const mockFindByAccountNumberHash = jest.fn();
const mockFindById = jest.fn();

jest.unstable_mockModule('../../../src/repositories/AccountRepository.js', () => ({
  default: {
    findByAccountNumberHash: mockFindByAccountNumberHash,
  },
}));

jest.unstable_mockModule('../../../src/repositories/UserRepository.js', () => ({
  default: {
    findById: mockFindById,
  },
}));

jest.unstable_mockModule('../../../src/utils/encryption.js', () => ({
  hmacHash: jest.fn().mockReturnValue('hash'),
  decrypt: jest.fn().mockReturnValue('decrypted'),
}));

const { default: accountService } = await import('../../../src/services/account.service.js');

describe('AccountService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('lookupByAccountNumber returns 404 if not found', async () => {
    mockFindByAccountNumberHash.mockResolvedValue(null);
    const res = await accountService.lookupByAccountNumber('123');
    expect(res.error).toBeDefined();
    expect(res.error.code).toBe('ACCOUNT_NOT_FOUND');
  });

  test('lookupByAccountNumber returns account data', async () => {
    mockFindByAccountNumberHash.mockResolvedValue({ id: 1, userId: 1, accountNumberEncrypted: 'enc', currency: 'USD', accountStatus: 'ACTIVE' });
    mockFindById.mockResolvedValue({ name: 'Test', bankUserId: '123' });

    const res = await accountService.lookupByAccountNumber('123');
    expect(res.data).toBeDefined();
    expect(res.data.id).toBe(1);
  });
});
