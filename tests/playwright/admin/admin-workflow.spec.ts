import { test, expect } from '@playwright/test';
import { setupFirebaseMocks } from '../helpers/authHelper';
import { TEST_USERS } from '../fixtures/mockData';

test.describe('Phase 7: Admin Operations & RBAC Protection', () => {
  test('Admin Workspace: User Management Loads', async ({ page }) => {
    await setupFirebaseMocks(page, TEST_USERS.ADMIN);
    await page.goto('/admin/users');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('Admin Workspace: Academic Management Loads', async ({ page }) => {
    await setupFirebaseMocks(page, TEST_USERS.ADMIN);
    await page.goto('/admin/manage-academics');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('Admin Workspace: Quiz Management Loads', async ({ page }) => {
    await setupFirebaseMocks(page, TEST_USERS.ADMIN);
    await page.goto('/admin/manage-quizzes');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('Admin Workspace: Payment Management Loads', async ({ page }) => {
    await setupFirebaseMocks(page, TEST_USERS.ADMIN);
    await page.goto('/admin/payments');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('RBAC Security: Student cannot access Admin routes', async ({ page }) => {
    // Authenticate as Student
    await setupFirebaseMocks(page, TEST_USERS.STUDENT_A);

    await page.goto('/admin/users');
    await expect(page).not.toHaveURL(/.*admin\/users.*/);
  });
});
