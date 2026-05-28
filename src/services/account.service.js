import AccountRepository from '../repositories/AccountRepository.js';
import { decrypt, hmacHash } from '../utils/encryption.js';

class AccountService {
  async lookupByAccountNumber(accountNumber) {
    const hash = hmacHash(accountNumber);
    const account = await AccountRepository.findByAccountNumberHash(hash);

    if (!account) {
      return { error: { code: 'ACCOUNT_NOT_FOUND', status: 404, message: 'Account not found' } };
    }

    const { default: UserRepository } = await import('../repositories/UserRepository.js');
    const user = await UserRepository.findById(account.userId);

    return {
      data: {
        id: account.id,
        accountNumber: decrypt(account.accountNumberEncrypted),
        currency: account.currency,
        accountStatus: account.accountStatus,
        owner: { name: user.name, bankUserId: user.bankUserId },
      },
    };
  }
}

export default new AccountService();
