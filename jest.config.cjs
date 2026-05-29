/**
 * Jest configuration — root config runs unit + integration together.
 * Uses .cjs extension for CommonJS compatibility with ESM project.
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/unit/**/*.test.js', '**/tests/integration/**/*.test.js'],
  setupFiles: ['dotenv/config'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/config/db.js',       // excluded — DB bootstrapping
    '!src/app.js',             // excluded — Express wiring tested implicitly
    '!src/types/**'            // excluded — JSDoc only, no executable code
  ],
  coverageThreshold: {
    global: {
      statements: 75,
      branches: 60,
      functions: 80,
      lines: 75
    }
  },
  transform: {},
};
