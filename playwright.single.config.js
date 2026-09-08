import { defineConfig } from '@playwright/test';
import shared from './playwright.config.js';

export default defineConfig(shared, {
  testDir: './tests/single',
  outputDir: 'test-results-single',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-single' }]],
  use: { baseURL: undefined, offline: true },
});
