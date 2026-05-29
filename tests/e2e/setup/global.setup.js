import { test, expect } from '@playwright/test';

test.beforeAll(async ({ request, baseURL }) => {
  const res = await request.get('/');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.status).toBe('ok');
});

module.exports = {};
