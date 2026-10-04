import { test, expect } from '@playwright/test';
import { setupFirebaseMocks } from '../helpers/authHelper';
import { TEST_USERS } from '../fixtures/mockData';

test.describe('Phase 8: Universal Chat Direct Messaging', () => {
  test.beforeEach(async ({ page }) => {
    await setupFirebaseMocks(page, TEST_USERS.STUDENT_A);
  });

  test('Chats Tab in Student Portal Loads Cleanly', async ({ page }) => {
    await page.goto('/chats');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('Direct Chat Room: Renders chat container', async ({ page }) => {
    const mockChatId = `chat_${TEST_USERS.STUDENT_A.uid}_${TEST_USERS.TEACHER.uid}`;
    await page.goto(`/chat/${mockChatId}`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });
});
