import logger from '../utils/logger.js';

/**
 * Global error handler — last middleware registered in app.js.
 * Catches all errors passed via next(err).
 * Maps Sequelize-specific errors to appropriate error codes.
 */
 
function errorHandler(err, req, res, _next) {
  logger.error({
    err,
    method: req.method,
    url: req.originalUrl,
    userId: req.user?.id || null,
  });

  if (err.name === 'SequelizeUniqueConstraintError') {
    const field = err.errors?.[0]?.path || 'unknown';
    let code = 'INTERNAL_ERROR';
    let message = 'A unique constraint was violated';

    if (field.includes('email')) {
      code = 'EMAIL_EXISTS';
      message = 'This email is already registered';
    } else if (field.includes('nationalIdHash')) {
      code = 'NATIONAL_ID_EXISTS';
      message = 'This national ID is already registered';
    }

    return res.status(409).json({ success: false, error: { code, message } });
  }

  if (err.name === 'SequelizeForeignKeyConstraintError') {
    logger.fatal({ err }, 'Foreign key constraint violation — this should not reach the client');
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' },
    });
  }

  if (err.name === 'SequelizeConnectionError') {
    logger.fatal({ err }, 'Database connection error');
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' },
    });
  }

  if (err.status || err.statusCode) {
    const status = err.status || err.statusCode;
    return res.status(status).json({
      success: false,
      error: {
        code: err.code || 'INTERNAL_ERROR',
        message: err.message || 'An error occurred',
        ...(err.details ? { details: err.details } : {}),
      },
    });
  }

  return res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' },
  });
}

export default errorHandler;
