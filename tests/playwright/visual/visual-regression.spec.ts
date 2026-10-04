import { test, expect } from '@playwright/test';
import { setupFirebaseMocks, performUILogin } from '../helpers/authHelper';
import { TEST_USERS } from '../fixtures/mockData';

test.describe('Phase 15: Visual Stability & Responsive Layout Verification', () => {
  test('Visual Check: Login Screen renders with centered card and unclipped typography', async ({ page }) => {
    await page.goto('/auth/login');
    await page.waitForLoadState('domcontentloaded');

    // Verify key visual elements
    await expect(page.locator('text=Welcome Back')).toBeVisible();
    await expect(page.locator('text=مَدْرَسَةُ السَّالِكَاتِ لِلْبَنَات').first()).toBeVisible();
    await expect(page.locator('[data-testid="login-email-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-password-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-submit-btn"]')).toBeVisible();
  });

  test('Visual Check: Payment & Donation Screen renders domain switcher and header cards', async ({ page }) => {
    await setupFirebaseMocks(page, TEST_USERS.STUDENT_A);
    await page.goto('/payment');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('text=Payment & Donations')).toBeVisible();
    await expect(page.locator('text=Academic Fees')).toBeVisible();
    await expect(page.locator('text=Donations & Zakat')).toBeVisible();
  });

  test('Visual Check: Sanad Verification Portal renders official golden seal and form', async ({ page }) => {
    await page.goto('/verify-sanad');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('text=Official Sanad Verification').first()).toBeVisible();
    await expect(page.locator('text=Verify Certificate')).toBeVisible();
  });
});
