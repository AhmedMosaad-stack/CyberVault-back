import { verifyAccessToken } from '../utils/tokenHelpers.js';

/**
 * Authenticate middleware — verifies access token from Authorization header.
 * Attaches req.user = { id, role, bankUserId, mustChangePassword }
 *
 * If mustChangePassword === true, blocks all routes except PATCH /api/v1/profile/password
 */
function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: { code: 'TOKEN_INVALID', message: 'Access token is required' },
      });
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: { code: 'TOKEN_EXPIRED', message: 'Access token has expired' },
        });
      }
      return res.status(401).json({
        success: false,
        error: { code: 'TOKEN_INVALID', message: 'Access token is invalid' },
      });
    }

    req.user = {
      id: decoded.sub,
      role: decoded.role,
      bankUserId: decoded.bankUserId,
      mustChangePassword: decoded.mustChangePassword,
    };

    // Enforce mustChangePassword — block all routes except PATCH /profile/password
    if (decoded.mustChangePassword === true) {
      const isPasswordChangeUrl =
        req.method === 'PATCH' && req.originalUrl.endsWith('/profile/password');

      if (!isPasswordChangeUrl) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'MUST_CHANGE_PASSWORD',
            message: 'You must change your temporary password before accessing this resource',
          },
        });
      }
    }

    next();
  } catch (err) {
    next(err);
  }
}

export default authenticate;
