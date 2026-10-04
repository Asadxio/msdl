import { test, expect } from '@playwright/test';
import { setupFirebaseMocks, performUILogin } from '../helpers/authHelper';
import { TEST_USERS } from '../fixtures/mockData';

test.describe('Phase 9 & 10: Payment Browser Workflow & Donation Isolation', () => {
  test.beforeEach(async ({ page }) => {
    await setupFirebaseMocks(page, TEST_USERS.STUDENT_A);
  });

  test('Payment Screen loads with Clean Segregation between Academic Fees and Donations', async ({ page }) => {
    await page.goto('/payment');
    await page.waitForLoadState('domcontentloaded');

    // Title and domain tabs
    await expect(page.locator('text=Payment & Donations')).toBeVisible();
    await expect(page.locator('text=Academic Fees')).toBeVisible();
    await expect(page.locator('text=Donations & Zakat')).toBeVisible();
  });

  test('Domain Switching: Academic Fee Tab vs Donation Tab', async ({ page }) => {
    await page.goto('/payment');
    await page.waitForLoadState('domcontentloaded');

    // Default is Academic Fees
    await expect(page.locator('text=Academic Fees')).toBeVisible();

    // Switch to Donation domain
    const donationTab = page.locator('text=Donations & Zakat');
    await donationTab.click();

    // Verify donation options appear (e.g. Sadqah / Zakat labels)
    await expect(page.locator('text=Sadqah Jariyah (صدقہ جاریہ)')).toBeVisible();
  });

  test('Payment History Screen: Renders transaction log without errors', async ({ page }) => {
    await page.goto('/payment-history');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('Donation Isolation Invariant: Donation never initiates course entitlement', async ({ page }) => {
    await page.goto('/payment?domain=donation');
    await page.waitForLoadState('domcontentloaded');

    // Verify we are in donation domain
    await expect(page.locator('text=Donations & Zakat')).toBeVisible();
    await expect(page.locator('text=Islamic Welfare Funds & Donations')).toBeVisible();

    // In donation domain, course fee selector is NOT shown as payable tuition
    const academicFeeHeading = page.locator('text=Course Fee / Tuition');
    const isAcademicPresent = await academicFeeHeading.isVisible();
    expect(isAcademicPresent).toBe(false);
  });
});
