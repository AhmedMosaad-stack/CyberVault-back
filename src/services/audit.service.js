import AuditEventRepository from '../repositories/AuditEventRepository.js';


class AuditService {
  async create(data) {
    const event = await AuditEventRepository.create(data);

    return event;
  }
}

export default new AuditService();
