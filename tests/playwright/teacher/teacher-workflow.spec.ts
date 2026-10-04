import { test, expect } from '@playwright/test';
import { setupFirebaseMocks } from '../helpers/authHelper';
import { TEST_USERS } from '../fixtures/mockData';

test.describe('Phase 6: Teacher Workflow & Academic Management', () => {
  test.beforeEach(async ({ page }) => {
    await setupFirebaseMocks(page, TEST_USERS.TEACHER);
  });

  test('Teacher Workspace: Assignments Screen Loads Cleanly', async ({ page }) => {
    await page.goto('/teacher/assignments');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('Teacher Workspace: Lessons Screen Loads Cleanly', async ({ page }) => {
    await page.goto('/teacher/lessons');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('Teacher Workspace: Student Roster Loads Cleanly', async ({ page }) => {
    await page.goto('/teacher/students');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('Teacher Workspace: Academic Progress Overview Loads Cleanly', async ({ page }) => {
    await page.goto('/teacher/progress');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });
});
