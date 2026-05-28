import { Op } from 'sequelize';
import BaseRepository from './BaseRepository.js';
import User from '../models/User.model.js';

class UserRepository extends BaseRepository {
  constructor() {
    super(User);
  }

  async findByBankUserId(bankUserId, options = {}) {
    return this.findOne({ bankUserId }, options);
  }

  async findByEmail(email, options = {}) {
    return this.findOne({ email }, options);
  }

  async findByNationalIdHash(hash, options = {}) {
    return this.findOne({ nationalIdHash: hash }, options);
  }

  async incrementFailedAttempts(id, options = {}) {
    return this.model.increment('failedLoginAttempts', {
      by: 1,
      where: { id },
      ...options,
    });
  }

  async resetLoginAttempts(id, options = {}) {
    return this.update({ id }, { failedLoginAttempts: 0, lockoutUntil: null }, options);
  }

  async lockUser(id, lockoutUntil, options = {}) {
    return this.update({ id }, { lockoutUntil }, options);
  }

  async setMustChangePassword(id, value, options = {}) {
    return this.update({ id }, { mustChangePassword: value }, options);
  }

  async searchUsers(filters = {}, pagination = {}) {
    const where = {};

    if (filters.name) {
      where.name = { [Op.like]: `%${filters.name}%` };
    }
    if (filters.email) {
      where.email = { [Op.like]: `%${filters.email}%` };
    }
    if (filters.bankUserId) {
      where.bankUserId = filters.bankUserId;
    }
    if (filters.role) {
      where.role = filters.role;
    }

    const page = pagination.page || 1;
    const limit = Math.min(pagination.limit || 10, 100);
    const offset = (page - 1) * limit;

    return this.findAndCountAll(where, {
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      attributes: [
        'id',
        'bankUserId',
        'name',
        'email',
        'role',
        'isActive',
        'mustChangePassword',
        'createdAt',
      ],
    });
  }
}

export default new UserRepository();
