import crypto from 'crypto';
import AccountRepository from '../repositories/AccountRepository.js';
import { hmacHash } from './encryption.js';

/**
 * Generate a unique 14-digit account number.
 * Format: 14 random digits (e.g., "12345678901234")
 *
 * @returns {Promise<string>} 14-digit numeric string
 */
async function generateAccountNumber() {
  const MAX_ATTEMPTS = 100;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // First digit 1–9 (no leading zero), then 13 digits 0–9.
    let accountNumber = crypto.randomInt(1, 10).toString();
    for (let i = 0; i < 13; i++) {
      accountNumber += crypto.randomInt(0, 10).toString();
    }

    const hash = hmacHash(accountNumber);
    const existing = await AccountRepository.findByAccountNumberHash(hash);
    if (!existing) {
      return accountNumber;
    }
  }

  throw new Error('Failed to generate unique account number after maximum attempts');
}

export { generateAccountNumber };
