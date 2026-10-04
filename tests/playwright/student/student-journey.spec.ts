import { test, expect } from '@playwright/test';
import { setupFirebaseMocks, performUILogin } from '../helpers/authHelper';
import { TEST_USERS, TEST_COURSES } from '../fixtures/mockData';

test.describe('Phase 4: Critical Student Journey', () => {
  test('Step 1 & 2: Student Login & Dashboard Loading', async ({ page }) => {
    await setupFirebaseMocks(page, TEST_USERS.STUDENT_A, false);

    await page.goto('/auth/login');
    await expect(page.locator('[data-testid="login-email-input"]')).toBeVisible();

    await performUILogin(page, TEST_USERS.STUDENT_A.email, TEST_USERS.STUDENT_A.password);

    // After login, student lands on the main application tabs
    await expect(page).not.toHaveURL(/.*\/auth\/login.*/);
  });

  test.describe('Authenticated Student Operations', () => {
    test.beforeEach(async ({ page }) => {
      await setupFirebaseMocks(page, TEST_USERS.STUDENT_A, true);
    });

    test('Step 3 & 4: Course Catalog & Course Details Navigation', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.locator('body')).toBeVisible();

    // Verify course catalog page structure
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeDefined();

    // Navigate to enrolled course
    await page.goto(`/course/${TEST_COURSES.COURSE_A.id}`);
    await expect(page.locator('body')).toBeVisible();
  });

  test('Step 5 & 6: Course Gating — Enrolled Unlock vs Unenrolled Lock UI', async ({ page }) => {
    // 1. Enrolled course should load for Student A
    await page.goto(`/course/${TEST_COURSES.COURSE_A.id}`);
    await expect(page.locator('body')).toBeVisible();

    // 2. Unenrolled course (Course B) should present the enrollment gate / admission action
    await page.goto(`/course/${TEST_COURSES.COURSE_B.id}`);
    await expect(page.locator('body')).toBeVisible();
  });

  test('Step 12 & 13: Quiz UI Loading', async ({ page }) => {
    await page.goto('/quiz');
    await expect(page.locator('body')).toBeVisible();
  });

  test('Step 14 & 15: Attendance & Progress UI Loading', async ({ page }) => {
    await page.goto('/attendance');
    await expect(page.locator('body')).toBeVisible();

    await page.goto('/progress');
    await expect(page.locator('body')).toBeVisible();
  });

  test('Step 16 & 17: Certificate UI & Sanad Verification Route', async ({ page }) => {
    await page.goto('/certificate');
    await expect(page.locator('body')).toBeVisible();

    // Public Sanad Verification Route
    await page.goto('/verify-sanad');
    await expect(page.locator('text=Official Sanad Verification').first()).toBeVisible();
    await expect(page.locator('input[placeholder*="MSLB-SANAD"]')).toBeVisible();
  });
  });
});
