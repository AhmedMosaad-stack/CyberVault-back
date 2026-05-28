import { Op } from 'sequelize';
import BaseRepository from './BaseRepository.js';
import RefreshToken from '../models/RefreshToken.model.js';

class RefreshTokenRepository extends BaseRepository {
  constructor() {
    super(RefreshToken);
  }

  async findByTokenHash(hash, options = {}) {
    return this.findOne({ tokenHash: hash }, options);
  }

  async revokeToken(id, options = {}) {
    return this.update({ id }, { isRevoked: true }, options);
  }

  async revokeFamilyByUserId(userId, family, options = {}) {
    return this.update({ userId, family }, { isRevoked: true }, options);
  }

  async deleteExpired() {
    return this.delete({ expiresAt: { [Op.lt]: new Date() } });
  }

  async setReplacedByHash(id, replacedByHash, options = {}) {
    return this.update({ id }, { replacedByHash }, options);
  }

  async deleteByUserId(userId, options = {}) {
    return this.delete({ userId }, options);
  }
}

export default new RefreshTokenRepository();
