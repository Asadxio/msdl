import { Page, expect } from '@playwright/test';

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/auth/login');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async fillEmail(email: string) {
    await this.page.locator('[data-testid="login-email-input"]').fill(email);
  }

  async fillPassword(password: string) {
    await this.page.locator('[data-testid="login-password-input"]').fill(password);
  }

  async submit() {
    await this.page.locator('[data-testid="login-submit-btn"]').click();
  }

  async login(email: string, password: string = 'Password@123') {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.submit();
  }

  async getErrorMessage() {
    return this.page.locator('[data-testid="login-error"]').textContent();
  }

  async expectVisible() {
    await expect(this.page.locator('[data-testid="login-email-input"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="login-password-input"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="login-submit-btn"]')).toBeVisible();
  }
}
