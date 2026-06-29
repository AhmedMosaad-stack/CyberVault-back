import crypto from 'crypto';
import UserRepository from '../repositories/UserRepository.js';

/**
 * Generate a unique 8-digit bankUserId.
 * The bankUserId is the user's permanent login ID — auto-generated, immutable.
 * Range: 30000001 – 99999999
 *
 * @returns {Promise<string>} 8-digit numeric string
 */
async function generateBankUserId() {
  const MAX_ATTEMPTS = 100;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Range 30000001–99999999 (upper bound exclusive in randomInt).
    const bankUserId = crypto.randomInt(30000001, 100000000).toString();

    const existing = await UserRepository.findByBankUserId(bankUserId);
    if (!existing) {
      return bankUserId;
    }
  }

  throw new Error('Failed to generate unique bankUserId after maximum attempts');
}

export { generateBankUserId };
