import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

import config from './config/index.js';
import logger from './utils/logger.js';
import errorHandler from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';

import authRoutes from './routes/auth.routes.js';
import profileRoutes from './routes/profile.routes.js';
import userRoutes from './routes/user.routes.js';
import transactionRoutes from './routes/transaction.routes.js';
import contactRoutes from './routes/contact.routes.js';

import transactionController from './controllers/transaction.controller.js';
import userController from './controllers/user.controller.js';
import authenticate from './middleware/authenticate.js';
import authorize from './middleware/authorize.js';
import validate from './middleware/validate.js';
import { createEmployeeSchema } from './validators/user.validator.js';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: config.CORS_ORIGINS,
    credentials: true,
  })
);

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(
  pinoHttp({
    logger,
    customProps: (req) => ({
      userId: req.user?.id || null,
    }),
    autoLogging: false,
  })
);

app.use('/api/v1/', apiLimiter);

app.get('/api/v1/', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    version: '1.0.0',
  });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/profile', profileRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/transactions', transactionRoutes);
app.use('/api/v1/contact', contactRoutes);

app.get('/api/v1/accounts/lookup', authenticate, (req, res, next) =>
  transactionController.lookupAccount(req, res, next)
);

app.post(
  '/api/v1/employees',
  authenticate,
  authorize('admin'),
  validate(createEmployeeSchema),
  (req, res, next) => userController.createEmployee(req, res, next)
);

if (config.NODE_ENV !== 'production') {
  const swaggerOptions = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'CyberVault Bank API',
        version: '1.0.0',
        description: 'REST API for CyberVault Bank Management System',
      },
      servers: [
        {
          url: `http://localhost:${config.PORT}/api/v1`,
          description: 'Development server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
    apis: ['./src/routes/*.js'],
  };

  const swaggerSpec = swaggerJsdoc(swaggerOptions);
  app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  });
});

app.use(errorHandler);

export default app;
