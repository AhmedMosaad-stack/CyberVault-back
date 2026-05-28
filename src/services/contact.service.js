import ContactMessageRepository from '../repositories/ContactMessageRepository.js';


class ContactService {
  async submitMessage(data) {
    await ContactMessageRepository.create(data);

    return { data: { message: 'Message received' } };
  }
}

export default new ContactService();
