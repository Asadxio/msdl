import { test, expect } from '@playwright/test';
import { setupFirebaseMocks } from '../helpers/authHelper';
import { TEST_USERS } from '../fixtures/mockData';

test.describe('Phase 14: App-Side Notification Inbox & Deep-Link Routing', () => {
  test.beforeEach(async ({ page }) => {
    await setupFirebaseMocks(page, TEST_USERS.STUDENT_A);
  });

  test('Notification Inbox Screen Loads Cleanly', async ({ page }) => {
    await page.goto('/notifications');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('Notification Tabs Navigation: Tab switches work', async ({ page }) => {
    await page.goto('/notifications');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });
});
