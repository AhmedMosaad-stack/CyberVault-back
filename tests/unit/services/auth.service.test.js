/**
 * Unit tests for src/services/auth.service.js
 * All repository calls mocked with jest.unstable_mockModule(). No DB, no file I/O.
 */

import { jest, describe, test, expect, beforeAll, beforeEach } from '@jest/globals';

// ── Mocks ──────────────────────────────────────────────────────────
const mockFindByBankUserId = jest.fn();
const mockIncrementFailedAttempts = jest.fn();
const mockLockUser = jest.fn();
const mockResetLoginAttempts = jest.fn();
const mockFindById = jest.fn();

jest.unstable_mockModule('../../../src/repositories/UserRepository.js', () => ({
  default: {
    findByBankUserId: mockFindByBankUserId,
    incrementFailedAttempts: mockIncrementFailedAttempts,
    lockUser: mockLockUser,
    resetLoginAttempts: mockResetLoginAttempts,
    findById: mockFindById,
  },
}));

const mockCreateToken = jest.fn().mockResolvedValue({ id: 1 });
const mockFindByTokenHash = jest.fn();
const mockRevokeToken = jest.fn().mockResolvedValue(true);
const mockRevokeFamilyByUserId = jest.fn().mockResolvedValue(true);
const mockSetReplacedByHash = jest.fn().mockResolvedValue(true);

jest.unstable_mockModule('../../../src/repositories/RefreshTokenRepository.js', () => ({
  default: {
    create: mockCreateToken,
    findByTokenHash: mockFindByTokenHash,
    revokeToken: mockRevokeToken,
    revokeFamilyByUserId: mockRevokeFamilyByUserId,
    setReplacedByHash: mockSetReplacedByHash,
  },
}));

jest.unstable_mockModule('../../../src/repositories/AuditEventRepository.js', () => ({
  default: {
    create: jest.fn().mockResolvedValue({ id: 1 }),
  },
}));

// Import after mocks
const { default: authService } = await import('../../../src/services/auth.service.js');
const argon2 = await import('argon2');

// ── Helpers ──────────────────────────────────────────────────────
function createMockUser(overrides = {}) {
  return {
    id: 1,
    bankUserId: '10000001',
    name: 'Test User',
    email: 'test@test.com',
    passwordHash: null, // set in beforeAll
    role: 'admin',
    isActive: true,
    mustChangePassword: false,
    failedLoginAttempts: 0,
    lockoutUntil: null,
    ...overrides,
  };
}

let validPasswordHash;

beforeAll(async () => {
  validPasswordHash = await argon2.hash('CorrectPassword@1');
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────
describe('AuthService', () => {
  describe('login', () => {
    test('login with unknown bankUserId returns INVALID_CREDENTIALS (401)', async () => {
      mockFindByBankUserId.mockResolvedValue(null);

      const result = await authService.login('99999999', 'anypassword', '127.0.0.1');

      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('INVALID_CREDENTIALS');
      expect(result.error.status).toBe(401);
    });

    test('login with inactive user returns ACCOUNT_INACTIVE (400)', async () => {
      const user = createMockUser({ isActive: false, passwordHash: validPasswordHash });
      mockFindByBankUserId.mockResolvedValue(user);

      const result = await authService.login(user.bankUserId, 'CorrectPassword@1', '127.0.0.1');

      expect(result.error.code).toBe('ACCOUNT_INACTIVE');
      expect(result.error.status).toBe(400);
    });

    test('login with locked user returns ACCOUNT_LOCKED (401) with remainingSeconds', async () => {
      const lockoutUntil = new Date(Date.now() + 10 * 60 * 1000); // 10 min from now
      const user = createMockUser({ lockoutUntil, passwordHash: validPasswordHash });
      mockFindByBankUserId.mockResolvedValue(user);

      const result = await authService.login(user.bankUserId, 'CorrectPassword@1', '127.0.0.1');

      expect(result.error.code).toBe('ACCOUNT_LOCKED');
      expect(result.error.status).toBe(401);
      expect(result.error.details.remainingSeconds).toBeGreaterThan(0);
    });

    test('login with wrong password (0 prior failures) calls incrementFailedAttempts', async () => {
      const user = createMockUser({ failedLoginAttempts: 0, passwordHash: validPasswordHash });
      mockFindByBankUserId.mockResolvedValue(user);
      mockIncrementFailedAttempts.mockResolvedValue(true);

      const result = await authService.login(user.bankUserId, 'WrongPassword@1', '127.0.0.1');

      expect(result.error.code).toBe('INVALID_CREDENTIALS');
      expect(mockIncrementFailedAttempts).toHaveBeenCalledWith(user.id);
    });

    test('login with wrong password (4 prior failures → 5th) calls lockUser', async () => {
      const user = createMockUser({ failedLoginAttempts: 4, passwordHash: validPasswordHash });
      mockFindByBankUserId.mockResolvedValue(user);
      mockIncrementFailedAttempts.mockResolvedValue(true);
      mockLockUser.mockResolvedValue(true);

      const result = await authService.login(user.bankUserId, 'WrongPassword@1', '127.0.0.1');

      expect(result.error.code).toBe('INVALID_CREDENTIALS');
      expect(mockLockUser).toHaveBeenCalledWith(user.id, expect.any(Date));
    });

    test('login with correct password after lockout expired succeeds', async () => {
      const lockoutUntil = new Date(Date.now() - 1000); // Expired 1 second ago
      const user = createMockUser({ lockoutUntil, passwordHash: validPasswordHash });
      mockFindByBankUserId.mockResolvedValue(user);
      mockResetLoginAttempts.mockResolvedValue(true);

      const result = await authService.login(user.bankUserId, 'CorrectPassword@1', '127.0.0.1');

      expect(result.data).toBeDefined();
      expect(result.data.accessToken).toBeDefined();
      expect(mockResetLoginAttempts).toHaveBeenCalledWith(user.id);
    });

    test('login success with mustChangePassword: true includes it in response', async () => {
      const user = createMockUser({
        mustChangePassword: true,
        passwordHash: validPasswordHash,
      });
      mockFindByBankUserId.mockResolvedValue(user);
      mockResetLoginAttempts.mockResolvedValue(true);

      const result = await authService.login(user.bankUserId, 'CorrectPassword@1', '127.0.0.1');

      expect(result.data).toBeDefined();
      expect(result.data.mustChangePassword).toBe(true);
    });
  });

  describe('refresh', () => {
    test('refresh with valid unrevoked token returns new accessToken', async () => {
      // Create a real refresh token to parse
      const { signRefreshToken, hashToken } = await import('../../../src/utils/tokenHelpers.js');
      const rawToken = signRefreshToken({ sub: 1, family: 'test-family' });
      const tokenHash = hashToken(rawToken);

      mockFindByTokenHash.mockResolvedValue({
        id: 1,
        userId: 1,
        tokenHash,
        family: 'test-family',
        isRevoked: false,
      });

      const user = createMockUser({ passwordHash: validPasswordHash });
      mockFindById.mockResolvedValue(user);

      const result = await authService.refresh(rawToken);

      expect(result.data).toBeDefined();
      expect(result.data.accessToken).toBeDefined();
      expect(mockRevokeToken).toHaveBeenCalledWith(1);
    });

    test('refresh with revoked token calls revokeFamilyByUserId and returns TOKEN_REUSE_DETECTED', async () => {
      const { signRefreshToken, hashToken } = await import('../../../src/utils/tokenHelpers.js');
      const rawToken = signRefreshToken({ sub: 1, family: 'test-family' });
      const tokenHash = hashToken(rawToken);

      mockFindByTokenHash.mockResolvedValue({
        id: 1,
        userId: 1,
        tokenHash,
        family: 'test-family',
        isRevoked: true,
      });

      const result = await authService.refresh(rawToken);

      expect(result.error.code).toBe('TOKEN_REUSE_DETECTED');
      expect(result.error.status).toBe(401);
      expect(mockRevokeFamilyByUserId).toHaveBeenCalledWith(1, 'test-family');
    });
  });

  describe('logout', () => {
    test('logout calls revokeToken and does not throw', async () => {
      const { signRefreshToken, hashToken } = await import('../../../src/utils/tokenHelpers.js');
      const rawToken = signRefreshToken({ sub: 1, family: 'test-family' });
      const tokenHash = hashToken(rawToken);

      mockFindByTokenHash.mockResolvedValue({
        id: 1,
        userId: 1,
        tokenHash,
        isRevoked: false,
      });

      const result = await authService.logout(rawToken, 1, 'admin', '127.0.0.1');

      expect(result.data).toBeDefined();
      expect(mockRevokeToken).toHaveBeenCalledWith(1);
    });
  });
});
