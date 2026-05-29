/**
 * Unit tests for src/utils/encryption.js
 * Tests encrypt, decrypt, and hmacHash functions.
 */

import { encrypt, decrypt, hmacHash } from '../../../src/utils/encryption.js';

describe('encryption utilities', () => {
  describe('encrypt / decrypt', () => {
    test('encrypt(plaintext) returns iv:authTag:ciphertext format', () => {
      const result = encrypt('hello world');
      const parts = result.split(':');

      expect(parts).toHaveLength(3);
      // All segments are non-empty hex strings
      parts.forEach((part) => {
        expect(part.length).toBeGreaterThan(0);
        expect(part).toMatch(/^[0-9a-f]+$/);
      });
    });

    test('decrypt(encrypt(value)) equals original plaintext', () => {
      const original = 'sensitive-data-12345';
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(original);
    });

    test('two encrypt() calls on same value produce different ciphertexts', () => {
      const value = 'same-input-value';
      const encrypted1 = encrypt(value);
      const encrypted2 = encrypt(value);

      // IV is random per call, so ciphertexts must differ
      expect(encrypted1).not.toBe(encrypted2);
    });

    test('decrypt() throws on tampered ciphertext', () => {
      const encrypted = encrypt('test data');
      const parts = encrypted.split(':');

      // Tamper with the ciphertext portion
      const tampered = `${parts[0]}:${parts[1]}:${'ff'.repeat(parts[2].length / 2)}`;

      expect(() => decrypt(tampered)).toThrow();
    });
  });

  describe('hmacHash', () => {
    test('hmacHash(value) is deterministic', () => {
      const value = 'test-value-for-hash';
      const hash1 = hmacHash(value);
      const hash2 = hmacHash(value);

      expect(hash1).toBe(hash2);
      // SHA-256 produces 64-char hex string
      expect(hash1).toHaveLength(64);
      expect(hash1).toMatch(/^[0-9a-f]{64}$/);
    });

    test('hmacHash(value) output never equals input', () => {
      const value = 'some-plaintext';
      const hash = hmacHash(value);

      expect(hash).not.toBe(value);
    });
  });
});
