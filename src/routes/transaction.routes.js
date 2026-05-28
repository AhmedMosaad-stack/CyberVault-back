import { Router } from 'express';
import transactionController from '../controllers/transaction.controller.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import validate from '../middleware/validate.js';
import {
  creditSchema,
  debitSchema,
  transferSchema,
} from '../validators/transaction.validator.js';

const router = Router();

router.post('/credit', authenticate, authorize('admin', 'employee', 'user'), validate(creditSchema), (req, res, next) =>
  transactionController.credit(req, res, next)
);

router.post('/debit', authenticate, authorize('admin', 'employee', 'user'), validate(debitSchema), (req, res, next) =>
  transactionController.debit(req, res, next)
);

router.post('/transfer', authenticate, authorize('admin', 'employee', 'user'), validate(transferSchema), (req, res, next) =>
  transactionController.transfer(req, res, next)
);

router.get('/history', authenticate, authorize('admin', 'employee', 'user'), (req, res, next) =>
  transactionController.getHistory(req, res, next)
);

router.get('/history/:userId', authenticate, authorize('admin', 'employee'), (req, res, next) =>
  transactionController.getHistoryByUserId(req, res, next)
);

export default router;
