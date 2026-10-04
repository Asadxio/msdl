import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Configuration — Madrasatu-s-Salikat Lil Banat
 * Package: com.madrasatussalikat.lilbanat
 * Target: Build 49 / versionCode 49
 */
export default defineConfig({
  testDir: './tests/playwright',
  timeout: 30000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:8081',
    storageState: './tests/playwright/fixtures/storageState.json',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 10000,
    navigationTimeout: 15000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'mobile-android',
      use: {
        ...devices['Pixel 5'],
      },
    },
  ],
  webServer: {
    command: 'node scripts/serve-test-app.js',
    url: 'http://127.0.0.1:8081/health',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
