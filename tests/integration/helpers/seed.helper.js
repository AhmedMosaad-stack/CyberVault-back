/**
 * Integration test seed helpers.
 * Factory functions to insert test data directly via repositories.
 * All passwords hashed with argon2. All sensitive fields encrypted per Phase 1 Section 10.
 */

import argon2 from 'argon2';
import supertest from 'supertest';
import app from '../setup/app.js';
import UserRepository from '../../../src/repositories/UserRepository.js';
import AccountRepository from '../../../src/repositories/AccountRepository.js';
import { encrypt, hmacHash } from '../../../src/utils/encryption.js';
import { signAccessToken } from '../../../src/utils/tokenHelpers.js';

const request = supertest(app);

let userCounter = 0;

function getUniqueCounter() {
  userCounter++;
  return userCounter;
}

/**
 * Reset the counter (call in beforeAll if needed).
 */
function resetCounter() {
  userCounter = 0;
}

/**
 * Create an admin user. Returns { user, token }.
 */
async function createAdmin(overrides = {}) {
  const n = getUniqueCounter();
  const bankUserId = `1000${String(n).padStart(4, '0')}`;
  const password = 'Admin@12345';
  const passwordHash = await argon2.hash(password);

  const user = await UserRepository.create({
    bankUserId,
    name: overrides.name || `Admin User ${n}`,
    email: overrides.email || `admin${n}@test.com`,
    passwordHash,
    role: 'admin',
    phoneEncrypted: encrypt(`0100000${String(n).padStart(4, '0')}`),
    phoneHash: hmacHash(`0100000${String(n).padStart(4, '0')}`),
    dateOfBirth: '1990-01-01',
    gender: 'male',
    departmentName: 'IT Administration',
    departmentRegion: 'Cairo',
    departmentRole: 'admin',
    departmentSince: new Date(),
    departmentStatus: 'active',
    mustChangePassword: overrides.mustChangePassword ?? false,
    isActive: overrides.isActive ?? true,
    ...overrides,
  });

  const token = signAccessToken({
    sub: user.id,
    role: user.role,
    bankUserId: user.bankUserId,
    mustChangePassword: user.mustChangePassword,
  });

  return { user, token, password, bankUserId };
}

/**
 * Create an employee user. Returns { user, token }.
 */
async function createEmployee(overrides = {}) {
  const n = getUniqueCounter();
  const bankUserId = `2000${String(n).padStart(4, '0')}`;
  const password = 'Employee@12345';
  const passwordHash = await argon2.hash(password);

  const user = await UserRepository.create({
    bankUserId,
    name: overrides.name || `Employee User ${n}`,
    email: overrides.email || `employee${n}@test.com`,
    passwordHash,
    role: 'employee',
    phoneEncrypted: encrypt(`0200000${String(n).padStart(4, '0')}`),
    phoneHash: hmacHash(`0200000${String(n).padStart(4, '0')}`),
    dateOfBirth: '1995-06-15',
    gender: 'female',
    departmentName: 'Customer Service',
    departmentRegion: 'Alexandria',
    departmentRole: 'employee',
    departmentSince: new Date(),
    departmentStatus: 'active',
    mustChangePassword: overrides.mustChangePassword ?? false,
    isActive: overrides.isActive ?? true,
    ...overrides,
  });

  const token = signAccessToken({
    sub: user.id,
    role: user.role,
    bankUserId: user.bankUserId,
    mustChangePassword: user.mustChangePassword,
  });

  return { user, token, password, bankUserId };
}

/**
 * Create a regular user with account. Returns { user, account, token }.
 * Default: balance 10000, EGP, saving, active.
 */
async function createUser(overrides = {}) {
  return createUserWithBalance(
    overrides.balance ?? 10000,
    overrides.currency || 'EGP',
    overrides.accountType || 'saving',
    overrides
  );
}

/**
 * Create a user with a specific balance, currency, and account type.
 * Returns { user, account, token, password, bankUserId, accountNumber }.
 */
async function createUserWithBalance(amount = 10000, currency = 'EGP', accountType = 'saving', overrides = {}) {
  const n = getUniqueCounter();
  const bankUserId = `3000${String(n).padStart(4, '0')}`;
  const password = overrides.password || 'User@12345';
  const passwordHash = await argon2.hash(password);

  const user = await UserRepository.create({
    bankUserId,
    name: overrides.name || `Test User ${n}`,
    email: overrides.email || `user${n}@test.com`,
    passwordHash,
    role: 'user',
    nationalIdEncrypted: encrypt(`2900101${String(n).padStart(7, '0')}`),
    nationalIdHash: hmacHash(`2900101${String(n).padStart(7, '0')}`),
    phoneEncrypted: encrypt(`0300000${String(n).padStart(4, '0')}`),
    phoneHash: hmacHash(`0300000${String(n).padStart(4, '0')}`),
    dateOfBirth: '2000-01-01',
    gender: 'male',
    mustChangePassword: overrides.mustChangePassword ?? false,
    isActive: overrides.isActive ?? true,
    createdBy: overrides.createdBy || null,
  });

  const accountNumber = `1000000000${String(n).padStart(4, '0')}`;
  const account = await AccountRepository.create({
    userId: user.id,
    accountNumberEncrypted: encrypt(accountNumber),
    accountNumberHash: hmacHash(accountNumber),
    accountType,
    currency,
    balance: amount,
    accountStatus: overrides.accountStatus || 'active',
  });

  const token = signAccessToken({
    sub: user.id,
    role: user.role,
    bankUserId: user.bankUserId,
    mustChangePassword: user.mustChangePassword,
  });

  return { user, account, token, password, bankUserId, accountNumber };
}

/**
 * Login as a user via HTTP. Returns { accessToken, cookie, body }.
 */
async function loginAs(bankUserId, password) {
  const res = await request
    .post('/api/v1/auth/login')
    .send({ bankUserId, password });

  const cookie = res.headers['set-cookie'];
  return {
    accessToken: res.body?.data?.accessToken,
    cookie,
    body: res.body,
    status: res.status,
  };
}

export {
  createAdmin,
  createEmployee,
  createUser,
  createUserWithBalance,
  loginAs,
  resetCounter,
  request,
};
