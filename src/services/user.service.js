import argon2 from 'argon2';
import UserRepository from '../repositories/UserRepository.js';
import AccountRepository from '../repositories/AccountRepository.js';
import NotificationRepository from '../repositories/NotificationRepository.js';
import AuditEventRepository from '../repositories/AuditEventRepository.js';
import RefreshTokenRepository from '../repositories/RefreshTokenRepository.js';
import Transaction from '../models/Transaction.model.js';
import { encrypt, decrypt, hmacHash } from '../utils/encryption.js';
import { generateBankUserId } from '../utils/bankUserId.js';
import { generateAccountNumber } from '../utils/accountNumber.js';
import { sendRegistrationEmail } from '../utils/email.js';


/**
 * Build the shared user DTO (identity + decrypted phone + account + department).
 * Callers append the field that differs by context: `mustChangePassword` for the
 * owner's own profile, `isActive` for admin/employee lookups.
 */
function buildUserDTO(user, account) {
  let accountData = null;
  if (account) {
    accountData = {
      accountNumber: decrypt(account.accountNumberEncrypted),
      accountType: account.accountType,
      currency: account.currency,
      balance: account.balance,
      accountStatus: account.accountStatus,
    };
  }

  let department = null;
  if (user.role === 'admin' || user.role === 'employee') {
    department = {
      departmentName: user.departmentName,
      departmentRegion: user.departmentRegion,
      departmentRole: user.departmentRole,
      departmentSince: user.departmentSince,
      departmentStatus: user.departmentStatus,
    };
  }

  return {
    id: user.id,
    bankUserId: user.bankUserId,
    name: user.name,
    email: user.email,
    phone: user.phoneEncrypted ? decrypt(user.phoneEncrypted) : null,
    dateOfBirth: user.dateOfBirth,
    gender: user.gender,
    role: user.role,
    department,
    account: accountData,
    createdAt: user.createdAt,
  };
}

class UserService {
  async getProfile(userId) {
    const user = await UserRepository.findById(userId);
    if (!user) {
      return { error: { code: 'USER_NOT_FOUND', status: 404, message: 'User not found' } };
    }

    const account = await AccountRepository.findByUserId(userId);

    return {
      data: { ...buildUserDTO(user, account), mustChangePassword: user.mustChangePassword },
    };
  }

  async updateProfile(userId, data) {
    const user = await UserRepository.findById(userId);
    if (!user) {
      return { error: { code: 'USER_NOT_FOUND', status: 404, message: 'User not found' } };
    }

    const updateData = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.dateOfBirth !== undefined) updateData.dateOfBirth = data.dateOfBirth;
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.departmentName !== undefined) updateData.departmentName = data.departmentName;
    if (data.departmentRegion !== undefined) updateData.departmentRegion = data.departmentRegion;

    if (data.phone !== undefined) {
      updateData.phoneEncrypted = encrypt(data.phone);
      updateData.phoneHash = hmacHash(data.phone);
    }

    await UserRepository.update({ id: userId }, updateData);

    return {
      data: { ...updateData, phoneEncrypted: undefined, phoneHash: undefined, phone: data.phone },
    };
  }

  async changePassword(userId, currentPassword, newPassword, userRole, ipAddress) {
    const user = await UserRepository.findById(userId);
    if (!user) {
      return { error: { code: 'USER_NOT_FOUND', status: 404, message: 'User not found' } };
    }

    const valid = await argon2.verify(user.passwordHash, currentPassword);
    if (!valid) {
      return { error: { code: 'INVALID_CURRENT_PASSWORD', status: 401, message: 'Current password is incorrect' } };
    }

    const passwordHash = await argon2.hash(newPassword);
    await UserRepository.update({ id: userId }, { passwordHash });
    await UserRepository.setMustChangePassword(userId, false);

    await NotificationRepository.create({
      userId,
      type: 'password_changed',
      message: 'Your password has been changed successfully',
      relatedId: userId,
    });

    await AuditEventRepository.create({
      actorId: userId,
      actorRole: userRole,
      action: 'CHANGE_PASSWORD',
      targetId: userId,
      targetType: 'User',
      ipAddress,
    });



    return { data: { message: 'Password updated successfully' } };
  }

  async getUserById(id) {
    const user = await UserRepository.findById(id);
    if (!user) {
      return { error: { code: 'USER_NOT_FOUND', status: 404, message: 'User not found' } };
    }

    const account = await AccountRepository.findByUserId(id);

    return {
      data: { ...buildUserDTO(user, account), isActive: user.isActive },
    };
  }

  async listUsers(filters, pagination) {
    const result = await UserRepository.searchUsers(filters, pagination);
    const page = pagination.page || 1;
    const limit = Math.min(pagination.limit || 10, 100);
    const total = result.count;
    const pages = Math.ceil(total / limit);

    return { data: result.rows, pagination: { page, limit, total, pages } };
  }

  async createUser(data, createdById, creatorRole, ipAddress) {
    const bankUserId = await generateBankUserId();
    const temporaryPassword = `Bank@${bankUserId}`;
    const passwordHash = await argon2.hash(temporaryPassword);

    const phoneEncrypted = encrypt(data.phone);
    const phoneHash = hmacHash(data.phone);

    let nationalIdEncrypted = null;
    let nationalIdHash = null;
    if (data.nationalId) {
      nationalIdEncrypted = encrypt(data.nationalId);
      nationalIdHash = hmacHash(data.nationalId);

      const existingNid = await UserRepository.findByNationalIdHash(nationalIdHash);
      if (existingNid) {
        return { error: { code: 'NATIONAL_ID_EXISTS', status: 409, message: 'This national ID is already registered' } };
      }
    }

    const existingEmail = await UserRepository.findByEmail(data.email);
    if (existingEmail) {
      return { error: { code: 'EMAIL_EXISTS', status: 409, message: 'This email is already registered' } };
    }

    const user = await UserRepository.create({
      bankUserId,
      name: data.name,
      email: data.email,
      passwordHash,
      role: 'user',
      nationalIdEncrypted,
      nationalIdHash,
      phoneEncrypted,
      phoneHash,
      dateOfBirth: data.dateOfBirth,
      gender: data.gender,
      mustChangePassword: true,
      createdBy: createdById,
    });

    const accountNumber = await generateAccountNumber();
    const accountNumberEncrypted = encrypt(accountNumber);
    const accountNumberHash = hmacHash(accountNumber);

    const account = await AccountRepository.create({
      userId: user.id,
      accountNumberEncrypted,
      accountNumberHash,
      accountType: data.account.accountType,
      currency: data.account.currency,
      balance: data.account.balance || 0,
    });

    await NotificationRepository.create({
      userId: user.id,
      type: 'account_created',
      message: `Welcome! Your bank account has been created. Your Bank ID is ${bankUserId}.`,
      relatedId: user.id,
    });

    await AuditEventRepository.create({
      actorId: createdById,
      actorRole: creatorRole,
      action: 'CREATE_USER',
      targetId: user.id,
      targetType: 'User',
      ipAddress,
    });

    sendRegistrationEmail(user.email, user.name, bankUserId, temporaryPassword, user.role, accountNumber).catch(() => {});

    return {
      data: {
        user: { id: user.id, bankUserId: user.bankUserId, name: user.name, role: user.role, email: user.email },
        account: {
          accountNumber,
          accountType: account.accountType,
          accountStatus: account.accountStatus,
          currency: account.currency,
          balance: account.balance,
        },
        temporaryPassword,
      },
    };
  }

  async createEmployee(data, createdById, creatorRole, ipAddress) {
    const bankUserId = await generateBankUserId();
    const temporaryPassword = `Bank@${bankUserId}`;
    const passwordHash = await argon2.hash(temporaryPassword);

    const phoneEncrypted = encrypt(data.phone);
    const phoneHash = hmacHash(data.phone);

    let nationalIdEncrypted = null;
    let nationalIdHash = null;
    if (data.nationalId) {
      nationalIdEncrypted = encrypt(data.nationalId);
      nationalIdHash = hmacHash(data.nationalId);

      const existingNid = await UserRepository.findByNationalIdHash(nationalIdHash);
      if (existingNid) {
        return { error: { code: 'NATIONAL_ID_EXISTS', status: 409, message: 'This national ID is already registered' } };
      }
    }

    const existingEmail = await UserRepository.findByEmail(data.email);
    if (existingEmail) {
      return { error: { code: 'EMAIL_EXISTS', status: 409, message: 'This email is already registered' } };
    }

    const role = data.department.departmentRole;

    const user = await UserRepository.create({
      bankUserId,
      name: data.name,
      email: data.email,
      passwordHash,
      role,
      nationalIdEncrypted,
      nationalIdHash,
      phoneEncrypted,
      phoneHash,
      dateOfBirth: data.dateOfBirth,
      gender: data.gender,
      departmentName: data.department.departmentName,
      departmentRegion: data.department.departmentRegion,
      departmentRole: data.department.departmentRole,
      departmentSince: new Date(),
      departmentStatus: 'active',
      mustChangePassword: true,
      createdBy: createdById,
    });

    await AuditEventRepository.create({
      actorId: createdById,
      actorRole: creatorRole,
      action: 'CREATE_USER',
      targetId: user.id,
      targetType: 'User',
      ipAddress,
    });

    sendRegistrationEmail(user.email, user.name, bankUserId, temporaryPassword, user.role).catch(() => {});

    return {
      data: {
        user: { id: user.id, bankUserId: user.bankUserId, role: user.role, name: user.name, email: user.email },
        department: {
          departmentName: user.departmentName,
          departmentRegion: user.departmentRegion,
          departmentRole: user.departmentRole,
          departmentSince: user.departmentSince,
          departmentStatus: user.departmentStatus,
        },
        temporaryPassword,
      },
    };
  }

  async updateUser(id, data, actorId, actorRole, ipAddress) {
    const user = await UserRepository.findById(id);
    if (!user) {
      return { error: { code: 'USER_NOT_FOUND', status: 404, message: 'User not found' } };
    }

    const updateData = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.dateOfBirth !== undefined) updateData.dateOfBirth = data.dateOfBirth;
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.departmentName !== undefined) updateData.departmentName = data.departmentName;
    if (data.departmentRegion !== undefined) updateData.departmentRegion = data.departmentRegion;

    if (data.phone !== undefined) {
      updateData.phoneEncrypted = encrypt(data.phone);
      updateData.phoneHash = hmacHash(data.phone);
    }

    await UserRepository.update({ id }, updateData);

    await AuditEventRepository.create({
      actorId,
      actorRole,
      action: 'UPDATE_USER',
      targetId: id,
      targetType: 'User',
      ipAddress,
    });

    return {
      data: { ...updateData, phoneEncrypted: undefined, phoneHash: undefined, phone: data.phone },
    };
  }

  async deleteUser(id, actorId, actorRole, ipAddress) {
    const user = await UserRepository.findById(id);
    if (!user) {
      return { error: { code: 'USER_NOT_FOUND', status: 404, message: 'User not found' } };
    }

    if (user.role === 'admin') {
      const adminCount = await UserRepository.count({ role: 'admin' });
      if (adminCount <= 1) {
        return { error: { code: 'CANNOT_DELETE_ADMIN', status: 409, message: 'Cannot delete the last admin account' } };
      }
    }

    // Delete dependents in order: notifications → audit_events → refresh_tokens → transactions → account → user
    await NotificationRepository.deleteByUserId(id);
    await AuditEventRepository.deleteByActorId(id);
    await RefreshTokenRepository.deleteByUserId(id);

    // Delete transactions where user is the initiator (using imported model directly)
    await Transaction.destroy({ where: { initiatedBy: id } });

    const account = await AccountRepository.findByUserId(id);
    if (account) {
      await AccountRepository.delete({ id: account.id });
    }

    await UserRepository.delete({ id });

    try {
      await AuditEventRepository.create({
        actorId,
        actorRole,
        action: 'DELETE_USER',
        targetId: id,
        targetType: 'User',
        ipAddress,
      });
    } catch (_err) {
      // ignore error
    }



    return { data: { message: 'User deleted successfully' } };
  }

  async unlockUser(id, actorId, actorRole, ipAddress) {
    const user = await UserRepository.findById(id);
    if (!user) {
      return { error: { code: 'USER_NOT_FOUND', status: 404, message: 'User not found' } };
    }

    await UserRepository.resetLoginAttempts(id);

    await AuditEventRepository.create({
      actorId,
      actorRole,
      action: 'UNLOCK_USER',
      targetId: id,
      targetType: 'User',
      ipAddress,
    });



    return { data: { message: 'User unlocked successfully' } };
  }
}

export default new UserService();
