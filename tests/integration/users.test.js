/**
 * Integration tests for user management endpoints.
 * GET /api/v1/users, POST /api/v1/users, PATCH /api/v1/users/:id, DELETE /api/v1/users/:id, etc.
 */

import supertest from 'supertest';
import { resetDatabase, teardownDatabase } from './setup/db.js';
import app from './setup/app.js';
import { createAdmin, createEmployee, createUser, resetCounter } from './helpers/seed.helper.js';

const request = supertest(app);

beforeAll(async () => {
  await resetDatabase();
  resetCounter();
});

afterAll(async () => {
  await teardownDatabase();
});

describe('Users Integration', () => {
  let admin, adminToken;
  let employee, employeeToken;
  let regularUser, regularUserToken;

  beforeAll(async () => {
    const a = await createAdmin();
    admin = a.user; adminToken = a.token;

    const e = await createEmployee();
    employee = e.user; employeeToken = e.token;

    const u = await createUser();
    regularUser = u.user; regularUserToken = u.token;
  });

  describe('GET /api/v1/users', () => {
    test('admin → 200 paginated list', async () => {
      const res = await request
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(3);
    });

    test('filter by role=user → only user entries', async () => {
      const res = await request
        .get('/api/v1/users?role=user')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      res.body.data.forEach(u => expect(u.role).toBe('user'));
    });

    test('filter by bankUserId → single match', async () => {
      const res = await request
        .get(`/api/v1/users?bankUserId=${regularUser.bankUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
    });

    test('regular user → 403 FORBIDDEN', async () => {
      const res = await request
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${regularUserToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('GET /api/v1/users/:id', () => {
    test('admin → 200 with decrypted fields', async () => {
      const res = await request
        .get(`/api/v1/users/${regularUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.phone).toBeDefined();
      expect(res.body.data.account).toBeDefined();
      expect(res.body.data.account.accountNumber).toBeDefined();
      expect(typeof res.body.data.account.balance).toBe('number');
    });

    test('non-existent id → 404 USER_NOT_FOUND', async () => {
      const res = await request
        .get('/api/v1/users/999999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('USER_NOT_FOUND');
    });
  });

  describe('POST /api/v1/users', () => {
    test('admin creates user → 201 with auto-generated bankUserId and temporaryPassword', async () => {
      const res = await request
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'New Test User',
          email: 'newuser@test.com',
          phone: '01555555555',
          dateOfBirth: '1995-05-15',
          gender: 'male',
          account: { accountType: 'saving', currency: 'EGP', balance: 0 },
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.bankUserId).toMatch(/^\d{8}$/);
      expect(res.body.data.temporaryPassword).toBe(`Bank@${res.body.data.user.bankUserId}`);
    });

    test('duplicate email → 409 EMAIL_EXISTS', async () => {
      const res = await request
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Duplicate Email',
          email: 'newuser@test.com',
          phone: '01666666666',
          dateOfBirth: '1995-05-15',
          gender: 'female',
          account: { accountType: 'saving', currency: 'EGP', balance: 0 },
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EMAIL_EXISTS');
    });

    test('missing required field → 400 VALIDATION_ERROR', async () => {
      const res = await request
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'No Email User',
          phone: '01777777777',
          dateOfBirth: '1995-05-15',
          gender: 'male',
          account: { accountType: 'saving', currency: 'EGP', balance: 0 },
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('employee creates user → 201', async () => {
      const res = await request
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          name: 'Employee Created User',
          email: 'empcreated@test.com',
          phone: '01888888888',
          dateOfBirth: '2000-03-20',
          gender: 'female',
          account: { accountType: 'current', currency: 'USD', balance: 100 },
        });

      expect(res.status).toBe(201);
    });
  });

  describe('POST /api/v1/employees', () => {
    test('admin creates employee → 201 with departmentStatus active', async () => {
      const res = await request
        .post('/api/v1/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'New Employee',
          email: 'newemp@test.com',
          phone: '01999999999',
          dateOfBirth: '1992-08-10',
          gender: 'male',
          department: {
            departmentName: 'Finance',
            departmentRegion: 'Giza',
            departmentRole: 'employee',
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe('employee');
      expect(res.body.data.department.departmentStatus).toBe('active');
      expect(res.body.data.department.departmentSince).toBeDefined();
    });

    test('employee creates employee → 403 FORBIDDEN', async () => {
      const res = await request
        .post('/api/v1/employees')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          name: 'Unauthorized Employee',
          email: 'unauthemp@test.com',
          phone: '01000111222',
          dateOfBirth: '1990-01-01',
          gender: 'female',
          department: {
            departmentName: 'HR',
            departmentRegion: 'Cairo',
            departmentRole: 'employee',
          },
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('PATCH /api/v1/users/:id', () => {
    test('admin updates name → 200', async () => {
      const res = await request
        .patch(`/api/v1/users/${regularUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Admin Updated Name' });

      expect(res.status).toBe(200);
    });

    test('admin sets isActive: false → user can no longer log in', async () => {
      const deactivateUser = await createUser();

      await request
        .patch(`/api/v1/users/${deactivateUser.user.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });

      const loginRes = await request
        .post('/api/v1/auth/login')
        .send({ bankUserId: deactivateUser.bankUserId, password: deactivateUser.password });

      expect(loginRes.status).toBe(400);
      expect(loginRes.body.error.code).toBe('ACCOUNT_INACTIVE');
    });
  });

  describe('DELETE /api/v1/users/:id', () => {
    test('admin deletes user → 200', async () => {
      const delUser = await createUser();

      const res = await request
        .delete(`/api/v1/users/${delUser.user.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    test('employee deletes user → 403 FORBIDDEN', async () => {
      const delUser = await createUser();

      const res = await request
        .delete(`/api/v1/users/${delUser.user.id}`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('delete last admin → 409 CANNOT_DELETE_ADMIN', async () => {
      const res = await request
        .delete(`/api/v1/users/${admin.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CANNOT_DELETE_ADMIN');
    });
  });

  describe('PATCH /api/v1/users/:id/unlock', () => {
    test('admin unlocks locked user → 200', async () => {
      const lockedUser = await createUser();

      // Lock by 5 wrong attempts
      for (let i = 0; i < 5; i++) {
        await request
          .post('/api/v1/auth/login')
          .send({ bankUserId: lockedUser.bankUserId, password: 'WrongPass@1' });
      }

      const res = await request
        .patch(`/api/v1/users/${lockedUser.user.id}/unlock`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    test('employee unlocks user → 403 FORBIDDEN', async () => {
      const lockedUser = await createUser();

      const res = await request
        .patch(`/api/v1/users/${lockedUser.user.id}/unlock`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Pagination', () => {
    test('5 users, page=2&limit=2 → correct pagination', async () => {
      // We already have multiple users from above tests, let's ensure at least 5
      await createUser();
      await createUser();

      const res = await request
        .get('/api/v1/users?page=2&limit=2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(5);
      expect(res.body.pagination.pages).toBeGreaterThanOrEqual(3);
    });
  });
});
