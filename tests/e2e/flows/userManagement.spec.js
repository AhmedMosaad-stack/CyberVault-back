import { test, expect } from '@playwright/test';

const adminCredentials = {
  bankUserId: process.env.STAGING_ADMIN_BANK_USER_ID || '10000001',
  password: process.env.STAGING_ADMIN_PASSWORD || 'Admin@12345'
};

const employeeCredentials = {
  bankUserId: '20000001',
  password: 'Employee@12345'
};

test.describe('User Management Flow', () => {
  let adminToken;
  let employeeToken;
  let createdUserId;
  let createdBankUserId;

  test.beforeAll(async ({ request }) => {
    let res = await request.post('/api/v1/auth/login', { data: adminCredentials });
    let body = await res.json();
    if (res.status() !== 200) console.log('Admin login failed:', body);
    adminToken = body.data.accessToken;

    res = await request.post('/api/v1/auth/login', { data: employeeCredentials });
    body = await res.json();
    if (res.status() !== 200) console.log('Employee login failed:', body);
    employeeToken = body.data.accessToken;
  });

  test.afterEach(async ({ request }) => {
    if (createdUserId) {
      await request.delete(`/api/v1/users/${createdUserId}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      createdUserId = null;
    }
  });

  test('1-5. Admin creates new user, user logs in and changes password', async ({ request }) => {
    // 1. Admin creates user
    const uniqueEmail = `testuser_${Date.now()}@test.com`;
    let res = await request.post('/api/v1/users', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        name: 'New E2E User',
        email: uniqueEmail,
        phone: '+201012345678',
        dateOfBirth: '1990-01-01',
        gender: 'male',
        account: { accountType: 'saving', currency: 'EGP', balance: 0 }
      }
    });
    expect(res.status()).toBe(201);
    let body = await res.json();
    createdUserId = body.data.user.id;
    createdBankUserId = body.data.user.bankUserId;

    // 2. User logs in with temporary password
    res = await request.post('/api/v1/auth/login', {
      data: { bankUserId: createdBankUserId, password: `Bank@${createdBankUserId}` }
    });
    body = await res.json();
    if (res.status() !== 200) console.log('Login failed:', JSON.stringify(body, null, 2));
    expect(res.status()).toBe(200);
    expect(body.data.mustChangePassword).toBe(true);
    const userToken = body.data.accessToken;

    // 3. GET /profile -> 403 MUST_CHANGE_PASSWORD
    res = await request.get('/api/v1/profile', {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    expect(res.status()).toBe(403);
    body = await res.json();
    expect(body.error.code).toBe('MUST_CHANGE_PASSWORD');

    // 4. Change password
    res = await request.patch('/api/v1/profile/password', {
      headers: { Authorization: `Bearer ${userToken}` },
      data: { currentPassword: `Bank@${createdBankUserId}`, newPassword: 'NewPassword@123' }
    });
    expect(res.status()).toBe(200);

    // 5. GET /profile -> 200
    const loginRes = await request.post('/api/v1/auth/login', {
      data: { bankUserId: createdBankUserId, password: 'NewPassword@123' }
    });
    const loginResBody = await loginRes.json();
    if (loginRes.status() !== 200) console.log('Re-login failed:', loginResBody);
    const newToken = loginResBody.data.accessToken;

    res = await request.get('/api/v1/profile', {
      headers: { Authorization: `Bearer ${newToken}` }
    });
    expect(res.status()).toBe(200);
  });

  test('6. Employee creates a new user', async ({ request }) => {
    const uniqueEmail2 = `empuser_${Date.now()}@test.com`;
    const res = await request.post('/api/v1/users', {
      headers: { Authorization: `Bearer ${employeeToken}` },
      data: {
        name: 'Employee Created User',
        email: uniqueEmail2,
        phone: '+201012345679',
        dateOfBirth: '1990-01-01',
        gender: 'female',
        account: { accountType: 'saving', currency: 'EGP', balance: 0 }
      }
    });
    expect(res.status()).toBe(201);
    createdUserId = (await res.json()).data.user.id;
  });

  test('7. Employee attempts to create an employee -> 403', async ({ request }) => {
    const res = await request.post('/api/v1/employees', {
      headers: { Authorization: `Bearer ${employeeToken}` },
      data: {
        name: 'Another Emp',
        email: 'another@test.com',
        phone: '+201012345670',
        dateOfBirth: '1990-01-01',
        gender: 'male',
        department: {
          departmentName: 'IT',
          departmentRegion: 'Cairo',
          departmentRole: 'developer'
        }
      }
    });
    expect(res.status()).toBe(403);
  });
});
