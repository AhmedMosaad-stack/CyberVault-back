import contactService from '../services/contact.service.js';

class ContactController {
  async submitMessage(req, res, next) {
    try {
      const result = await contactService.submitMessage(req.body);
      return res.status(201).json({ success: true, data: result.data });
    } catch (err) {
      next(err);
    }
  }
}

export default new ContactController();
