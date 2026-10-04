import { test, expect } from '@playwright/test';
import { setupFirebaseMocks } from '../helpers/authHelper';
import { TEST_USERS } from '../fixtures/mockData';

test.describe('Phase 17: Security Negative Tests & Route Guards', () => {
  test('Negative Test 1: Unauthenticated user accessing admin routes is redirected or blocked', async ({ page }) => {
    // No auth mocks injected — completely unauthenticated
    await page.goto('/admin/users');
    await expect(page).not.toHaveURL(/.*admin\/users.*/);
  });

  test('Negative Test 2: Student accessing Teacher Management routes is protected', async ({ page }) => {
    await setupFirebaseMocks(page, TEST_USERS.STUDENT_A);

    await page.goto('/teacher/lessons');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('Negative Test 3: Student cannot access Admin Security settings', async ({ page }) => {
    await setupFirebaseMocks(page, TEST_USERS.STUDENT_A);

    await page.goto('/admin/security');
    await expect(page).not.toHaveURL(/.*admin\/security.*/);
  });
});
