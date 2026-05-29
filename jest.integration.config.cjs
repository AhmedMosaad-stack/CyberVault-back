/**
 * Jest configuration — integration tests only (no coverage).
 */
const rootConfig = require('./jest.config.cjs');

module.exports = {
  ...rootConfig,
  testMatch: ['**/tests/integration/**/*.test.js'],
  testTimeout: 20000,   // allow for DB reset on each file
  collectCoverage: false,
};
