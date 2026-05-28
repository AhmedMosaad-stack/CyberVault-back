import BaseRepository from './BaseRepository.js';
import AuditEvent from '../models/AuditEvent.model.js';

class AuditEventRepository extends BaseRepository {
  constructor() {
    super(AuditEvent);
  }

  async deleteByActorId(actorId, options = {}) {
    return this.delete({ actorId }, options);
  }
}

export default new AuditEventRepository();
