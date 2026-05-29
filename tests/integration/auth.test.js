/**
 * Integration tests for auth endpoints.
 * POST /api/v1/auth/login, /auth/refresh, /auth/logout
 */

import supertest from 'supertest';
import { resetDatabase, teardownDatabase } from './setup/db.js';
import app from './setup/app.js';
import { createAdmin, createUser, resetCounter } from './helpers/seed.helper.js';

const request = supertest(app);

beforeAll(async () => {
  await resetDatabase();
  resetCounter();
});

afterAll(async () => {
  await teardownDatabase();
});

describe('Auth Integration', () => {
  let admin, adminPassword, adminBankUserId;

  beforeAll(async () => {
    const res = await createAdmin();
    admin = res.user;
    adminPassword = res.password;
    adminBankUserId = res.bankUserId;
  });

  describe('POST /api/v1/auth/login', () => {
    test('valid credentials → 200', async () => {
      const res = await request
        .post('/api/v1/auth/login')
        .send({ bankUserId: adminBankUserId, password: adminPassword });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
    });

    test('wrong password → 401 INVALID_CREDENTIALS', async () => {
      const res = await request
        .post('/api/v1/auth/login')
        .send({ bankUserId: adminBankUserId, password: 'WrongPass@123' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    test('unknown bankUserId → 401 INVALID_CREDENTIALS', async () => {
      const res = await request
        .post('/api/v1/auth/login')
        .send({ bankUserId: '99999999', password: 'AnyPass@123' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    test('5 wrong attempts → locked → 6th attempt → ACCOUNT_LOCKED', async () => {
      const userRes = await createUser();
      const uid = userRes.bankUserId;

      // 5 wrong attempts
      for (let i = 0; i < 5; i++) {
        await request
          .post('/api/v1/auth/login')
          .send({ bankUserId: uid, password: 'WrongPass@123' });
      }

      // 6th attempt
      const res = await request
        .post('/api/v1/auth/login')
        .send({ bankUserId: uid, password: 'WrongPass@123' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('ACCOUNT_LOCKED');
      expect(res.body.error.details.remainingSeconds).toBeGreaterThan(0);
    });

    test('inactive user → 400 ACCOUNT_INACTIVE', async () => {
      const userRes = await createUser({ isActive: false });

      const res = await request
        .post('/api/v1/auth/login')
        .send({ bankUserId: userRes.bankUserId, password: userRes.password });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');
    });

    test('success → Set-Cookie header contains refreshToken with HttpOnly', async () => {
      const res = await request
        .post('/api/v1/auth/login')
        .send({ bankUserId: adminBankUserId, password: adminPassword });

      expect(res.status).toBe(200);
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const refreshCookie = cookies.find(c => c.startsWith('refreshToken='));
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain('HttpOnly');
    });

    test('success → response body has accessToken + mustChangePassword + user shape', async () => {
      const res = await request
        .post('/api/v1/auth/login')
        .send({ bankUserId: adminBankUserId, password: adminPassword });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.mustChangePassword).toBeDefined();
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.id).toBeDefined();
      expect(res.body.data.user.bankUserId).toBe(adminBankUserId);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    test('valid cookie → 200 with new accessToken', async () => {
      const loginRes = await request
        .post('/api/v1/auth/login')
        .send({ bankUserId: adminBankUserId, password: adminPassword });

      const cookies = loginRes.headers['set-cookie'];

      const res = await request
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookies);

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
    });

    test('no cookie → 401 TOKEN_INVALID', async () => {
      const res = await request
        .post('/api/v1/auth/refresh');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('TOKEN_INVALID');
    });

    test('reuse revoked token → 401 TOKEN_REUSE_DETECTED', async () => {
      const loginRes = await request
        .post('/api/v1/auth/login')
        .send({ bankUserId: adminBankUserId, password: adminPassword });

      const cookies = loginRes.headers['set-cookie'];

      // First refresh — rotates the token
      await request
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookies);

      // Second refresh with same (now revoked) cookie
      const res = await request
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookies);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('TOKEN_REUSE_DETECTED');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    test('valid token + cookie → 200', async () => {
      const loginRes = await request
        .post('/api/v1/auth/login')
        .send({ bankUserId: adminBankUserId, password: adminPassword });

      const { accessToken } = loginRes.body.data;
      const cookies = loginRes.headers['set-cookie'];

      const res = await request
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', cookies);

      expect(res.status).toBe(200);
    });

    test('no token → 401 TOKEN_INVALID', async () => {
      const res = await request
        .post('/api/v1/auth/logout');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('TOKEN_INVALID');
    });

    test('after logout: refresh with same cookie → 401', async () => {
      const loginRes = await request
        .post('/api/v1/auth/login')
        .send({ bankUserId: adminBankUserId, password: adminPassword });

      const { accessToken } = loginRes.body.data;
      const cookies = loginRes.headers['set-cookie'];

      // Logout
      await request
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', cookies);

      // Try refresh with revoked cookie
      const res = await request
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookies);

      expect(res.status).toBe(401);
    });
  });
});
