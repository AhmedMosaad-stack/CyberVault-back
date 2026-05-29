/**
 * Integration test database setup.
 * Provides resetDatabase() and teardownDatabase() helpers.
 *
 * sequelize.sync({ force: true }) is ONLY permitted in this file — never in application code.
 */

import { sequelize } from '../../../src/config/db.js';

/**
 * Call in beforeAll — drops and recreates all tables using model definitions.
 * force: true is ONLY used here in test setup — never in application code.
 */
async function resetDatabase() {
  // Import models to register associations before sync
  await import('../../../src/models/index.js');
  await sequelize.sync({ force: true });
}

/**
 * Call in afterAll — drops all tables and closes connection.
 */
async function teardownDatabase() {
  await sequelize.drop();
  await sequelize.close();
}

export { sequelize, resetDatabase, teardownDatabase };
