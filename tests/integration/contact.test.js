/**
 * Integration tests for contact endpoint.
 * POST /api/v1/contact
 */

import supertest from 'supertest';
import { resetDatabase, teardownDatabase } from './setup/db.js';
import app from './setup/app.js';
import { resetCounter } from './helpers/seed.helper.js';
import ContactMessageRepository from '../../src/repositories/ContactMessageRepository.js';

const request = supertest(app);

beforeAll(async () => {
  await resetDatabase();
  resetCounter();
});

afterAll(async () => {
  await teardownDatabase();
});

describe('Contact Integration', () => {
  test('POST /contact valid body → 201, row exists in DB', async () => {
    const res = await request
      .post('/api/v1/contact')
      .send({
        email: 'user@example.com',
        subject: 'Account Inquiry',
        message: 'I have a question about my account.',
      });

    expect(res.status).toBe(201);

    // Verify in DB
    const messages = await ContactMessageRepository.findAll({ email: 'user@example.com' });
    expect(messages.length).toBeGreaterThanOrEqual(1);
  });

  test('POST /contact missing subject → 400 VALIDATION_ERROR with field subject', async () => {
    const res = await request
      .post('/api/v1/contact')
      .send({
        email: 'user@example.com',
        message: 'Some message',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const subjectDetail = res.body.error.details.find(d => d.field === 'subject');
    expect(subjectDetail).toBeDefined();
  });

  test('POST /contact invalid email → 400 VALIDATION_ERROR with field email', async () => {
    const res = await request
      .post('/api/v1/contact')
      .send({
        email: 'not-an-email',
        subject: 'Test',
        message: 'Some message',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const emailDetail = res.body.error.details.find(d => d.field === 'email');
    expect(emailDetail).toBeDefined();
  });

  test('POST /contact empty message → 400 VALIDATION_ERROR', async () => {
    const res = await request
      .post('/api/v1/contact')
      .send({
        email: 'user@example.com',
        subject: 'Test',
        message: '',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
