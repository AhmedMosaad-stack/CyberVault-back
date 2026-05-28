/**
 * Seed script — creates initial admin, employee, and user accounts for development.
 * Refuses to run if NODE_ENV=production.
 *
 * Usage: npm run seed
 */

import config from '../src/config/index.js';

if (config.NODE_ENV === 'production') {
  // eslint-disable-next-line no-console
  console.error('Seed script cannot run in production mode.');
  process.exit(1);
}

import argon2 from 'argon2';
import { connectDB } from '../src/config/db.js';
import logger from '../src/utils/logger.js';

// Import models to register associations
import '../src/models/index.js';

import UserRepository from '../src/repositories/UserRepository.js';
import AccountRepository from '../src/repositories/AccountRepository.js';
import { encrypt, hmacHash } from '../src/utils/encryption.js';

async function seed() {
  try {
    await connectDB();


    // ─── Admin ─────────────────────────────────────────────────────
    const adminBankUserId = '10000001';
    const adminPassword = 'Admin@12345';
    const adminPasswordHash = await argon2.hash(adminPassword);

    let admin = await UserRepository.findByBankUserId(adminBankUserId);
    if (!admin) {
      admin = await UserRepository.create({
        bankUserId: adminBankUserId,
        name: 'Ahmed Hassan',
        email: 'admin@bank.com',
        passwordHash: adminPasswordHash,
        role: 'admin',
        phoneEncrypted: encrypt('01000000001'),
        phoneHash: hmacHash('01000000001'),
        dateOfBirth: '1990-01-01',
        gender: 'male',
        departmentName: 'IT Administration',
        departmentRegion: 'Cairo',
        departmentRole: 'admin',
        departmentSince: new Date(),
        departmentStatus: 'active',
        mustChangePassword: false,
        isActive: true,
      });

    }

    // ─── Employee ──────────────────────────────────────────────────
    const employeeBankUserId = '20000001';
    const employeePassword = 'Employee@12345';
    const employeePasswordHash = await argon2.hash(employeePassword);

    let employee = await UserRepository.findByBankUserId(employeeBankUserId);
    if (!employee) {
      employee = await UserRepository.create({
        bankUserId: employeeBankUserId,
        name: 'Sara Ali',
        email: 'sara@bank.com',
        passwordHash: employeePasswordHash,
        role: 'employee',
        phoneEncrypted: encrypt('01000000002'),
        phoneHash: hmacHash('01000000002'),
        dateOfBirth: '1995-06-15',
        gender: 'female',
        departmentName: 'Customer Service',
        departmentRegion: 'Alexandria',
        departmentRole: 'employee',
        departmentSince: new Date(),
        departmentStatus: 'active',
        mustChangePassword: false,
        isActive: true,
        createdBy: admin.id,
      });

    }

    // ─── Regular User ──────────────────────────────────────────────
    const userBankUserId = '30000001';
    const userPassword = 'User@12345';
    const userPasswordHash = await argon2.hash(userPassword);

    let regularUser = await UserRepository.findByBankUserId(userBankUserId);
    if (!regularUser) {
      regularUser = await UserRepository.create({
        bankUserId: userBankUserId,
        name: 'Mohamed Ibrahim',
        email: 'mohamed@example.com',
        passwordHash: userPasswordHash,
        role: 'user',
        nationalIdEncrypted: encrypt('29001011234567'),
        nationalIdHash: hmacHash('29001011234567'),
        phoneEncrypted: encrypt('01000000003'),
        phoneHash: hmacHash('01000000003'),
        dateOfBirth: '2000-01-01',
        gender: 'male',
        mustChangePassword: false,
        isActive: true,
        createdBy: admin.id,
      });

      // Create account for regular user
      const accountNumber = '10000000000001';
      await AccountRepository.create({
        userId: regularUser.id,
        accountNumberEncrypted: encrypt(accountNumber),
        accountNumberHash: hmacHash(accountNumber),
        accountType: 'saving',
        currency: 'EGP',
        balance: 10000.00,
        accountStatus: 'active',
      });


    }

    // ─── Second User (for transfer testing) ────────────────────────
    const user2BankUserId = '30000002';
    const user2Password = 'User@5678';
    const user2PasswordHash = await argon2.hash(user2Password);

    let user2 = await UserRepository.findByBankUserId(user2BankUserId);
    if (!user2) {
      user2 = await UserRepository.create({
        bankUserId: user2BankUserId,
        name: 'Fatma Ali',
        email: 'fatma@example.com',
        passwordHash: user2PasswordHash,
        role: 'user',
        phoneEncrypted: encrypt('01000000004'),
        phoneHash: hmacHash('01000000004'),
        dateOfBirth: '1998-03-20',
        gender: 'female',
        mustChangePassword: false,
        isActive: true,
        createdBy: admin.id,
      });

      const accountNumber2 = '10000000000002';
      await AccountRepository.create({
        userId: user2.id,
        accountNumberEncrypted: encrypt(accountNumber2),
        accountNumberHash: hmacHash(accountNumber2),
        accountType: 'current',
        currency: 'EGP',
        balance: 5000.00,
        accountStatus: 'active',
      });


    }



    process.exit(0);
  } catch (err) {
    logger.fatal({ err }, 'Seed script failed');
    process.exit(1);
  }
}

seed();
