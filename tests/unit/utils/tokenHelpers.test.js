/**
 * Unit tests for src/utils/tokenHelpers.js
 * Tests signAccessToken, signRefreshToken, verifyAccessToken, hashToken.
 */

import jwt from 'jsonwebtoken';
import config from '../../../src/config/index.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  hashToken,
} from '../../../src/utils/tokenHelpers.js';

describe('tokenHelpers', () => {
  const samplePayload = {
    sub: 1,
    role: 'admin',
    bankUserId: '10000001',
    mustChangePassword: false,
  };

  test('signAccessToken(payload) returns a valid JWT', () => {
    const token = signAccessToken(samplePayload);
    const decoded = jwt.verify(token, config.JWT_SECRET);

    expect(decoded.sub).toBe(samplePayload.sub);
    expect(decoded.role).toBe(samplePayload.role);
  });

  test('signRefreshToken(payload) returns a valid JWT', () => {
    const refreshPayload = { sub: 1, family: 'test-family-uuid' };
    const token = signRefreshToken(refreshPayload);
    const decoded = jwt.verify(token, config.JWT_REFRESH_SECRET);

    expect(decoded.sub).toBe(refreshPayload.sub);
    expect(decoded.family).toBe(refreshPayload.family);
  });

  test('verifyAccessToken(token) returns decoded payload with all fields', () => {
    const token = signAccessToken(samplePayload);
    const decoded = verifyAccessToken(token);

    expect(decoded.sub).toBe(samplePayload.sub);
    expect(decoded.role).toBe(samplePayload.role);
    expect(decoded.bankUserId).toBe(samplePayload.bankUserId);
    expect(decoded.mustChangePassword).toBe(samplePayload.mustChangePassword);
  });

  test('verifyAccessToken(expiredToken) throws error', () => {
    // Sign token with 0s expiry
    const token = jwt.sign(samplePayload, config.JWT_SECRET, { expiresIn: '0s' });

    expect(() => verifyAccessToken(token)).toThrow();
    try {
      verifyAccessToken(token);
    } catch (err) {
      expect(err.name).toBe('TokenExpiredError');
    }
  });

  test('verifyAccessToken(tamperedToken) throws error', () => {
    const token = signAccessToken(samplePayload);
    const tampered = token.slice(0, -5) + 'xxxxx';

    expect(() => verifyAccessToken(tampered)).toThrow();
    try {
      verifyAccessToken(tampered);
    } catch (err) {
      expect(err.name).toBe('JsonWebTokenError');
    }
  });

  test('hashToken(rawToken) returns a 64-char hex string', () => {
    const raw = 'some-raw-token-value';
    const hash = hashToken(raw);

    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test('hashToken(rawToken) is deterministic', () => {
    const raw = 'some-raw-token-value';
    const hash1 = hashToken(raw);
    const hash2 = hashToken(raw);

    expect(hash1).toBe(hash2);
  });
});
