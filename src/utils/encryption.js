import crypto from 'crypto';
import config from '../config/index.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const KEY = Buffer.from(config.ENCRYPTION_KEY, 'hex'); // 32 bytes

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns: 'ivHex:authTagHex:ciphertextHex'
 *
 * @param {string} plaintext
 * @returns {string} Encrypted value in format iv:authTag:ciphertext (all hex)
 */
function encrypt(plaintext) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a stored encrypted value back to plaintext.
 *
 * @param {string} stored - Format: 'ivHex:authTagHex:ciphertextHex'
 * @returns {string} Decrypted plaintext
 */
function decrypt(stored) {
  const [ivHex, authTagHex, ciphertextHex] = stored.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Generate a deterministic HMAC-SHA256 hash for equality lookups.
 * Keyed with the same ENCRYPTION_KEY.
 *
 * @param {string} value - The value to hash
 * @returns {string} 64-char hex string
 */
function hmacHash(value) {
  return crypto.createHmac('sha256', KEY).update(value).digest('hex');
}

export { encrypt, decrypt, hmacHash };
