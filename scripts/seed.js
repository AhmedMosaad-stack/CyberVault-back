/**
 * Seed script — creates initial users, accounts, and transactions for development/staging.
 * Refuses to run if NODE_ENV=production.
 *
 * Usage:
 *   npm run seed              (development)
 *   npm run seed:staging       (staging)
 */

import config from '../src/config/index.js';

if (config.NODE_ENV === 'production') {
  // eslint-disable-next-line no-console
  console.error('ERROR: Seed script must not run in production.');
  process.exit(1);
}

import argon2 from 'argon2';
import { sequelize, connectDB } from '../src/config/db.js';
import logger from '../src/utils/logger.js';

// Import models to register associations
import '../src/models/index.js';

import User from '../src/models/User.model.js';
import Account from '../src/models/Account.model.js';
import Transaction from '../src/models/Transaction.model.js';
import RefreshToken from '../src/models/RefreshToken.model.js';
import Notification from '../src/models/Notification.model.js';
import AuditEvent from '../src/models/AuditEvent.model.js';
import ContactMessage from '../src/models/ContactMessage.model.js';

import { encrypt, hmacHash } from '../src/utils/encryption.js';

// ── Helpers ─────────────────────────────────────────────────────────
let accountCounter = 1;

function makeAccountNumber() {
  const num = `1000000000${String(accountCounter++).padStart(4, '0')}`;
  return num;
}

async function createUserRow(data) {
  const passwordHash = await argon2.hash(data.password);
  const phoneEncrypted = encrypt(data.phone);
  const phoneHash = hmacHash(data.phone);

  let nationalIdEncrypted = null;
  let nationalIdHash = null;
  if (data.nationalId) {
    nationalIdEncrypted = encrypt(data.nationalId);
    nationalIdHash = hmacHash(data.nationalId);
  }

  return User.create({
    bankUserId: data.bankUserId,
    name: data.name,
    email: data.email,
    passwordHash,
    role: data.role,
    nationalIdEncrypted,
    nationalIdHash,
    phoneEncrypted,
    phoneHash,
    dateOfBirth: data.dateOfBirth || '1990-01-01',
    gender: data.gender || 'male',
    departmentName: data.departmentName || null,
    departmentRegion: data.departmentRegion || null,
    departmentRole: data.departmentRole || null,
    departmentSince: data.departmentSince || null,
    departmentStatus: data.departmentStatus || null,
    mustChangePassword: false,
    isActive: true,
    createdBy: data.createdBy || null,
  });
}

async function createAccountRow(userId, currency, accountType, balance) {
  const accountNumber = makeAccountNumber();
  return {
    account: await Account.create({
      userId,
      accountNumberEncrypted: encrypt(accountNumber),
      accountNumberHash: hmacHash(accountNumber),
      accountType,
      currency,
      balance,
      accountStatus: 'active',
    }),
    accountNumber,
  };
}

// ── Main Seed ───────────────────────────────────────────────────────
async function seed() {
  try {
    await connectDB();

    // eslint-disable-next-line no-console
    console.log('Clearing existing data...');

    // Delete in FK-constraint order
    await ContactMessage.destroy({ where: {}, force: true });
    await AuditEvent.destroy({ where: {}, force: true });
    await Notification.destroy({ where: {}, force: true });
    await RefreshToken.destroy({ where: {}, force: true });
    await Transaction.destroy({ where: {}, force: true });
    await Account.destroy({ where: {}, force: true });
    await User.destroy({ where: {}, force: true });

    // eslint-disable-next-line no-console
    console.log('Seeding users and accounts...');

    // ── 1. Admin (with account) ──────────────────────────────────
    const admin = await createUserRow({
      bankUserId: '10000001', password: 'Admin@12345', name: 'Ahmed Hassan',
      email: 'admin@bank.com', role: 'admin', phone: '01000000001',
      dateOfBirth: '1990-01-01', gender: 'male',
      departmentName: 'IT Administration', departmentRegion: 'Cairo',
      departmentRole: 'admin', departmentSince: new Date(), departmentStatus: 'active',
    });
    const { account: adminAccount, accountNumber: adminAccNum } = await createAccountRow(admin.id, 'EGP', 'saving', 10000);

    // ── 2. Employee 1 (no account) ───────────────────────────────
    const emp1 = await createUserRow({
      bankUserId: '20000001', password: 'Employee@12345', name: 'Sara Ali',
      email: 'sara@bank.com', role: 'employee', phone: '01000000002',
      dateOfBirth: '1995-06-15', gender: 'female',
      departmentName: 'Customer Service', departmentRegion: 'Alexandria',
      departmentRole: 'employee', departmentSince: new Date(), departmentStatus: 'active',
    });

    // ── 3. Employee 2 (no account) ───────────────────────────────
    const emp2 = await createUserRow({
      bankUserId: '20000002', password: 'Employee@12345', name: 'Omar Khaled',
      email: 'omar@bank.com', role: 'employee', phone: '01000000003',
      dateOfBirth: '1993-11-20', gender: 'male',
      departmentName: 'Operations', departmentRegion: 'Giza',
      departmentRole: 'employee', departmentSince: new Date(), departmentStatus: 'active',
    });

    // ── 4. User 1 — Mohamed Ibrahim (EGP) ────────────────────────
    const user1 = await createUserRow({
      bankUserId: '30000001', password: 'User@12345', name: 'Mohamed Ibrahim',
      email: 'mohamed@example.com', role: 'user', phone: '01000000004',
      nationalId: '29001011234567', dateOfBirth: '2000-01-01', gender: 'male',
      createdBy: admin.id,
    });
    const { account: user1Account, accountNumber: user1AccNum } = await createAccountRow(user1.id, 'EGP', 'saving', 10000);

    // ── 5. User 2 — Nour Mahmoud (EGP) ───────────────────────────
    const user2 = await createUserRow({
      bankUserId: '30000002', password: 'User@12345', name: 'Nour Mahmoud',
      email: 'nour@example.com', role: 'user', phone: '01000000005',
      nationalId: '29501152345678', dateOfBirth: '1995-01-15', gender: 'female',
      createdBy: admin.id,
    });
    const { account: user2Account, accountNumber: user2AccNum } = await createAccountRow(user2.id, 'EGP', 'saving', 10000);

    // ── 6. User 3 — Yasmine Samir (USD) ──────────────────────────
    const user3 = await createUserRow({
      bankUserId: '30000003', password: 'User@12345', name: 'Yasmine Samir',
      email: 'yasmine@example.com', role: 'user', phone: '01000000006',
      nationalId: '29803223456789', dateOfBirth: '1998-03-22', gender: 'female',
      createdBy: admin.id,
    });
    const { account: user3Account, accountNumber: user3AccNum } = await createAccountRow(user3.id, 'USD', 'saving', 10000);

    // ── 7. User 4 — Karim Adel (EUR) ─────────────────────────────
    const user4 = await createUserRow({
      bankUserId: '30000004', password: 'User@12345', name: 'Karim Adel',
      email: 'karim@example.com', role: 'user', phone: '01000000007',
      nationalId: '29205104567890', dateOfBirth: '1992-05-10', gender: 'male',
      createdBy: admin.id,
    });
    const { account: user4Account, accountNumber: user4AccNum } = await createAccountRow(user4.id, 'EUR', 'saving', 10000);

    // ── 8. User 5 — Layla Fathy (EUR) ────────────────────────────
    const user5 = await createUserRow({
      bankUserId: '30000005', password: 'User@12345', name: 'Layla Fathy',
      email: 'layla@example.com', role: 'user', phone: '01000000008',
      nationalId: '29707155678901', dateOfBirth: '1997-07-15', gender: 'female',
      createdBy: admin.id,
    });
    const { account: user5Account, accountNumber: user5AccNum } = await createAccountRow(user5.id, 'EUR', 'saving', 10000);

    // ── E2E Accounts ─────────────────────────────────────────────
    const e2e1 = await createUserRow({
      bankUserId: '39900001', password: 'E2eUser@12345', name: 'E2E User One',
      email: 'e2e1@test.com', role: 'user', phone: '01900000001',
      dateOfBirth: '1990-01-01', gender: 'male', createdBy: admin.id,
    });
    const { account: e2e1Account } = await createAccountRow(e2e1.id, 'EGP', 'saving', 50000);

    const e2e2 = await createUserRow({
      bankUserId: '39900002', password: 'E2eUser@12345', name: 'E2E User Two',
      email: 'e2e2@test.com', role: 'user', phone: '01900000002',
      dateOfBirth: '1990-01-01', gender: 'male', createdBy: admin.id,
    });
    const { account: e2e2Account } = await createAccountRow(e2e2.id, 'EGP', 'saving', 50000);

    const e2e3 = await createUserRow({
      bankUserId: '39900003', password: 'E2eUser@12345', name: 'E2E User Three',
      email: 'e2e3@test.com', role: 'user', phone: '01900000003',
      dateOfBirth: '1990-01-01', gender: 'female', createdBy: admin.id,
    });
    const { account: e2e3Account } = await createAccountRow(e2e3.id, 'USD', 'saving', 50000);

    // eslint-disable-next-line no-console
    console.log('Seeding transactions...');

    // ── Seeded Transactions (20 total) ───────────────────────────
    // Track balance adjustments per account
    const balances = {
      [adminAccount.id]: 10000,
      [user1Account.id]: 10000,
      [user2Account.id]: 10000,
      [user3Account.id]: 10000,
      [user4Account.id]: 10000,
      [user5Account.id]: 10000,
    };

    const transactions = [];

    // 7 credits
    const credits = [
      { toAccountId: user1Account.id, amount: 1500, currency: 'EGP', initiatedBy: user1.id },
      { toAccountId: user1Account.id, amount: 800, currency: 'EGP', initiatedBy: user1.id },
      { toAccountId: user2Account.id, amount: 2000, currency: 'EGP', initiatedBy: user2.id },
      { toAccountId: user2Account.id, amount: 500, currency: 'EGP', initiatedBy: user2.id },
      { toAccountId: user3Account.id, amount: 1200, currency: 'USD', initiatedBy: user3.id },
      { toAccountId: user4Account.id, amount: 700, currency: 'EUR', initiatedBy: user4.id },
      { toAccountId: user5Account.id, amount: 1000, currency: 'EUR', initiatedBy: user5.id },
    ];

    for (const c of credits) {
      balances[c.toAccountId] += c.amount;
      transactions.push(await Transaction.create({
        type: 'credit',
        amount: c.amount,
        currency: c.currency,
        fromAccountId: null,
        toAccountId: c.toAccountId,
        initiatedBy: c.initiatedBy,
        balanceAfter: balances[c.toAccountId],
        description: 'Seed credit',
        status: 'completed',
      }));
    }

    // 7 debits
    const debits = [
      { fromAccountId: user1Account.id, amount: 500, currency: 'EGP', initiatedBy: user1.id },
      { fromAccountId: user1Account.id, amount: 300, currency: 'EGP', initiatedBy: user1.id },
      { fromAccountId: user2Account.id, amount: 800, currency: 'EGP', initiatedBy: user2.id },
      { fromAccountId: user2Account.id, amount: 200, currency: 'EGP', initiatedBy: user2.id },
      { fromAccountId: user3Account.id, amount: 600, currency: 'USD', initiatedBy: user3.id },
      { fromAccountId: user4Account.id, amount: 400, currency: 'EUR', initiatedBy: user4.id },
      { fromAccountId: user5Account.id, amount: 1000, currency: 'EUR', initiatedBy: user5.id },
    ];

    for (const d of debits) {
      balances[d.fromAccountId] -= d.amount;
      transactions.push(await Transaction.create({
        type: 'debit',
        amount: d.amount,
        currency: d.currency,
        fromAccountId: d.fromAccountId,
        toAccountId: null,
        initiatedBy: d.initiatedBy,
        balanceAfter: balances[d.fromAccountId],
        description: 'Seed debit',
        status: 'completed',
      }));
    }

    // 6 transfers (same-currency pairs only)
    const transfers = [
      { from: user1Account.id, to: user2Account.id, amount: 400, currency: 'EGP', initiatedBy: user1.id },
      { from: user2Account.id, to: user1Account.id, amount: 300, currency: 'EGP', initiatedBy: user2.id },
      { from: user1Account.id, to: adminAccount.id, amount: 200, currency: 'EGP', initiatedBy: user1.id },
      { from: user3Account.id, to: user3Account.id, amount: 0, currency: 'USD', initiatedBy: user3.id, skip: true }, // will replace below
      { from: user4Account.id, to: user5Account.id, amount: 100, currency: 'EUR', initiatedBy: user4.id },
      { from: user5Account.id, to: user4Account.id, amount: 150, currency: 'EUR', initiatedBy: user5.id },
    ];

    // Replace entry 4 with a valid USD transfer (user3 account is the only USD main account)
    transfers[3] = { from: adminAccount.id, to: user1Account.id, amount: 800, currency: 'EGP', initiatedBy: admin.id };

    for (const t of transfers) {
      balances[t.from] -= t.amount;
      balances[t.to] += t.amount;
      transactions.push(await Transaction.create({
        type: 'transfer',
        amount: t.amount,
        currency: t.currency,
        fromAccountId: t.from,
        toAccountId: t.to,
        initiatedBy: t.initiatedBy,
        balanceAfter: balances[t.from],
        description: 'Seed transfer',
        status: 'completed',
      }));
    }

    // ── Update final balances in accounts ─────────────────────────
    for (const [accountId, finalBalance] of Object.entries(balances)) {
      await Account.update({ balance: finalBalance }, { where: { id: parseInt(accountId) } });
    }

    // eslint-disable-next-line no-console
    console.log('Seed completed successfully!');
    // eslint-disable-next-line no-console
    console.log('Users: 8 main + 3 E2E = 11 total');
    // eslint-disable-next-line no-console
    console.log('Transactions: 20 (7 credits, 7 debits, 6 transfers)');
    // eslint-disable-next-line no-console
    console.log('Final balances updated.');

    await sequelize.close();
    process.exit(0);
  } catch (err) {
    logger.fatal({ err }, 'Seed script failed');
    process.exit(1);
  }
}

seed();
