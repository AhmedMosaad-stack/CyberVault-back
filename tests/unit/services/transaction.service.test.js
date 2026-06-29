/**
 * Unit tests for src/services/transaction.service.js
 * All repositories mocked. Verify balance is never mutated when rules are violated.
 */

import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// ── Mocks ──────────────────────────────────────────────────────────
const mockFindByAccountNumberHash = jest.fn();
const mockCreditBalance = jest.fn().mockResolvedValue(true);
const mockDebitBalance = jest.fn();
const mockFindByUserId_Account = jest.fn();
const mockFindById_Account = jest.fn();

jest.unstable_mockModule('../../../src/repositories/AccountRepository.js', () => ({
  default: {
    findByAccountNumberHash: mockFindByAccountNumberHash,
    creditBalance: mockCreditBalance,
    debitBalance: mockDebitBalance,
    findByUserId: mockFindByUserId_Account,
    findById: mockFindById_Account,
  },
}));

const mockCreateTransaction = jest.fn();
jest.unstable_mockModule('../../../src/repositories/TransactionRepository.js', () => ({
  default: {
    create: mockCreateTransaction,
  },
}));

const mockCreateNotification = jest.fn().mockResolvedValue({ id: 1 });
jest.unstable_mockModule('../../../src/repositories/NotificationRepository.js', () => ({
  default: {
    create: mockCreateNotification,
  },
}));

jest.unstable_mockModule('../../../src/repositories/AuditEventRepository.js', () => ({
  default: {
    create: jest.fn().mockResolvedValue({ id: 1 }),
  },
}));

// Mock BaseRepository.withTransaction to run callback directly (no real DB transaction)
jest.unstable_mockModule('../../../src/repositories/BaseRepository.js', () => {
  class MockBaseRepository {
    constructor() {
      this.model = null;
      this.sequelize = null;
    }
    async withTransaction(callback) {
      const mockTransaction = { id: 'mock-transaction' };
      return callback(mockTransaction);
    }
  }
  return { default: MockBaseRepository };
});

// Mock UserRepository — used by credit/debit/transfer to look up the
// account owner for notification emails.
jest.unstable_mockModule('../../../src/repositories/UserRepository.js', () => ({
  default: {
    findById: jest.fn().mockResolvedValue({ id: 1, name: 'Test', bankUserId: '30000001' }),
  },
}));

// Import after all mocks set up
const { default: transactionService } = await import('../../../src/services/transaction.service.js');

// ── Helpers ──────────────────────────────────────────────────────
function createMockAccount(overrides = {}) {
  return {
    id: 1,
    userId: 1,
    accountNumberEncrypted: 'mock-encrypted',
    accountNumberHash: 'mock-hash',
    accountType: 'saving',
    currency: 'EGP',
    balance: 10000,
    accountStatus: 'active',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  // Default: the post-mutation re-read inside the transaction returns an account.
  // Individual tests override the balance to assert balanceAfter.
  mockFindById_Account.mockResolvedValue(createMockAccount());
  mockCreateTransaction.mockResolvedValue({
    id: 1,
    type: 'credit',
    amount: 500,
    currency: 'EGP',
    balanceAfter: 10500,
    createdAt: new Date(),
  });
});

// ── Tests ────────────────────────────────────────────────────────
describe('TransactionService', () => {
  describe('credit', () => {
    test('credit to non-existent account returns ACCOUNT_NOT_FOUND (404)', async () => {
      mockFindByAccountNumberHash.mockResolvedValue(null);

      const result = await transactionService.credit('00000000000000', 500, null, 1, 'admin', '127.0.0.1');

      expect(result.error.code).toBe('ACCOUNT_NOT_FOUND');
      expect(result.error.status).toBe(404);
    });

    test('credit to frozen account returns ACCOUNT_FROZEN (403)', async () => {
      mockFindByAccountNumberHash.mockResolvedValue(createMockAccount({ accountStatus: 'frozen' }));

      const result = await transactionService.credit('10000000000001', 500, null, 1, 'admin', '127.0.0.1');

      expect(result.error.code).toBe('ACCOUNT_FROZEN');
      expect(result.error.status).toBe(403);
    });

    test('valid credit calls creditBalance with correct args', async () => {
      const account = createMockAccount();
      mockFindByAccountNumberHash.mockResolvedValue(account);

      await transactionService.credit('10000000000001', 500, null, 1, 'admin', '127.0.0.1');

      expect(mockCreditBalance).toHaveBeenCalledWith(account.id, 500, expect.anything());
    });

    test('balanceAfter is taken from the post-credit re-read, not the stale pre-read', async () => {
      mockFindByAccountNumberHash.mockResolvedValue(createMockAccount({ balance: 10000 }));
      // Simulate a concurrent credit: true post-mutation balance differs from 10000 + 500.
      mockFindById_Account.mockResolvedValue(createMockAccount({ balance: 11200 }));

      await transactionService.credit('10000000000001', 500, null, 1, 'admin', '127.0.0.1');

      expect(mockCreateTransaction.mock.calls[0][0].balanceAfter).toBe(11200);
    });
  });

  describe('debit', () => {
    test('debit with account owned by different user returns ACCOUNT_NOT_OWNED (403)', async () => {
      const account = createMockAccount({ userId: 999 }); // Different user
      mockFindByAccountNumberHash.mockResolvedValue(account);

      const result = await transactionService.debit('10000000000001', 500, null, 1, 'user', '127.0.0.1');

      expect(result.error.code).toBe('ACCOUNT_NOT_OWNED');
      expect(result.error.status).toBe(403);
      expect(mockDebitBalance).not.toHaveBeenCalled();
    });

    test('debit exact balance (result = 0.00) succeeds', async () => {
      const account = createMockAccount({ balance: 500, userId: 1 });
      mockFindByAccountNumberHash.mockResolvedValue(account);
      mockDebitBalance.mockResolvedValue(1); // 1 row affected

      mockCreateTransaction.mockResolvedValue({
        id: 1, type: 'debit', amount: 500, currency: 'EGP', balanceAfter: 0, createdAt: new Date(),
      });

      const result = await transactionService.debit('10000000000001', 500, null, 1, 'user', '127.0.0.1');

      expect(result.data).toBeDefined();
      expect(mockDebitBalance).toHaveBeenCalled();
    });

    test('debitBalance 0 rows affected throws INSUFFICIENT_FUNDS', async () => {
      const account = createMockAccount({ userId: 1 });
      mockFindByAccountNumberHash.mockResolvedValue(account);
      mockDebitBalance.mockResolvedValue(0); // 0 rows = insufficient funds guard

      await expect(
        transactionService.debit('10000000000001', 500, null, 1, 'user', '127.0.0.1')
      ).rejects.toThrow();
    });
  });

  describe('transfer', () => {
    test('transfer with source account owned by different user returns ACCOUNT_NOT_OWNED (403)', async () => {
      const fromAccount = createMockAccount({ id: 1, userId: 999, currency: 'EGP' });
      const toAccount = createMockAccount({ id: 2, userId: 2, currency: 'EGP' });
      mockFindByAccountNumberHash
        .mockResolvedValueOnce(fromAccount)
        .mockResolvedValueOnce(toAccount);

      const result = await transactionService.transfer('10000000000001', '10000000000002', 500, null, 1, 'user', '127.0.0.1');

      expect(result.error.code).toBe('ACCOUNT_NOT_OWNED');
      expect(result.error.status).toBe(403);
    });

    test('transfer where source is owned by logged-in user, destination is not — succeeds', async () => {
      const fromAccount = createMockAccount({ id: 1, userId: 1, currency: 'EGP' });
      const toAccount = createMockAccount({ id: 2, userId: 999, currency: 'EGP' });
      mockFindByAccountNumberHash
        .mockResolvedValueOnce(fromAccount)
        .mockResolvedValueOnce(toAccount);
      mockDebitBalance.mockResolvedValue(1);

      mockCreateTransaction.mockResolvedValue({
        id: 1, type: 'transfer', amount: 500, currency: 'EGP', balanceAfter: 9500, createdAt: new Date(),
      });

      const result = await transactionService.transfer('10000000000001', '10000000000002', 500, null, 1, 'user', '127.0.0.1');

      expect(result.data).toBeDefined();
    });

    test('transfer same account returns SAME_ACCOUNT (400)', async () => {
      const result = await transactionService.transfer('10000000000001', '10000000000001', 500, null, 1, 'user', '127.0.0.1');

      expect(result.error.code).toBe('SAME_ACCOUNT');
      expect(result.error.status).toBe(400);
    });

    test('transfer currency mismatch returns CURRENCY_MISMATCH (400)', async () => {
      const fromAccount = createMockAccount({ id: 1, userId: 1, currency: 'EGP' });
      const toAccount = createMockAccount({ id: 2, userId: 2, currency: 'USD' });
      mockFindByAccountNumberHash
        .mockResolvedValueOnce(fromAccount)
        .mockResolvedValueOnce(toAccount);

      const result = await transactionService.transfer('10000000000001', '10000000000002', 500, null, 1, 'user', '127.0.0.1');

      expect(result.error.code).toBe('CURRENCY_MISMATCH');
      expect(result.error.status).toBe(400);
    });

    test('transfer frozen source or destination returns ACCOUNT_FROZEN (403)', async () => {
      const fromAccount = createMockAccount({ id: 1, userId: 1, currency: 'EGP', accountStatus: 'frozen' });
      const toAccount = createMockAccount({ id: 2, userId: 2, currency: 'EGP' });
      mockFindByAccountNumberHash
        .mockResolvedValueOnce(fromAccount)
        .mockResolvedValueOnce(toAccount);

      const result = await transactionService.transfer('10000000000001', '10000000000002', 500, null, 1, 'user', '127.0.0.1');

      expect(result.error.code).toBe('ACCOUNT_FROZEN');
      expect(result.error.status).toBe(403);
    });

    test('transfer insufficient funds returns INSUFFICIENT_FUNDS (400)', async () => {
      const fromAccount = createMockAccount({ id: 1, userId: 1, currency: 'EGP', balance: 100 });
      const toAccount = createMockAccount({ id: 2, userId: 2, currency: 'EGP' });
      mockFindByAccountNumberHash
        .mockResolvedValueOnce(fromAccount)
        .mockResolvedValueOnce(toAccount);

      const result = await transactionService.transfer('10000000000001', '10000000000002', 500, null, 1, 'user', '127.0.0.1');

      expect(result.error.code).toBe('INSUFFICIENT_FUNDS');
      expect(result.error.status).toBe(400);
    });

    test('valid transfer calls debitBalance + creditBalance both with same transaction', async () => {
      const fromAccount = createMockAccount({ id: 1, userId: 1, currency: 'EGP', balance: 10000 });
      const toAccount = createMockAccount({ id: 2, userId: 2, currency: 'EGP' });
      mockFindByAccountNumberHash
        .mockResolvedValueOnce(fromAccount)
        .mockResolvedValueOnce(toAccount);
      mockDebitBalance.mockResolvedValue(1);

      mockCreateTransaction.mockResolvedValue({
        id: 1, type: 'transfer', amount: 500, currency: 'EGP', balanceAfter: 9500, createdAt: new Date(),
      });

      await transactionService.transfer('10000000000001', '10000000000002', 500, null, 1, 'user', '127.0.0.1');

      expect(mockDebitBalance).toHaveBeenCalledWith(fromAccount.id, 500, expect.anything());
      expect(mockCreditBalance).toHaveBeenCalledWith(toAccount.id, 500, expect.anything());

      // Both should be called with the same transaction object
      const debitTx = mockDebitBalance.mock.calls[0][2];
      const creditTx = mockCreditBalance.mock.calls[0][2];
      expect(debitTx).toBe(creditTx);
    });

    test('valid transfer calls TransactionRepository.create once with type transfer', async () => {
      const fromAccount = createMockAccount({ id: 1, userId: 1, currency: 'EGP', balance: 10000 });
      const toAccount = createMockAccount({ id: 2, userId: 2, currency: 'EGP' });
      mockFindByAccountNumberHash
        .mockResolvedValueOnce(fromAccount)
        .mockResolvedValueOnce(toAccount);
      mockDebitBalance.mockResolvedValue(1);

      mockCreateTransaction.mockResolvedValue({
        id: 1, type: 'transfer', amount: 500, currency: 'EGP', balanceAfter: 9500, createdAt: new Date(),
      });

      await transactionService.transfer('10000000000001', '10000000000002', 500, null, 1, 'user', '127.0.0.1');

      expect(mockCreateTransaction).toHaveBeenCalledTimes(1);
      expect(mockCreateTransaction.mock.calls[0][0].type).toBe('transfer');
    });

    test('valid transfer calls NotificationRepository.create twice (sender + receiver)', async () => {
      const fromAccount = createMockAccount({ id: 1, userId: 1, currency: 'EGP', balance: 10000 });
      const toAccount = createMockAccount({ id: 2, userId: 2, currency: 'EGP' });
      mockFindByAccountNumberHash
        .mockResolvedValueOnce(fromAccount)
        .mockResolvedValueOnce(toAccount);
      mockDebitBalance.mockResolvedValue(1);

      mockCreateTransaction.mockResolvedValue({
        id: 1, type: 'transfer', amount: 500, currency: 'EGP', balanceAfter: 9500, createdAt: new Date(),
      });

      await transactionService.transfer('10000000000001', '10000000000002', 500, null, 1, 'user', '127.0.0.1');

      expect(mockCreateNotification).toHaveBeenCalledTimes(2);
    });
  });
});
