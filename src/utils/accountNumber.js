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
    let accountNumber = '';
    for (let i = 0; i < 14; i++) {
      accountNumber += Math.floor(Math.random() * 10).toString();
    }
    // Ensure it doesn't start with 0
    if (accountNumber[0] === '0') {
      accountNumber = (Math.floor(Math.random() * 9) + 1).toString() + accountNumber.slice(1);
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
