/**
 * Authorization middleware factory — checks if req.user.role is in the allowed roles.
 * Must be used AFTER authenticate middleware.
 *
 * @param  {...string} roles - Allowed roles (e.g. 'admin', 'employee', 'user')
 * @returns {Function} Express middleware
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'TOKEN_INVALID', message: 'Authentication required' },
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have permission to access this resource' },
      });
    }

    next();
  };
}

export default authorize;
