import { test, expect } from '@playwright/test';

const e2eUser1 = { bankUserId: '39900001', password: 'E2eUser@12345' };
const e2eUser2 = { bankUserId: '39900002', password: 'E2eUser@12345' };
const e2eUser3 = { bankUserId: '39900003', password: 'E2eUser@12345' };

test.describe('Transactions Flow', () => {
  let u1Token, u2Token, u3Token;
  let acc1Number, acc2Number, acc3Number;
  let acc1Balance;

  test.beforeAll(async ({ request }) => {
    // Login User 1
    let res = await request.post('/api/v1/auth/login', { data: e2eUser1 });
    u1Token = (await res.json()).data.accessToken;
    res = await request.get('/api/v1/profile', { headers: { Authorization: `Bearer ${u1Token}` } });
    acc1Number = (await res.json()).data.account.accountNumber;
    acc1Balance = (await res.json()).data.account.balance;

    // Login User 2
    res = await request.post('/api/v1/auth/login', { data: e2eUser2 });
    u2Token = (await res.json()).data.accessToken;
    res = await request.get('/api/v1/profile', { headers: { Authorization: `Bearer ${u2Token}` } });
    acc2Number = (await res.json()).data.account.accountNumber;

    // Login User 3
    res = await request.post('/api/v1/auth/login', { data: e2eUser3 });
    u3Token = (await res.json()).data.accessToken;
    res = await request.get('/api/v1/profile', { headers: { Authorization: `Bearer ${u3Token}` } });
    acc3Number = (await res.json()).data.account.accountNumber;
  });

  test('1. Credit E2E account 1', async ({ request }) => {
    const amount = 1000;
    const res = await request.post('/api/v1/transactions/credit', {
      headers: { Authorization: `Bearer ${u1Token}` },
      data: { accountNumber: acc1Number, amount }
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.transaction.balanceAfter).toBe(acc1Balance + amount);
    acc1Balance += amount;
  });

  test('2. Debit E2E account 1', async ({ request }) => {
    const amount = 500;
    const res = await request.post('/api/v1/transactions/debit', {
      headers: { Authorization: `Bearer ${u1Token}` },
      data: { accountNumber: acc1Number, amount }
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.transaction.balanceAfter).toBe(acc1Balance - amount);
    acc1Balance -= amount;
  });

  test('3. Debit more than current balance', async ({ request }) => {
    const res = await request.post('/api/v1/transactions/debit', {
      headers: { Authorization: `Bearer ${u1Token}` },
      data: { accountNumber: acc1Number, amount: acc1Balance + 100 }
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INSUFFICIENT_FUNDS');
  });

  test('4. E2E User One attempts to debit User Two account', async ({ request }) => {
    const res = await request.post('/api/v1/transactions/debit', {
      headers: { Authorization: `Bearer ${u1Token}` },
      data: { accountNumber: acc2Number, amount: 100 }
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('ACCOUNT_NOT_OWNED');
  });

  test('5. E2E User One attempts to transfer from User Two account', async ({ request }) => {
    const res = await request.post('/api/v1/transactions/transfer', {
      headers: { Authorization: `Bearer ${u1Token}` },
      data: { sourceAccountNumber: acc2Number, destinationAccountNumber: acc1Number, amount: 100 }
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('ACCOUNT_NOT_OWNED');
  });

  test('6. Transfer EGP to EGP', async ({ request }) => {
    const res = await request.post('/api/v1/transactions/transfer', {
      headers: { Authorization: `Bearer ${u1Token}` },
      data: { sourceAccountNumber: acc1Number, destinationAccountNumber: acc2Number, amount: 100 }
    });
    expect(res.status()).toBe(200);
  });

  test('7. Transfer EGP to USD -> 400', async ({ request }) => {
    const res = await request.post('/api/v1/transactions/transfer', {
      headers: { Authorization: `Bearer ${u1Token}` },
      data: { sourceAccountNumber: acc1Number, destinationAccountNumber: acc3Number, amount: 100 }
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('CURRENCY_MISMATCH');
  });

  test('8. GET /transactions/history', async ({ request }) => {
    const res = await request.get('/api/v1/transactions/history', {
      headers: { Authorization: `Bearer ${u1Token}` }
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data).toBeInstanceOf(Array);
    if (body.data.length > 0) {
      expect(typeof body.data[0].amount).toBe('number');
    }
  });

  test('9. GET /transactions/history?type=credit', async ({ request }) => {
    const res = await request.get('/api/v1/transactions/history?type=credit', {
      headers: { Authorization: `Bearer ${u1Token}` }
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    for (const record of body.data) {
      expect(record.type).toBe('credit');
    }
  });
});
