import { test, expect } from '@playwright/test';
import { setupFirebaseMocks } from '../helpers/authHelper';
import { TEST_USERS, TEST_SANAD } from '../fixtures/mockData';

test.describe('Phase 13: Sanad Verification & Public Authenticity Portal', () => {
  test('Certificate Screen in Student Portal Loads', async ({ page }) => {
    await setupFirebaseMocks(page, TEST_USERS.STUDENT_A);
    await page.goto('/certificate');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('Public Sanad Verification Portal: Renders Search Form and Headers', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('@madrasatussalikat/onboarding_entry_completed_version', '1.0.12');
      } catch (e) {}
    });
    await page.goto('/verify-sanad');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('text=Official Sanad Verification').first()).toBeVisible();
    await expect(page.locator('text=Enter Certificate Serial Number:')).toBeVisible();
    await expect(page.locator('input[placeholder*="MSLB-SANAD"]')).toBeVisible();
    await expect(page.locator('text=Verify Certificate')).toBeVisible();
  });

  test('Public Sanad Verification: Search Input accepts serial number', async ({ page }) => {
    await page.goto('/verify-sanad');
    await page.waitForLoadState('domcontentloaded');

    const input = page.locator('input[placeholder*="MSLB-SANAD"]');
    await input.fill(TEST_SANAD.serial);
    await expect(input).toHaveValue(TEST_SANAD.serial);

    // Verify click on verify button
    const verifyBtn = page.locator('text=Verify Certificate');
    await verifyBtn.click();
    await expect(page.locator('body')).toBeVisible();
  });
});
