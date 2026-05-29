import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './flows',
  timeout: 30000,
  retries: 1,
  workers: 1,
  use: {
    baseURL: process.env.STAGING_BASE_URL || 'http://127.0.0.1:5001',
    extraHTTPHeaders: { 'Content-Type': 'application/json' }
  },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
});
