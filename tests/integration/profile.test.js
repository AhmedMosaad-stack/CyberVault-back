/**
 * Integration tests for profile endpoints.
 * GET /api/v1/profile, PATCH /api/v1/profile, PATCH /api/v1/profile/password
 */

import supertest from 'supertest';
import { resetDatabase, teardownDatabase } from './setup/db.js';
import app from './setup/app.js';
import { createAdmin, createEmployee, createUser, loginAs, resetCounter } from './helpers/seed.helper.js';
import UserRepository from '../../src/repositories/UserRepository.js';

const request = supertest(app);

beforeAll(async () => {
  await resetDatabase();
  resetCounter();
});

afterAll(async () => {
  await teardownDatabase();
});

describe('Profile Integration', () => {
  let admin, adminToken;
  let employee, employeeToken;
  let user, userToken, userPassword, userBankUserId;

  beforeAll(async () => {
    const a = await createAdmin();
    admin = a.user; adminToken = a.token;

    const e = await createEmployee();
    employee = e.user; employeeToken = e.token;

    const u = await createUser();
    user = u.user; userToken = u.token; userPassword = u.password; userBankUserId = u.bankUserId;
  });

  describe('GET /api/v1/profile', () => {
    test('authenticated user → 200 with correct shape', async () => {
      const res = await request
        .get('/api/v1/profile')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.bankUserId).toBeDefined();
      expect(res.body.data.name).toBeDefined();
      expect(res.body.data.email).toBeDefined();
      expect(res.body.data.phone).toBeDefined();
      expect(res.body.data.account).toBeDefined();
      expect(res.body.data.account.accountNumber).toBeDefined();
      expect(typeof res.body.data.account.balance).toBe('number');
    });

    test('no token → 401 TOKEN_INVALID', async () => {
      const res = await request.get('/api/v1/profile');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('TOKEN_INVALID');
    });

    test('employee → department object populated', async () => {
      const res = await request
        .get('/api/v1/profile')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.department).toBeDefined();
      expect(res.body.data.department).not.toBeNull();
      expect(res.body.data.department.departmentName).toBeDefined();
    });

    test('user → department is null', async () => {
      const res = await request
        .get('/api/v1/profile')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.department).toBeNull();
    });
  });

  describe('PATCH /api/v1/profile', () => {
    test('valid fields (name, phone) → 200 updated', async () => {
      const res = await request
        .patch('/api/v1/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Updated Name', phone: '01111111111' });

      expect(res.status).toBe(200);

      // Verify via GET
      const getRes = await request
        .get('/api/v1/profile')
        .set('Authorization', `Bearer ${userToken}`);
      expect(getRes.body.data.name).toBe('Updated Name');
    });

    test('bankUserId in body → 200 but bankUserId unchanged', async () => {
      const originalBankUserId = userBankUserId;
      const res = await request
        .patch('/api/v1/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ bankUserId: '99999999' });

      expect(res.status).toBe(200);

      const getRes = await request
        .get('/api/v1/profile')
        .set('Authorization', `Bearer ${userToken}`);
      expect(getRes.body.data.bankUserId).toBe(originalBankUserId);
    });

    test('role in body → 200 but role unchanged', async () => {
      const res = await request
        .patch('/api/v1/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ role: 'admin' });

      expect(res.status).toBe(200);

      const getRes = await request
        .get('/api/v1/profile')
        .set('Authorization', `Bearer ${userToken}`);
      expect(getRes.body.data.role).toBe('user');
    });
  });

  describe('PATCH /api/v1/profile/password', () => {
    test('correct current password → 200', async () => {
      const res = await request
        .patch('/api/v1/profile/password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ currentPassword: userPassword, newPassword: 'NewStrong@123' });

      expect(res.status).toBe(200);
    });

    test('wrong current password → 401 INVALID_CURRENT_PASSWORD', async () => {
      const res = await request
        .patch('/api/v1/profile/password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ currentPassword: 'WrongCurrent@1', newPassword: 'NewStrong@999' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CURRENT_PASSWORD');
    });

    test('new password fails complexity → 400 VALIDATION_ERROR', async () => {
      const res = await request
        .patch('/api/v1/profile/password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ currentPassword: 'NewStrong@123', newPassword: 'weak' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('after password change → login with old password fails', async () => {
      const loginRes = await request
        .post('/api/v1/auth/login')
        .send({ bankUserId: userBankUserId, password: userPassword });

      expect(loginRes.status).toBe(401);
      expect(loginRes.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    test('after password change → login with new password succeeds', async () => {
      const loginRes = await request
        .post('/api/v1/auth/login')
        .send({ bankUserId: userBankUserId, password: 'NewStrong@123' });

      expect(loginRes.status).toBe(200);
    });

    test('after password change → mustChangePassword = false in DB', async () => {
      const dbUser = await UserRepository.findById(user.id);
      expect(dbUser.mustChangePassword).toBe(false);
    });
  });

  describe('mustChangePassword enforcement', () => {
    test('PATCH /profile/password with mustChangePassword:true token → 200 (exempt)', async () => {
      const mcpUser = await createUser({ mustChangePassword: true });

      const res = await request
        .patch('/api/v1/profile/password')
        .set('Authorization', `Bearer ${mcpUser.token}`)
        .send({ currentPassword: mcpUser.password, newPassword: 'Changed@12345' });

      expect(res.status).toBe(200);
    });

    test('any other endpoint with mustChangePassword:true token → 403 MUST_CHANGE_PASSWORD', async () => {
      const mcpUser = await createUser({ mustChangePassword: true });

      const res = await request
        .get('/api/v1/profile')
        .set('Authorization', `Bearer ${mcpUser.token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('MUST_CHANGE_PASSWORD');
    });
  });
});
