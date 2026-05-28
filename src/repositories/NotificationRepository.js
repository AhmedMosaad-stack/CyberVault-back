import BaseRepository from './BaseRepository.js';
import Notification from '../models/Notification.model.js';

class NotificationRepository extends BaseRepository {
  constructor() {
    super(Notification);
  }

  async findByUserId(userId, options = {}) {
    return this.findAll({ userId }, { order: [['createdAt', 'DESC']], ...options });
  }

  async deleteByUserId(userId, options = {}) {
    return this.delete({ userId }, options);
  }
}

export default new NotificationRepository();
