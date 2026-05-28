import { z } from 'zod';

const contactSchema = z.object({
  email: z.string().email('Invalid email address'),
  subject: z.string().min(1, 'Subject is required').max(255),
  message: z.string().min(1, 'Message is required'),
});

export { contactSchema };
