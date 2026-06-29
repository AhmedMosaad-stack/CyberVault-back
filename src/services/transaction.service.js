import AccountRepository from '../repositories/AccountRepository.js';
import TransactionRepository from '../repositories/TransactionRepository.js';
import NotificationRepository from '../repositories/NotificationRepository.js';
import AuditEventRepository from '../repositories/AuditEventRepository.js';
import BaseRepository from '../repositories/BaseRepository.js';
import { decrypt, hmacHash } from '../utils/encryption.js';
import { sendTransactionEmail } from '../utils/email.js';


// BaseRepository instance solely for withTransaction()
const baseRepo = new BaseRepository(null);

class TransactionService {
  async lookupAccount(accountNumber) {
    const hash = hmacHash(accountNumber);
    const account = await AccountRepository.findByAccountNumberHash(hash);

    if (!account) {
      return { error: { code: 'ACCOUNT_NOT_FOUND', status: 404, message: 'Account not found' } };
    }

    // Lazy import to break circular dependency
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

  async credit(accountNumber, amount, description, initiatedBy, userRole, ipAddress) {
    const hash = hmacHash(accountNumber);
    const account = await AccountRepository.findByAccountNumberHash(hash);

    if (!account) {
      return { error: { code: 'ACCOUNT_NOT_FOUND', status: 404, message: 'Account not found' } };
    }
    if (account.accountStatus !== 'active') {
      return { error: { code: 'ACCOUNT_FROZEN', status: 403, message: 'Account is not active' } };
    }

    const transaction = await baseRepo.withTransaction(async (t) => {
      await AccountRepository.creditBalance(account.id, amount, t);
      return TransactionRepository.create(
        {
          type: 'credit',
          amount,
          currency: account.currency,
          fromAccountId: null,
          toAccountId: account.id,
          initiatedBy,
          balanceAfter: parseFloat(account.balance) + amount,
          description: description || null,
          status: 'completed',
        },
        { transaction: t }
      );
    });

    await NotificationRepository.create({
      userId: account.userId,
      type: 'credit',
      message: `Your account has been credited with ${amount} ${account.currency}`,
      relatedId: transaction.id,
    });

    await AuditEventRepository.create({
      actorId: initiatedBy,
      actorRole: userRole,
      action: 'CREDIT',
      targetId: transaction.id,
      targetType: 'Transaction',
      ipAddress,
    });

    const { default: UserRepository } = await import('../repositories/UserRepository.js');
    const user = await UserRepository.findById(account.userId);
    if (user && user.email) {
      sendTransactionEmail(
        user.email,
        user.name,
        'credit',
        amount,
        account.currency,
        transaction.balanceAfter,
        description
      );
    }

    return {
      data: {
        transaction: {
          id: transaction.id,
          type: transaction.type,
          amount: transaction.amount,
          currency: transaction.currency,
          balanceAfter: transaction.balanceAfter,
          createdAt: transaction.createdAt,
        },
      },
    };
  }

  async debit(accountNumber, amount, description, initiatedBy, userRole, ipAddress) {
    const hash = hmacHash(accountNumber);
    const account = await AccountRepository.findByAccountNumberHash(hash);

    if (!account) {
      return { error: { code: 'ACCOUNT_NOT_FOUND', status: 404, message: 'Account not found' } };
    }
    if (account.userId !== initiatedBy) {
      return { error: { code: 'ACCOUNT_NOT_OWNED', status: 403, message: 'You can only debit your own account' } };
    }
    if (account.accountStatus !== 'active') {
      return { error: { code: 'ACCOUNT_FROZEN', status: 403, message: 'Account is not active' } };
    }
    if (parseFloat(account.balance) - amount < 0) {
      return { error: { code: 'INSUFFICIENT_FUNDS', status: 400, message: 'Insufficient funds' } };
    }

    const transaction = await baseRepo.withTransaction(async (t) => {
      const affectedRows = await AccountRepository.debitBalance(account.id, amount, t);
      if (affectedRows === 0) {
        const err = new Error('Insufficient funds');
        err.code = 'INSUFFICIENT_FUNDS';
        err.status = 400;
        throw err;
      }
      return TransactionRepository.create(
        {
          type: 'debit',
          amount,
          currency: account.currency,
          fromAccountId: account.id,
          toAccountId: null,
          initiatedBy,
          balanceAfter: parseFloat(account.balance) - amount,
          description: description || null,
          status: 'completed',
        },
        { transaction: t }
      );
    });

    await NotificationRepository.create({
      userId: account.userId,
      type: 'debit',
      message: `Your account has been debited with ${amount} ${account.currency}`,
      relatedId: transaction.id,
    });

    await AuditEventRepository.create({
      actorId: initiatedBy,
      actorRole: userRole,
      action: 'DEBIT',
      targetId: transaction.id,
      targetType: 'Transaction',
      ipAddress,
    });

    const { default: UserRepository } = await import('../repositories/UserRepository.js');
    const user = await UserRepository.findById(account.userId);
    if (user && user.email) {
      sendTransactionEmail(
        user.email,
        user.name,
        'debit',
        amount,
        account.currency,
        transaction.balanceAfter,
        description
      );
    }

    return {
      data: {
        transaction: {
          id: transaction.id,
          type: transaction.type,
          amount: transaction.amount,
          currency: transaction.currency,
          balanceAfter: transaction.balanceAfter,
          createdAt: transaction.createdAt,
        },
      },
    };
  }

  async transfer(sourceAccountNumber, destinationAccountNumber, amount, description, initiatedBy, userRole, ipAddress) {
    if (sourceAccountNumber === destinationAccountNumber) {
      return { error: { code: 'SAME_ACCOUNT', status: 400, message: 'Cannot transfer to the same account' } };
    }

    const fromAccount = await AccountRepository.findByAccountNumberHash(hmacHash(sourceAccountNumber));
    const toAccount = await AccountRepository.findByAccountNumberHash(hmacHash(destinationAccountNumber));

    if (!fromAccount) {
      return { error: { code: 'ACCOUNT_NOT_FOUND', status: 404, message: 'Source account not found' } };
    }
    if (!toAccount) {
      return { error: { code: 'ACCOUNT_NOT_FOUND', status: 404, message: 'Destination account not found' } };
    }
    if (fromAccount.userId !== initiatedBy) {
      return { error: { code: 'ACCOUNT_NOT_OWNED', status: 403, message: 'You can only transfer from your own account' } };
    }
    if (fromAccount.accountStatus !== 'active' || toAccount.accountStatus !== 'active') {
      return { error: { code: 'ACCOUNT_FROZEN', status: 403, message: 'One or both accounts are not active' } };
    }
    if (fromAccount.currency !== toAccount.currency) {
      return { error: { code: 'CURRENCY_MISMATCH', status: 400, message: 'Transfer is only allowed between accounts of the same currency' } };
    }
    if (parseFloat(fromAccount.balance) - amount < 0) {
      return { error: { code: 'INSUFFICIENT_FUNDS', status: 400, message: 'Insufficient funds' } };
    }

    const transaction = await baseRepo.withTransaction(async (t) => {
      const affectedRows = await AccountRepository.debitBalance(fromAccount.id, amount, t);
      if (affectedRows === 0) {
        const err = new Error('Insufficient funds');
        err.code = 'INSUFFICIENT_FUNDS';
        err.status = 400;
        throw err;
      }
      await AccountRepository.creditBalance(toAccount.id, amount, t);
      return TransactionRepository.create(
        {
          type: 'transfer',
          amount,
          currency: fromAccount.currency,
          fromAccountId: fromAccount.id,
          toAccountId: toAccount.id,
          initiatedBy,
          balanceAfter: parseFloat(fromAccount.balance) - amount,
          description: description || null,
          status: 'completed',
        },
        { transaction: t }
      );
    });

    await NotificationRepository.create({
      userId: fromAccount.userId,
      type: 'transfer',
      message: `You transferred ${amount} ${fromAccount.currency} to another account`,
      relatedId: transaction.id,
    });

    await NotificationRepository.create({
      userId: toAccount.userId,
      type: 'transfer',
      message: `You received ${amount} ${toAccount.currency} from a transfer`,
      relatedId: transaction.id,
    });

    await AuditEventRepository.create({
      actorId: initiatedBy,
      actorRole: userRole,
      action: 'TRANSFER',
      targetId: transaction.id,
      targetType: 'Transaction',
      ipAddress,
    });

    const { default: UserRepository } = await import('../repositories/UserRepository.js');
    const fromUser = await UserRepository.findById(fromAccount.userId);
    if (fromUser && fromUser.email) {
      sendTransactionEmail(
        fromUser.email,
        fromUser.name,
        'transfer_sent',
        amount,
        fromAccount.currency,
        transaction.balanceAfter,
        description
      );
    }

    const toUser = await UserRepository.findById(toAccount.userId);
    if (toUser && toUser.email) {
      sendTransactionEmail(
        toUser.email,
        toUser.name,
        'transfer_received',
        amount,
        toAccount.currency,
        parseFloat(toAccount.balance) + amount,
        description
      );
    }

    return {
      data: {
        transaction: {
          id: transaction.id,
          type: transaction.type,
          amount: transaction.amount,
          currency: transaction.currency,
          balanceAfter: transaction.balanceAfter,
          createdAt: transaction.createdAt,
        },
      },
    };
  }

  async getHistory(userId, filters, pagination) {
    const account = await AccountRepository.findByUserId(userId);
    if (!account) {
      return { error: { code: 'ACCOUNT_NOT_FOUND', status: 404, message: 'No account found for this user' } };
    }
    return this._getHistoryByAccountId(account.id, filters, pagination);
  }

  async getHistoryByUserId(targetUserId, filters, pagination) {
    const account = await AccountRepository.findByUserId(targetUserId);
    if (!account) {
      return { error: { code: 'ACCOUNT_NOT_FOUND', status: 404, message: 'No account found for this user' } };
    }
    return this._getHistoryByAccountId(account.id, filters, pagination);
  }

  async _getHistoryByAccountId(accountId, filters, pagination) {
    const result = await TransactionRepository.findByAccountId(accountId, filters, pagination);

    const page = pagination.page || 1;
    const limit = Math.min(pagination.limit || 10, 100);
    const total = result.count;
    const pages = Math.ceil(total / limit);

    const data = await Promise.all(
      result.rows.map(async (tx) => {
        let destinationAccount = null;
        if (tx.type === 'transfer' && tx.toAccountId) {
          const destAccount = await AccountRepository.findById(tx.toAccountId);
          if (destAccount) {
            destinationAccount = decrypt(destAccount.accountNumberEncrypted);
          }
        }
        return {
          id: tx.id,
          type: tx.type,
          amount: tx.amount,
          currency: tx.currency,
          destinationAccount,
          description: tx.description,
          balanceAfter: tx.balanceAfter,
          createdAt: tx.createdAt,
        };
      })
    );

    return { data, pagination: { page, limit, total, pages } };
  }
}

export default new TransactionService();
