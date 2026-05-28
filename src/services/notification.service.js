import NotificationRepository from '../repositories/NotificationRepository.js';


class NotificationService {
  async getByUserId(userId) {
    const notifications = await NotificationRepository.findByUserId(userId);
    return { data: notifications };
  }

  async create(data) {
    const notification = await NotificationRepository.create(data);

    return notification;
  }
}

export default new NotificationService();
