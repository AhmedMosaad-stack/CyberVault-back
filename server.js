import config from './src/config/index.js';
import logger from './src/utils/logger.js';
import app from './src/app.js';

// Import models to register associations before DB sync
import './src/models/index.js';

import { connectDB } from './src/config/db.js';
import RefreshTokenRepository from './src/repositories/RefreshTokenRepository.js';

const PORT = config.PORT;

/**
 * Clean up expired refresh tokens.
 * Runs once at startup and then every 24 hours.
 */
async function cleanExpiredTokens() {
  try {
    await RefreshTokenRepository.deleteExpired();
  } catch (err) {
    logger.error({ err }, 'Failed to clean expired refresh tokens');
  }
}

/**
 * Start the server.
 */
async function startServer() {
  try {
    // Connect to database and sync tables
    await connectDB();

    // Clean expired tokens on startup
    await cleanExpiredTokens();

    // Schedule token cleanup every 24 hours
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    setInterval(cleanExpiredTokens, TWENTY_FOUR_HOURS);

    // Start HTTP server
    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });

    // ─── Graceful Shutdown ─────────────────────────────────────────
    const shutdown = async (_signal) => {
      server.close(async () => {
        try {
          const { sequelize } = await import('./src/config/db.js');
          await sequelize.close();

        } catch (err) {
          logger.error({ err }, 'Error closing database connection');
        }
        process.exit(0);
      });

      // Force exit after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // ─── Unhandled rejections and uncaught exceptions ──────────────
    process.on('unhandledRejection', (reason) => {
      logger.fatal({ err: reason }, 'Unhandled Promise Rejection');
      shutdown('unhandledRejection');
    });

    process.on('uncaughtException', (err) => {
      logger.fatal({ err }, 'Uncaught Exception');
      shutdown('uncaughtException');
    });
  } catch (err) {
    console.error('\n[FATAL] Server failed to start:', err, '\n');
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  }
}

startServer();
