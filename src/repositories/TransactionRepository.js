import { Op } from 'sequelize';
import BaseRepository from './BaseRepository.js';
import Transaction from '../models/Transaction.model.js';

class TransactionRepository extends BaseRepository {
  constructor() {
    super(Transaction);
  }

  /**
   * Find transactions by accountId with filters and pagination.
   * Matches transactions where the account is either sender or receiver.
   */
  async findByAccountId(accountId, filters = {}, pagination = {}) {
    const where = {
      [Op.or]: [{ fromAccountId: accountId }, { toAccountId: accountId }],
    };

    if (filters.type && filters.type !== 'All') {
      where.type = filters.type;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt[Op.gte] = new Date(filters.startDate);
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt[Op.lte] = end;
      }
    }

    if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
      where.amount = {};
      if (filters.minAmount !== undefined) {
        where.amount[Op.gte] = filters.minAmount;
      }
      if (filters.maxAmount !== undefined) {
        where.amount[Op.lte] = filters.maxAmount;
      }
    }

    const page = pagination.page || 1;
    const limit = Math.min(pagination.limit || 10, 100);
    const offset = (page - 1) * limit;

    return this.findAndCountAll(where, {
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });
  }
}

export default new TransactionRepository();
