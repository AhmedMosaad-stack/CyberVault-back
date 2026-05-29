import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../config/index.js';

/**
 * Sign an access token JWT.
 * Payload: { sub: userId, role, bankUserId, mustChangePassword }
 * Expiry: JWT_ACCESS_EXPIRES_IN (default 10m)
 *
 * @param {object} payload
 * @returns {string} Signed JWT
 */
function signAccessToken(payload) {
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_ACCESS_EXPIRES_IN,
  });
}

/**
 * Sign a refresh token JWT.
 * Payload: { sub: userId, family }
 * Expiry: JWT_REFRESH_EXPIRES_IN (default 30d)
 *
 * @param {object} payload
 * @returns {string} Signed JWT
 */
function signRefreshToken(payload) {
  return jwt.sign({ ...payload, jti: crypto.randomUUID() }, config.JWT_REFRESH_SECRET, {
    expiresIn: config.JWT_REFRESH_EXPIRES_IN,
  });
}

/**
 * Verify and decode an access token.
 * @param {string} token - Raw JWT string
 * @returns {object} Decoded payload
 * @throws {jwt.JsonWebTokenError|jwt.TokenExpiredError}
 */
function verifyAccessToken(token) {
  return jwt.verify(token, config.JWT_SECRET);
}

/**
 * Verify and decode a refresh token.
 * @param {string} token - Raw JWT string
 * @returns {object} Decoded payload
 * @throws {jwt.JsonWebTokenError|jwt.TokenExpiredError}
 */
function verifyRefreshToken(token) {
  return jwt.verify(token, config.JWT_REFRESH_SECRET);
}

/**
 * Hash a raw token with SHA-256.
 * Only the hash is stored in the database — raw tokens are never persisted.
 *
 * @param {string} raw - Raw JWT string
 * @returns {string} 64-char hex SHA-256 hash
 */
function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Parse a duration string like '30d' into milliseconds from now.
 * Supports: Ns (seconds), Nm (minutes), Nh (hours), Nd (days)
 *
 * @param {string} duration - e.g. '30d', '10m', '1h'
 * @returns {Date} Expiration date
 */
function expiresInToDate(duration) {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid duration format: ${duration}`);

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const ms = {
    s: value * 1000,
    m: value * 60 * 1000,
    h: value * 60 * 60 * 1000,
    d: value * 24 * 60 * 60 * 1000,
  }[unit];

  return new Date(Date.now() + ms);
}

export {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  expiresInToDate,
};
