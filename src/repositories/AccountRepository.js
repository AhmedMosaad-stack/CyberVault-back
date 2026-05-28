import { QueryTypes } from 'sequelize';
import BaseRepository from './BaseRepository.js';
import Account from '../models/Account.model.js';

class AccountRepository extends BaseRepository {
  constructor() {
    super(Account);
  }

  async findByUserId(userId, options = {}) {
    return this.findOne({ userId }, options);
  }

  async findByAccountNumberHash(hash, options = {}) {
    return this.findOne({ accountNumberHash: hash }, options);
  }

  /**
   * Credit (add to) an account's balance atomically.
   * UPDATE accounts SET balance = balance + ? WHERE id = ?
   */
  async creditBalance(accountId, amount, transaction) {
    return this.model.increment('balance', {
      by: amount,
      where: { id: accountId },
      transaction,
    });
  }

  /**
   * Debit (subtract from) an account's balance atomically with balance guard.
   * UPDATE accounts SET balance = balance - ? WHERE id = ? AND balance >= ?
   *
   * Returns number of affected rows — 0 means insufficient funds (race condition).
   */
  async debitBalance(accountId, amount, transaction) {
    const [results] = await this.sequelize.query(
      'UPDATE accounts SET balance = balance - :amount, updatedAt = NOW() WHERE id = :accountId AND balance >= :amount',
      {
        replacements: { accountId, amount },
        type: QueryTypes.UPDATE,
        transaction,
      }
    );
    return results; // number of affected rows
  }
}

export default new AccountRepository();
