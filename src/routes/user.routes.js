import { Router } from 'express';
import userController from '../controllers/user.controller.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import validate from '../middleware/validate.js';
import {
  createUserSchema,
  updateUserSchema,
} from '../validators/user.validator.js';

const router = Router();

router.get('/', authenticate, authorize('admin', 'employee'), (req, res, next) =>
  userController.listUsers(req, res, next)
);

router.get('/:id', authenticate, authorize('admin', 'employee'), (req, res, next) =>
  userController.getUserById(req, res, next)
);

router.post('/', authenticate, authorize('admin', 'employee'), validate(createUserSchema), (req, res, next) =>
  userController.createUser(req, res, next)
);

router.patch('/:id', authenticate, authorize('admin', 'employee'), validate(updateUserSchema), (req, res, next) =>
  userController.updateUser(req, res, next)
);

router.delete('/:id', authenticate, authorize('admin'), (req, res, next) =>
  userController.deleteUser(req, res, next)
);

router.patch('/:id/unlock', authenticate, authorize('admin'), (req, res, next) =>
  userController.unlockUser(req, res, next)
);

export default router;
