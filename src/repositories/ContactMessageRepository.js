import BaseRepository from './BaseRepository.js';
import ContactMessage from '../models/ContactMessage.model.js';

class ContactMessageRepository extends BaseRepository {
  constructor() {
    super(ContactMessage);
  }
}

export default new ContactMessageRepository();
