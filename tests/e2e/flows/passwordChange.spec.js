import { test, expect } from '@playwright/test';

const e2eUser = { bankUserId: '39900003', password: 'E2eUser@12345' };
const tempPassword = 'NewPassword@123';

test.describe('Password Change Flow', () => {
  let u1Token;

  test.beforeAll(async ({ request }) => {
    const res = await request.post('/api/v1/auth/login', { data: e2eUser });
    u1Token = (await res.json()).data.accessToken;
  });

  test.afterAll(async ({ request }) => {
    // Reset back to original
    const res = await request.post('/api/v1/auth/login', {
      data: { bankUserId: e2eUser.bankUserId, password: tempPassword }
    });
    if (res.status() === 200) {
      const token = (await res.json()).data.accessToken;
      await request.patch('/api/v1/profile/password', {
        headers: { Authorization: `Bearer ${token}` },
        data: { currentPassword: tempPassword, newPassword: e2eUser.password }
      });
    }
  });

  test('1. Change password with correct current password', async ({ request }) => {
    const res = await request.patch('/api/v1/profile/password', {
      headers: { Authorization: `Bearer ${u1Token}` },
      data: { currentPassword: e2eUser.password, newPassword: tempPassword }
    });
    expect(res.status()).toBe(200);
  });

  test('2. Login with old password -> 401', async ({ request }) => {
    const res = await request.post('/api/v1/auth/login', { data: e2eUser });
    expect(res.status()).toBe(401);
  });

  test('3. Login with new password -> 200', async ({ request }) => {
    const res = await request.post('/api/v1/auth/login', {
      data: { bankUserId: e2eUser.bankUserId, password: tempPassword }
    });
    expect(res.status()).toBe(200);
  });

  test('4. Change password with wrong current password -> 401', async ({ request }) => {
    const res = await request.post('/api/v1/auth/login', {
      data: { bankUserId: e2eUser.bankUserId, password: tempPassword }
    });
    const token = (await res.json()).data.accessToken;
    
    const changeRes = await request.patch('/api/v1/profile/password', {
      headers: { Authorization: `Bearer ${token}` },
      data: { currentPassword: 'WrongPassword@123', newPassword: 'Another@123' }
    });
    expect(changeRes.status()).toBe(401);
  });
});
