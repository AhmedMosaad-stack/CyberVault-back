import { test, expect } from '@playwright/test';

const adminCredentials = {
  bankUserId: process.env.STAGING_ADMIN_BANK_USER_ID || '10000001',
  password: process.env.STAGING_ADMIN_PASSWORD || 'Admin@12345'
};

test.describe('Auth Flow', () => {
  let accessToken;
  let refreshCookie;

  test('1. Login with valid admin credentials', async ({ request }) => {
    const res = await request.post('/api/v1/auth/login', { data: adminCredentials });
    expect(res.status()).toBe(200);
    const body = await res.json();
    accessToken = body.data.accessToken;
    expect(accessToken).toBeDefined();
    
    const cookieHeader = res.headersArray().find(h => h.name.toLowerCase() === 'set-cookie');
    expect(cookieHeader).toBeDefined();
    expect(cookieHeader.value).toContain('refreshToken=');
    expect(cookieHeader.value).toContain('HttpOnly');
    const match = cookieHeader.value.match(/(refreshToken=[^;]+)/);
    refreshCookie = match ? match[1] : cookieHeader.value;
  });

  test('2. Call GET /profile with access token', async ({ request }) => {
    const res = await request.get('/api/v1/profile', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    expect(res.status()).toBe(200);
  });

  test('3. Call refresh', async ({ request }) => {
    const res = await request.post('/api/v1/auth/refresh', {
      headers: { Cookie: refreshCookie }
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.accessToken).toBeDefined();
  });

  test('4. Reuse old refresh token after rotation', async ({ request }) => {
    const res = await request.post('/api/v1/auth/refresh', {
      headers: { Cookie: refreshCookie }
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    if (body.error.code !== 'TOKEN_REUSE_DETECTED') console.log('Step 4 body:', body);
    expect(body.error.code).toBe('TOKEN_REUSE_DETECTED');
  });

  test('5. Login wrong password 5 times', async ({ request }) => {
    for (let i = 0; i < 5; i++) {
      await request.post('/api/v1/auth/login', {
        data: { bankUserId: '30000002', password: 'WrongPassword' }
      });
    }
    const res = await request.post('/api/v1/auth/login', {
      data: { bankUserId: '30000002', password: 'WrongPassword' }
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('ACCOUNT_LOCKED');
    expect(body.error.details.remainingSeconds).toBeDefined();
  });

  test('6. Logout and refresh with cleared cookie', async ({ request }) => {
    const loginRes = await request.post('/api/v1/auth/login', { data: adminCredentials });
    const { accessToken: tempToken } = (await loginRes.json()).data;
    const cookieHeader = loginRes.headersArray().find(h => h.name.toLowerCase() === 'set-cookie');
    const match = cookieHeader.value.match(/(refreshToken=[^;]+)/);
    const cookies = match ? match[1] : cookieHeader.value;

    const logoutRes = await request.post('/api/v1/auth/logout', {
      headers: { Authorization: `Bearer ${tempToken}`, Cookie: cookies }
    });
    expect(logoutRes.status()).toBe(200);

    const refreshRes = await request.post('/api/v1/auth/refresh', {
      headers: { Cookie: cookies }
    });
    expect(refreshRes.status()).toBe(401);
  });
});
