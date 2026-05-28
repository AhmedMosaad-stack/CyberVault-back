import { Router } from 'express';
import authController from '../controllers/auth.controller.js';
import authenticate from '../middleware/authenticate.js';
import validate from '../middleware/validate.js';
import { loginSchema } from '../validators/auth.validator.js';
import { loginLimiter, refreshLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post('/login', loginLimiter, validate(loginSchema), (req, res, next) =>
  authController.login(req, res, next)
);

router.post('/refresh', refreshLimiter, (req, res, next) =>
  authController.refresh(req, res, next)
);

router.post('/logout', authenticate, (req, res, next) =>
  authController.logout(req, res, next)
);

export default router;
