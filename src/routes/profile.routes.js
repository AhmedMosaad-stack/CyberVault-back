import { Router } from 'express';
import userController from '../controllers/user.controller.js';
import authenticate from '../middleware/authenticate.js';
import validate from '../middleware/validate.js';
import { updateProfileSchema, changePasswordSchema } from '../validators/user.validator.js';

const router = Router();

router.get('/', authenticate, (req, res, next) =>
  userController.getProfile(req, res, next)
);

router.patch('/', authenticate, validate(updateProfileSchema), (req, res, next) =>
  userController.updateProfile(req, res, next)
);

router.patch('/password', authenticate, validate(changePasswordSchema), (req, res, next) =>
  userController.changePassword(req, res, next)
);

export default router;
