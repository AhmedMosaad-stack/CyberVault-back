import { Sequelize } from 'sequelize';
import { sequelize } from '../config/db.js';

/**
 * BaseRepository — generic data access layer.
 * All database access is mediated through this class.
 * Services never call Sequelize directly.
 */
class BaseRepository {
  constructor(model) {
    this.model = model;
    this.sequelize = sequelize;
  }

  async findById(id, options = {}) {
    return this.model.findByPk(id, options);
  }

  async findOne(where, options = {}) {
    return this.model.findOne({ where, ...options });
  }

  async findAll(where = {}, options = {}) {
    return this.model.findAll({ where, ...options });
  }

  async create(data, options = {}) {
    return this.model.create(data, options);
  }

  async update(where, data, options = {}) {
    return this.model.update(data, { where, ...options });
  }

  async delete(where, options = {}) {
    return this.model.destroy({ where, ...options });
  }

  async count(where = {}) {
    return this.model.count({ where });
  }

  async findAndCountAll(where = {}, options = {}) {
    return this.model.findAndCountAll({ where, ...options });
  }

  /**
   * Execute a callback within a SERIALIZABLE transaction.
   * If callback throws, the transaction is automatically rolled back.
   *
   * @param {Function} callback - receives Sequelize transaction object `t`
   * @returns {*} Result of the callback
   */
  async withTransaction(callback) {
    return this.sequelize.transaction(
      { isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE },
      callback
    );
  }
}

export default BaseRepository;
