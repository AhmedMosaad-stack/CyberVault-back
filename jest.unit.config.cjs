/**
 * Jest configuration — unit tests only (no coverage).
 */
const rootConfig = require('./jest.config.cjs');

module.exports = {
  ...rootConfig,
  testMatch: ['**/tests/unit/**/*.test.js'],
  collectCoverage: false,
};
