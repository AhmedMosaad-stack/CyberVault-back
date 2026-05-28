import authService from '../services/auth.service.js';
import config from '../config/index.js';

class AuthController {
  async login(req, res, next) {
    try {
      const { bankUserId, password } = req.body;
      const result = await authService.login(bankUserId, password, req.ip);

      if (result.error) {
        const { status, ...error } = result.error;
        return res.status(status).json({ success: false, error });
      }

      const { accessToken, rawRefreshToken, expiresAt, mustChangePassword, user } = result.data;

      res.cookie('refreshToken', rawRefreshToken, {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: 'strict',
        expires: expiresAt,
      });

      return res.status(200).json({
        success: true,
        data: { accessToken, mustChangePassword, user },
      });
    } catch (err) {
      next(err);
    }
  }

  async refresh(req, res, next) {
    try {
      const rawToken = req.cookies?.refreshToken;
      const result = await authService.refresh(rawToken);

      if (result.error) {
        const { status, ...error } = result.error;
        return res.status(status).json({ success: false, error });
      }

      const { accessToken, rawRefreshToken, expiresAt } = result.data;

      res.cookie('refreshToken', rawRefreshToken, {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: 'strict',
        expires: expiresAt,
      });

      return res.status(200).json({
        success: true,
        data: { accessToken },
      });
    } catch (err) {
      next(err);
    }
  }

  async logout(req, res, next) {
    try {
      const rawToken = req.cookies?.refreshToken;
      const result = await authService.logout(rawToken, req.user.id, req.user.role, req.ip);

      res.clearCookie('refreshToken');

      return res.status(200).json({
        success: true,
        data: result.data,
      });
    } catch (err) {
      next(err);
    }
  }
}

export default new AuthController();
