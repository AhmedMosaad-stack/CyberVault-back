/**
 * Unit tests for src/validators/user.validator.js
 * Tests createUserSchema, createEmployeeSchema, changePasswordSchema.
 */

import {
  createUserSchema,
  createEmployeeSchema,
  changePasswordSchema,
} from '../../../src/validators/user.validator.js';

describe('user validators', () => {
  describe('createUserSchema', () => {
    const validUser = {
      name: 'Mohamed Ibrahim',
      email: 'mohamed@example.com',
      phone: '01000000003',
      dateOfBirth: '2000-01-01',
      gender: 'male',
      account: {
        accountType: 'saving',
        currency: 'EGP',
        balance: 0,
      },
    };

    test('valid input passes', () => {
      const result = createUserSchema.safeParse(validUser);
      expect(result.success).toBe(true);
    });

    test('missing email fails', () => {
      const { email, ...noEmail } = validUser;
      const result = createUserSchema.safeParse(noEmail);
      expect(result.success).toBe(false);
    });

    test('invalid email format fails', () => {
      const result = createUserSchema.safeParse({ ...validUser, email: 'not-an-email' });
      expect(result.success).toBe(false);
    });

    test('missing phone fails', () => {
      const { phone, ...noPhone } = validUser;
      const result = createUserSchema.safeParse(noPhone);
      expect(result.success).toBe(false);
    });

    test('missing name fails', () => {
      const { name, ...noName } = validUser;
      const result = createUserSchema.safeParse(noName);
      expect(result.success).toBe(false);
    });

    test('password too short fails in changePasswordSchema', () => {
      // This is tested via changePasswordSchema below
    });
  });

  describe('createEmployeeSchema', () => {
    const validEmployee = {
      name: 'Sara Ali',
      email: 'sara@bank.com',
      phone: '01000000002',
      dateOfBirth: '1995-06-15',
      gender: 'female',
      department: {
        departmentName: 'Customer Service',
        departmentRegion: 'Alexandria',
        departmentRole: 'employee',
      },
    };

    test('valid input passes', () => {
      const result = createEmployeeSchema.safeParse(validEmployee);
      expect(result.success).toBe(true);
    });

    test('missing departmentName fails', () => {
      const result = createEmployeeSchema.safeParse({
        ...validEmployee,
        department: {
          ...validEmployee.department,
          departmentName: '',
        },
      });
      expect(result.success).toBe(false);
    });

    test('missing departmentRegion fails', () => {
      const result = createEmployeeSchema.safeParse({
        ...validEmployee,
        department: {
          ...validEmployee.department,
          departmentRegion: '',
        },
      });
      expect(result.success).toBe(false);
    });

    test('invalid departmentRole fails', () => {
      const result = createEmployeeSchema.safeParse({
        ...validEmployee,
        department: {
          ...validEmployee.department,
          departmentRole: 'manager',
        },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('changePasswordSchema', () => {
    test('valid input passes', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'OldPassword@1',
        newPassword: 'NewStrong@1',
      });
      expect(result.success).toBe(true);
    });

    test('new password without uppercase fails', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'OldPassword@1',
        newPassword: 'nouppercase@1',
      });
      expect(result.success).toBe(false);
    });

    test('new password without number fails', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'OldPassword@1',
        newPassword: 'NoNumber@abc',
      });
      expect(result.success).toBe(false);
    });

    test('new password without special char fails', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'OldPassword@1',
        newPassword: 'NoSpecial1A',
      });
      expect(result.success).toBe(false);
    });

    test('new password too short fails', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'OldPassword@1',
        newPassword: 'Sh@1',
      });
      expect(result.success).toBe(false);
    });

    test('missing currentPassword fails', () => {
      const result = changePasswordSchema.safeParse({
        newPassword: 'NewStrong@1',
      });
      expect(result.success).toBe(false);
    });
  });
});
