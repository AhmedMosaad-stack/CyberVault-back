import rateLimit from 'express-rate-limit';
import config from '../config/index.js';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skip: () => config.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many login attempts. Please try again later.',
      },
    });
  },
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  skip: () => config.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
      },
    });
  },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skip: () => config.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
      },
    });
  },
});

export { loginLimiter, refreshLimiter, apiLimiter };
