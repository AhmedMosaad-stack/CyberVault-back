/**
 * Unit tests for src/validators/contact.validator.js
 * Tests contactSchema.
 */

import { contactSchema } from '../../../src/validators/contact.validator.js';

describe('contact validators', () => {
  describe('contactSchema', () => {
    test('valid input passes', () => {
      const result = contactSchema.safeParse({
        email: 'user@example.com',
        subject: 'Account Inquiry',
        message: 'I have a question about my account balance.',
      });
      expect(result.success).toBe(true);
    });

    test('missing subject fails', () => {
      const result = contactSchema.safeParse({
        email: 'user@example.com',
        message: 'I have a question.',
      });
      expect(result.success).toBe(false);
      const subjectIssue = result.error.issues.find(
        (i) => i.path.includes('subject')
      );
      expect(subjectIssue).toBeDefined();
    });

    test('invalid email fails', () => {
      const result = contactSchema.safeParse({
        email: 'not-an-email',
        subject: 'Test Subject',
        message: 'Test message content.',
      });
      expect(result.success).toBe(false);
      const emailIssue = result.error.issues.find(
        (i) => i.path.includes('email')
      );
      expect(emailIssue).toBeDefined();
    });

    test('empty message fails', () => {
      const result = contactSchema.safeParse({
        email: 'user@example.com',
        subject: 'Test Subject',
        message: '',
      });
      expect(result.success).toBe(false);
    });

    test('missing email fails', () => {
      const result = contactSchema.safeParse({
        subject: 'Test Subject',
        message: 'Test message.',
      });
      expect(result.success).toBe(false);
    });
  });
});
