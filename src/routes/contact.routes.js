import { Router } from 'express';
import contactController from '../controllers/contact.controller.js';
import validate from '../middleware/validate.js';
import { contactSchema } from '../validators/contact.validator.js';

const router = Router();

router.post('/', validate(contactSchema), (req, res, next) =>
  contactController.submitMessage(req, res, next)
);

export default router;
