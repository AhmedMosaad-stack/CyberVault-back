import userService from '../services/user.service.js';

class UserController {
  async getProfile(req, res, next) {
    try {
      const result = await userService.getProfile(req.user.id);
      if (result.error) {
        const { status, ...error } = result.error;
        return res.status(status).json({ success: false, error });
      }
      return res.status(200).json({ success: true, data: result.data });
    } catch (err) {
      next(err);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const result = await userService.updateProfile(req.user.id, req.body);
      if (result.error) {
        const { status, ...error } = result.error;
        return res.status(status).json({ success: false, error });
      }
      return res.status(200).json({ success: true, data: result.data });
    } catch (err) {
      next(err);
    }
  }

  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      const result = await userService.changePassword(
        req.user.id,
        currentPassword,
        newPassword,
        req.user.role,
        req.ip
      );
      if (result.error) {
        const { status, ...error } = result.error;
        return res.status(status).json({ success: false, error });
      }
      return res.status(200).json({ success: true, data: result.data });
    } catch (err) {
      next(err);
    }
  }

  async listUsers(req, res, next) {
    try {
      const filters = {
        name: req.query.name,
        email: req.query.email,
        bankUserId: req.query.bankUserId,
        role: req.query.role,
      };
      const pagination = {
        page: parseInt(req.query.page, 10) || 1,
        limit: parseInt(req.query.limit, 10) || 10,
      };

      const result = await userService.listUsers(filters, pagination);
      return res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  }

  async getUserById(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const result = await userService.getUserById(id);
      if (result.error) {
        const { status, ...error } = result.error;
        return res.status(status).json({ success: false, error });
      }
      return res.status(200).json({ success: true, data: result.data });
    } catch (err) {
      next(err);
    }
  }

  async createUser(req, res, next) {
    try {
      const result = await userService.createUser(req.body, req.user.id, req.user.role, req.ip);
      if (result.error) {
        const { status, ...error } = result.error;
        return res.status(status).json({ success: false, error });
      }
      return res.status(201).json({ success: true, data: result.data });
    } catch (err) {
      next(err);
    }
  }

  async createEmployee(req, res, next) {
    try {
      const result = await userService.createEmployee(req.body, req.user.id, req.user.role, req.ip);
      if (result.error) {
        const { status, ...error } = result.error;
        return res.status(status).json({ success: false, error });
      }
      return res.status(201).json({ success: true, data: result.data });
    } catch (err) {
      next(err);
    }
  }

  async updateUser(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const result = await userService.updateUser(id, req.body, req.user.id, req.user.role, req.ip);
      if (result.error) {
        const { status, ...error } = result.error;
        return res.status(status).json({ success: false, error });
      }
      return res.status(200).json({ success: true, data: result.data });
    } catch (err) {
      next(err);
    }
  }

  async deleteUser(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const result = await userService.deleteUser(id, req.user.id, req.user.role, req.ip);
      if (result.error) {
        const { status, ...error } = result.error;
        return res.status(status).json({ success: false, error });
      }
      return res.status(200).json({ success: true, data: result.data });
    } catch (err) {
      next(err);
    }
  }

  async unlockUser(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const result = await userService.unlockUser(id, req.user.id, req.user.role, req.ip);
      if (result.error) {
        const { status, ...error } = result.error;
        return res.status(status).json({ success: false, error });
      }
      return res.status(200).json({ success: true, data: result.data });
    } catch (err) {
      next(err);
    }
  }
}

export default new UserController();
