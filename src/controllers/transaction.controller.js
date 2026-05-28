import transactionService from '../services/transaction.service.js';
import accountService from '../services/account.service.js';

class TransactionController {
  async lookupAccount(req, res, next) {
    try {
      const { accountNumber } = req.query;
      if (!accountNumber) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'accountNumber query parameter is required' },
        });
      }

      const result = await accountService.lookupByAccountNumber(accountNumber);
      if (result.error) {
        const { status, ...error } = result.error;
        return res.status(status).json({ success: false, error });
      }
      return res.status(200).json({ success: true, data: result.data });
    } catch (err) {
      next(err);
    }
  }

  async credit(req, res, next) {
    try {
      const { accountNumber, amount, description } = req.body;
      const result = await transactionService.credit(
        accountNumber,
        amount,
        description,
        req.user.id,
        req.user.role,
        req.ip
      );
      if (result.error) {
        const { status, ...error } = result.error;
        return res.status(status).json({ success: false, error });
      }
      return res.status(200).json({ success: true, data: result.data });
    } catch (err) {
      if (err.code && err.status) {
        return res.status(err.status).json({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      next(err);
    }
  }

  async debit(req, res, next) {
    try {
      const { accountNumber, amount, description } = req.body;
      const result = await transactionService.debit(
        accountNumber,
        amount,
        description,
        req.user.id,
        req.user.role,
        req.ip
      );
      if (result.error) {
        const { status, ...error } = result.error;
        return res.status(status).json({ success: false, error });
      }
      return res.status(200).json({ success: true, data: result.data });
    } catch (err) {
      if (err.code && err.status) {
        return res.status(err.status).json({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      next(err);
    }
  }

  async transfer(req, res, next) {
    try {
      const { sourceAccountNumber, destinationAccountNumber, amount, description } = req.body;
      const result = await transactionService.transfer(
        sourceAccountNumber,
        destinationAccountNumber,
        amount,
        description,
        req.user.id,
        req.user.role,
        req.ip
      );
      if (result.error) {
        const { status, ...error } = result.error;
        return res.status(status).json({ success: false, error });
      }
      return res.status(200).json({ success: true, data: result.data });
    } catch (err) {
      if (err.code && err.status) {
        return res.status(err.status).json({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      next(err);
    }
  }

  async getHistory(req, res, next) {
    try {
      const filters = {
        type: req.query.type,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        minAmount: req.query.minAmount ? parseFloat(req.query.minAmount) : undefined,
        maxAmount: req.query.maxAmount ? parseFloat(req.query.maxAmount) : undefined,
      };
      const pagination = {
        page: parseInt(req.query.page, 10) || 1,
        limit: parseInt(req.query.limit, 10) || 10,
      };

      const result = await transactionService.getHistory(req.user.id, filters, pagination);
      if (result.error) {
        const { status, ...error } = result.error;
        return res.status(status).json({ success: false, error });
      }
      return res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  }

  async getHistoryByUserId(req, res, next) {
    try {
      // Defense-in-depth: only admin and employee may view any user's history
      if (req.user.role === 'user') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You do not have permission to access this resource' },
        });
      }

      const userId = parseInt(req.params.userId, 10);
      if (!userId || userId <= 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid userId parameter' },
        });
      }
      const filters = {
        type: req.query.type,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        minAmount: req.query.minAmount ? parseFloat(req.query.minAmount) : undefined,
        maxAmount: req.query.maxAmount ? parseFloat(req.query.maxAmount) : undefined,
      };
      const pagination = {
        page: parseInt(req.query.page, 10) || 1,
        limit: parseInt(req.query.limit, 10) || 10,
      };

      const result = await transactionService.getHistoryByUserId(userId, filters, pagination);
      if (result.error) {
        const { status, ...error } = result.error;
        return res.status(status).json({ success: false, error });
      }
      return res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  }
}

export default new TransactionController();
