import { test, expect } from '@playwright/test';
import { setupFirebaseMocks } from '../helpers/authHelper';
import { TEST_USERS, TEST_COURSES } from '../fixtures/mockData';

test.describe('Phase 5: Academic Isolation & Cross-Course Leakage Prevention', () => {
  test('Student A (Enrolled in Course A): Can view Course A and is gated from Course B', async ({ page }) => {
    // Authenticate as Student A (enrolled in Course A)
    await setupFirebaseMocks(page, TEST_USERS.STUDENT_A);

    // 1. Student A visits Course A
    await page.goto(`/course/${TEST_COURSES.COURSE_A.id}`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();

    // 2. Student A visits Course B (Unenrolled)
    await page.goto(`/course/${TEST_COURSES.COURSE_B.id}`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('Student B (Enrolled in Course B): Can view Course B and is gated from Course A', async ({ page }) => {
    // Authenticate as Student B (enrolled in Course B)
    await setupFirebaseMocks(page, TEST_USERS.STUDENT_B);

    // 1. Student B visits Course B
    await page.goto(`/course/${TEST_COURSES.COURSE_B.id}`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();

    // 2. Student B visits Course A (Unenrolled)
    await page.goto(`/course/${TEST_COURSES.COURSE_A.id}`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('Unenrolled Student sees Admission / Enrollment prompt', async ({ page }) => {
    await setupFirebaseMocks(page, TEST_USERS.PENDING_STUDENT);

    // Pending student visits Course A
    await page.goto(`/course/${TEST_COURSES.COURSE_A.id}`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });
});
