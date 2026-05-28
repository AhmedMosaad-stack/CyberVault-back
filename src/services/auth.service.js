import crypto from 'crypto';
import argon2 from 'argon2';
import UserRepository from '../repositories/UserRepository.js';
import RefreshTokenRepository from '../repositories/RefreshTokenRepository.js';
import AuditEventRepository from '../repositories/AuditEventRepository.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  expiresInToDate,
} from '../utils/tokenHelpers.js';
import config from '../config/index.js';


class AuthService {
  async login(bankUserId, password, ipAddress) {
    const user = await UserRepository.findByBankUserId(bankUserId);
    if (!user) {
      return { error: { code: 'INVALID_CREDENTIALS', status: 401, message: 'Invalid credentials' } };
    }

    if (!user.isActive) {
      return { error: { code: 'ACCOUNT_INACTIVE', status: 400, message: 'Account is deactivated' } };
    }

    if (user.lockoutUntil && new Date(user.lockoutUntil) > new Date()) {
      const remainingSeconds = Math.ceil((new Date(user.lockoutUntil) - new Date()) / 1000);
      return {
        error: {
          code: 'ACCOUNT_LOCKED',
          status: 401,
          message: 'Account is locked due to too many failed login attempts',
          details: { remainingSeconds },
        },
      };
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      await UserRepository.incrementFailedAttempts(user.id);
      const newAttempts = user.failedLoginAttempts + 1;

      if (newAttempts >= 5) {
        const lockoutUntil = new Date(Date.now() + 15 * 60 * 1000);
        await UserRepository.lockUser(user.id, lockoutUntil);

      }

      return { error: { code: 'INVALID_CREDENTIALS', status: 401, message: 'Invalid credentials' } };
    }

    await UserRepository.resetLoginAttempts(user.id);

    const accessToken = signAccessToken({
      sub: user.id,
      role: user.role,
      bankUserId: user.bankUserId,
      mustChangePassword: user.mustChangePassword,
    });

    const family = crypto.randomUUID();
    const rawRefreshToken = signRefreshToken({ sub: user.id, family });
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = expiresInToDate(config.JWT_REFRESH_EXPIRES_IN);

    await RefreshTokenRepository.create({ userId: user.id, tokenHash, family, expiresAt });

    await AuditEventRepository.create({
      actorId: user.id,
      actorRole: user.role,
      action: 'LOGIN',
      targetId: user.id,
      targetType: 'User',
      ipAddress,
    });



    return {
      data: {
        accessToken,
        rawRefreshToken,
        expiresAt,
        mustChangePassword: user.mustChangePassword,
        user: {
          id: user.id,
          bankUserId: user.bankUserId,
          name: user.name,
          role: user.role,
          email: user.email,
        },
      },
    };
  }

  async refresh(rawToken) {
    if (!rawToken) {
      return { error: { code: 'TOKEN_INVALID', status: 401, message: 'Refresh token is required' } };
    }

    try {
      verifyRefreshToken(rawToken);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return { error: { code: 'TOKEN_EXPIRED', status: 401, message: 'Refresh token has expired' } };
      }
      return { error: { code: 'TOKEN_INVALID', status: 401, message: 'Refresh token is invalid' } };
    }

    const tokenHash = hashToken(rawToken);
    const storedToken = await RefreshTokenRepository.findByTokenHash(tokenHash);
    if (!storedToken) {
      return { error: { code: 'TOKEN_INVALID', status: 401, message: 'Refresh token not recognized' } };
    }

    if (storedToken.isRevoked) {

      await RefreshTokenRepository.revokeFamilyByUserId(storedToken.userId, storedToken.family);
      return {
        error: {
          code: 'TOKEN_REUSE_DETECTED',
          status: 401,
          message: 'Refresh token reuse detected. All sessions in this family have been revoked.',
        },
      };
    }

    const user = await UserRepository.findById(storedToken.userId);
    if (!user) {
      return { error: { code: 'TOKEN_INVALID', status: 401, message: 'User not found' } };
    }

    const newAccessToken = signAccessToken({
      sub: user.id,
      role: user.role,
      bankUserId: user.bankUserId,
      mustChangePassword: user.mustChangePassword,
    });

    const newRawRefreshToken = signRefreshToken({ sub: user.id, family: storedToken.family });
    const newTokenHash = hashToken(newRawRefreshToken);

    await RefreshTokenRepository.revokeToken(storedToken.id);
    await RefreshTokenRepository.setReplacedByHash(storedToken.id, newTokenHash);

    const expiresAt = expiresInToDate(config.JWT_REFRESH_EXPIRES_IN);
    await RefreshTokenRepository.create({
      userId: user.id,
      tokenHash: newTokenHash,
      family: storedToken.family,
      expiresAt,
    });

    return { data: { accessToken: newAccessToken, rawRefreshToken: newRawRefreshToken, expiresAt } };
  }

  async logout(rawToken, userId, userRole, ipAddress) {
    if (rawToken) {
      const tokenHash = hashToken(rawToken);
      const storedToken = await RefreshTokenRepository.findByTokenHash(tokenHash);
      if (storedToken) {
        await RefreshTokenRepository.revokeToken(storedToken.id);
      }
    }

    await AuditEventRepository.create({
      actorId: userId,
      actorRole: userRole,
      action: 'LOGOUT',
      targetId: userId,
      targetType: 'User',
      ipAddress,
    });



    return { data: { message: 'Logged out successfully' } };
  }
}

export default new AuthService();
