/**
 * Integration tests for transaction endpoints.
 * GET /api/v1/accounts/lookup, POST /transactions/credit|debit|transfer, GET /transactions/history
 */

import supertest from 'supertest';
import { resetDatabase, teardownDatabase } from './setup/db.js';
import app from './setup/app.js';
import { createAdmin, createUser, createUserWithBalance, resetCounter } from './helpers/seed.helper.js';
import AccountRepository from '../../src/repositories/AccountRepository.js';
import NotificationRepository from '../../src/repositories/NotificationRepository.js';
import AuditEventRepository from '../../src/repositories/AuditEventRepository.js';

const request = supertest(app);

beforeAll(async () => {
  await resetDatabase();
  resetCounter();
});

afterAll(async () => {
  await teardownDatabase();
});

describe('Transactions Integration', () => {
  let admin, adminToken;
  let user1, user1Token, user1AccountNumber;
  let user2, user2Token, user2AccountNumber;
  let usdUser, usdUserToken, usdAccountNumber;

  beforeAll(async () => {
    const a = await createAdmin();
    admin = a.user; adminToken = a.token;

    const u1 = await createUser({ balance: 10000, currency: 'EGP' });
    user1 = u1.user; user1Token = u1.token; user1AccountNumber = u1.accountNumber;

    const u2 = await createUser({ balance: 10000, currency: 'EGP' });
    user2 = u2.user; user2Token = u2.token; user2AccountNumber = u2.accountNumber;

    const u3 = await createUserWithBalance(10000, 'USD', 'saving');
    usdUser = u3.user; usdUserToken = u3.token; usdAccountNumber = u3.accountNumber;
  });

  describe('GET /api/v1/accounts/lookup', () => {
    test('valid accountNumber → 200 with owner info', async () => {
      const res = await request
        .get(`/api/v1/accounts/lookup?accountNumber=${user1AccountNumber}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.accountNumber).toBe(user1AccountNumber);
      expect(res.body.data.owner.name).toBeDefined();
    });

    test('invalid accountNumber → 404 ACCOUNT_NOT_FOUND', async () => {
      const res = await request
        .get('/api/v1/accounts/lookup?accountNumber=00000000000000')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('ACCOUNT_NOT_FOUND');
    });
  });

  describe('POST /api/v1/transactions/credit', () => {
    test('valid credit → 200, balance increased', async () => {
      const accountBefore = await AccountRepository.findByUserId(user1.id);
      const balanceBefore = parseFloat(accountBefore.balance);

      const res = await request
        .post('/api/v1/transactions/credit')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ accountNumber: user1AccountNumber, amount: 500 });

      expect(res.status).toBe(200);
      expect(res.body.data.transaction.balanceAfter).toBe(balanceBefore + 500);

      // Verify in DB
      const accountAfter = await AccountRepository.findByUserId(user1.id);
      expect(parseFloat(accountAfter.balance)).toBe(balanceBefore + 500);
    });

    test('frozen account → 403 ACCOUNT_FROZEN', async () => {
      const frozenUser = await createUser({ accountStatus: 'frozen' });

      const res = await request
        .post('/api/v1/transactions/credit')
        .set('Authorization', `Bearer ${frozenUser.token}`)
        .send({ accountNumber: frozenUser.accountNumber, amount: 500 });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ACCOUNT_FROZEN');
    });
  });

  describe('POST /api/v1/transactions/debit', () => {
    test('valid debit (sufficient funds) → 200, balance decreased', async () => {
      const accountBefore = await AccountRepository.findByUserId(user1.id);
      const balanceBefore = parseFloat(accountBefore.balance);

      const res = await request
        .post('/api/v1/transactions/debit')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ accountNumber: user1AccountNumber, amount: 200 });

      expect(res.status).toBe(200);
      expect(res.body.data.transaction.balanceAfter).toBe(balanceBefore - 200);
    });

    test('debit another user\'s account → 403 ACCOUNT_NOT_OWNED', async () => {
      const balanceBefore = parseFloat((await AccountRepository.findByUserId(user2.id)).balance);

      const res = await request
        .post('/api/v1/transactions/debit')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ accountNumber: user2AccountNumber, amount: 100 });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ACCOUNT_NOT_OWNED');

      // Balance unchanged
      const balanceAfter = parseFloat((await AccountRepository.findByUserId(user2.id)).balance);
      expect(balanceAfter).toBe(balanceBefore);
    });

    test('admin debit another user\'s account → 403 ACCOUNT_NOT_OWNED', async () => {
      const res = await request
        .post('/api/v1/transactions/debit')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ accountNumber: user1AccountNumber, amount: 100 });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ACCOUNT_NOT_OWNED');
    });

    test('debit exact balance (result = 0.00) → 200', async () => {
      const exactUser = await createUser({ balance: 500, currency: 'EGP' });

      const res = await request
        .post('/api/v1/transactions/debit')
        .set('Authorization', `Bearer ${exactUser.token}`)
        .send({ accountNumber: exactUser.accountNumber, amount: 500 });

      expect(res.status).toBe(200);
      expect(res.body.data.transaction.balanceAfter).toBe(0);
    });
  });

  describe('POST /api/v1/transactions/transfer', () => {
    test('transfer another user\'s source → 403 ACCOUNT_NOT_OWNED', async () => {
      const res = await request
        .post('/api/v1/transactions/transfer')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          sourceAccountNumber: user2AccountNumber,
          destinationAccountNumber: user1AccountNumber,
          amount: 100,
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ACCOUNT_NOT_OWNED');
    });

    test('user owns source, not destination → 200 (destination no ownership check)', async () => {
      const res = await request
        .post('/api/v1/transactions/transfer')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          sourceAccountNumber: user1AccountNumber,
          destinationAccountNumber: user2AccountNumber,
          amount: 100,
        });

      expect(res.status).toBe(200);
    });

    test('valid same-currency transfer → 200, balances correct', async () => {
      const fromBefore = parseFloat((await AccountRepository.findByUserId(user1.id)).balance);
      const toBefore = parseFloat((await AccountRepository.findByUserId(user2.id)).balance);

      const res = await request
        .post('/api/v1/transactions/transfer')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          sourceAccountNumber: user1AccountNumber,
          destinationAccountNumber: user2AccountNumber,
          amount: 200,
        });

      expect(res.status).toBe(200);

      const fromAfter = parseFloat((await AccountRepository.findByUserId(user1.id)).balance);
      const toAfter = parseFloat((await AccountRepository.findByUserId(user2.id)).balance);
      expect(fromAfter).toBe(fromBefore - 200);
      expect(toAfter).toBe(toBefore + 200);
    });

    test('currency mismatch → 400 CURRENCY_MISMATCH', async () => {
      const res = await request
        .post('/api/v1/transactions/transfer')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          sourceAccountNumber: user1AccountNumber,
          destinationAccountNumber: usdAccountNumber,
          amount: 100,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CURRENCY_MISMATCH');
    });

    test('same account → 400 SAME_ACCOUNT', async () => {
      const res = await request
        .post('/api/v1/transactions/transfer')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          sourceAccountNumber: user1AccountNumber,
          destinationAccountNumber: user1AccountNumber,
          amount: 100,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SAME_ACCOUNT');
    });

    test('insufficient funds → 400 INSUFFICIENT_FUNDS', async () => {
      const poorUser = await createUser({ balance: 10, currency: 'EGP' });

      const res = await request
        .post('/api/v1/transactions/transfer')
        .set('Authorization', `Bearer ${poorUser.token}`)
        .send({
          sourceAccountNumber: poorUser.accountNumber,
          destinationAccountNumber: user2AccountNumber,
          amount: 5000,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INSUFFICIENT_FUNDS');
    });

    test('frozen source account → 403 ACCOUNT_FROZEN', async () => {
      const frozenUser = await createUser({ accountStatus: 'frozen' });

      const res = await request
        .post('/api/v1/transactions/transfer')
        .set('Authorization', `Bearer ${frozenUser.token}`)
        .send({
          sourceAccountNumber: frozenUser.accountNumber,
          destinationAccountNumber: user2AccountNumber,
          amount: 100,
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ACCOUNT_FROZEN');
    });
  });

  describe('GET /api/v1/transactions/history', () => {
    test('amount field is typeof number', async () => {
      const res = await request
        .get('/api/v1/transactions/history')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      if (res.body.data.length > 0) {
        expect(typeof res.body.data[0].amount).toBe('number');
      }
    });

    test('transfer record has decrypted destinationAccount', async () => {
      const res = await request
        .get('/api/v1/transactions/history')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      const transferRecord = res.body.data.find(tx => tx.type === 'transfer');
      if (transferRecord) {
        expect(transferRecord.destinationAccount).toMatch(/^\d{14}$/);
      }
    });

    test('credit/debit record has null destinationAccount', async () => {
      const res = await request
        .get('/api/v1/transactions/history')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      const creditRecord = res.body.data.find(tx => tx.type === 'credit');
      if (creditRecord) {
        expect(creditRecord.destinationAccount).toBeNull();
      }
    });

    test('filter by type=credit → all records have type credit', async () => {
      const res = await request
        .get('/api/v1/transactions/history?type=credit')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      res.body.data.forEach(tx => expect(tx.type).toBe('credit'));
    });

    test('admin views another user\'s history → 200', async () => {
      const res = await request
        .get(`/api/v1/transactions/history/${user1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    test('regular user views another user\'s history → 403 FORBIDDEN', async () => {
      const res = await request
        .get(`/api/v1/transactions/history/${user2.id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Notification and Audit verification', () => {
    test('notification row created after credit', async () => {
      const creditUser = await createUser({ balance: 0, currency: 'EGP' });

      await request
        .post('/api/v1/transactions/credit')
        .set('Authorization', `Bearer ${creditUser.token}`)
        .send({ accountNumber: creditUser.accountNumber, amount: 1000 });

      const notifications = await NotificationRepository.findByUserId(creditUser.user.id);
      const creditNotification = notifications.find(n => n.type === 'credit');
      expect(creditNotification).toBeDefined();
    });

    test('2 notification rows created after transfer', async () => {
      const sender = await createUser({ balance: 5000, currency: 'EGP' });
      const receiver = await createUser({ balance: 0, currency: 'EGP' });

      await request
        .post('/api/v1/transactions/transfer')
        .set('Authorization', `Bearer ${sender.token}`)
        .send({
          sourceAccountNumber: sender.accountNumber,
          destinationAccountNumber: receiver.accountNumber,
          amount: 100,
        });

      const senderNotifs = await NotificationRepository.findByUserId(sender.user.id);
      const receiverNotifs = await NotificationRepository.findByUserId(receiver.user.id);
      const senderTransferNotif = senderNotifs.find(n => n.type === 'transfer');
      const receiverTransferNotif = receiverNotifs.find(n => n.type === 'transfer');
      expect(senderTransferNotif).toBeDefined();
      expect(receiverTransferNotif).toBeDefined();
    });
  });

  describe('mustChangePassword enforcement', () => {
    test('transaction endpoint with mustChangePassword:true token → 403', async () => {
      const mcpUser = await createUser({ mustChangePassword: true });

      const res = await request
        .post('/api/v1/transactions/credit')
        .set('Authorization', `Bearer ${mcpUser.token}`)
        .send({ accountNumber: mcpUser.accountNumber, amount: 100 });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('MUST_CHANGE_PASSWORD');
    });
  });
});
