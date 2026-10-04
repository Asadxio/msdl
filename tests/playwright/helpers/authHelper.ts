import { Page, expect } from '@playwright/test';
import { TEST_USERS, TEST_COURSES } from '../fixtures/mockData';

export type MockUser = typeof TEST_USERS.STUDENT_A;

export async function bypassOnboarding(page: Page) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('@madrasatussalikat/onboarding_entry_completed_version', '1.0.12');
    } catch (e) {}
  });
}

/**
 * Injects mock Firebase Auth and Firestore network interceptors
 * to simulate authenticated states safely and deterministically in browser tests.
 */
export async function setupFirebaseMocks(page: Page, user: MockUser = TEST_USERS.STUDENT_A, isAuthenticated: boolean = true) {
  // 0. Inject authenticated user session, installation sentinel, and onboarding completion
  await page.addInitScript(
    ({ u, apiKey, isAuth }) => {
      try {
        window.localStorage.setItem('MSLB_INSTALLED_v3', '1');
        window.localStorage.setItem('@madrasatussalikat/onboarding_entry_completed_version', '1.0.12');

        if (isAuth) {
          const authKey = `firebase:authUser:${apiKey}:[DEFAULT]`;
          const authUser = {
            uid: u.uid,
            email: u.email,
            emailVerified: true,
            displayName: u.name,
            isAnonymous: false,
            photoURL: null,
            providerData: [
              {
                providerId: 'password',
                uid: u.email,
                displayName: u.name,
                email: u.email,
                phoneNumber: null,
                photoURL: null,
              },
            ],
            stsTokenManager: {
              refreshToken: `mock_refresh_${u.uid}`,
              accessToken: `mock_access_${u.uid}`,
              expirationTime: 9999999999999,
            },
            createdAt: '1704067200000',
            lastLoginAt: '1704067200000',
            apiKey: apiKey,
            appName: '[DEFAULT]',
          };
          window.localStorage.setItem(authKey, JSON.stringify(authUser));

          const profileKey = `@mslb_cached_profile:${u.uid}`;
          const cachedProfile = {
            uid: u.uid,
            name: u.name,
            email: u.email,
            role: u.role,
            status: u.status,
            organization_id: u.organization_id,
          };
          window.localStorage.setItem(profileKey, JSON.stringify(cachedProfile));
          window.localStorage.setItem(`profile_cache_${u.uid}`, JSON.stringify(cachedProfile));
          window.localStorage.setItem(`@mslb_legal_accepted_${u.uid}`, '1');
        }
      } catch (e) {}
    },
    { u: user, apiKey: 'AIzaSyDFk_Cc6yEIROJ60vq0VtyFx0qd4YUeqxQ', isAuth: isAuthenticated }
  );

  // Mock Firebase Secure Token (Token Refresh)
  await page.route('**/securetoken.googleapis.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: `mock_access_token_${user.uid}`,
        expires_in: '3600',
        token_type: 'Bearer',
        refresh_token: `mock_refresh_token_${user.uid}`,
        id_token: `mock_id_token_${user.uid}`,
        user_id: user.uid,
        project_id: 'madrasa-app-50d6c',
      }),
    });
  });

  // 1. Mock Firebase Identity Toolkit (Sign-In with Password)
  await page.route('**/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword*', async (route) => {
    const postData = route.request().postDataJSON() || {};
    const email = postData.email || '';
    const password = postData.password || '';

    if (password === 'wrong-password') {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 400,
            message: 'INVALID_LOGIN_CREDENTIALS',
            errors: [{ message: 'INVALID_LOGIN_CREDENTIALS', domain: 'global', reason: 'invalid' }],
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        kind: 'identitytoolkit#VerifyPasswordResponse',
        localId: user.uid,
        email: user.email,
        displayName: user.name,
        idToken: `mock_id_token_${user.uid}`,
        registered: true,
        refreshToken: `mock_refresh_token_${user.uid}`,
        expiresIn: '3600',
      }),
    });
  });

  // 2. Mock Firebase Identity Toolkit (Account Lookup)
  await page.route('**/identitytoolkit.googleapis.com/v1/accounts:lookup*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        kind: 'identitytoolkit#GetAccountInfoResponse',
        users: [
          {
            localId: user.uid,
            email: user.email,
            emailVerified: true,
            displayName: user.name,
            providerUserInfo: [{ providerId: 'password', federatedId: user.email, email: user.email }],
          },
        ],
      }),
    });
  });

  // 3. Mock Firestore Profile & Academic Documents
  await page.route('**/firestore.googleapis.com/**', async (route) => {
    const url = route.request().url();

    // Legal Acceptance compliance lookup
    if (url.includes('/compliance/legal_acceptance')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          name: `projects/madrasa-app-50d6c/databases/(default)/documents/users/${user.uid}/compliance/legal_acceptance`,
          fields: {
            accepted: {
              mapValue: {
                fields: {
                  terms: { mapValue: { fields: { version: { stringValue: '2026.09.01' } } } },
                  privacy: { mapValue: { fields: { version: { stringValue: '2026.09.01' } } } },
                  community: { mapValue: { fields: { version: { stringValue: '2026.09.01' } } } },
                },
              },
            },
          },
          createTime: '2026-01-01T00:00:00Z',
          updateTime: '2026-01-01T00:00:00Z',
        }),
      });
      return;
    }

    // User profile lookup
    if (url.includes(`/documents/users/${user.uid}`) || url.includes('/documents/users/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          name: `projects/madrasa-app-50d6c/databases/(default)/documents/users/${user.uid}`,
          fields: {
            uid: { stringValue: user.uid },
            name: { stringValue: user.name },
            email: { stringValue: user.email },
            role: { stringValue: user.role },
            status: { stringValue: user.status },
            organization_id: { stringValue: user.organization_id },
          },
          createTime: '2026-01-01T00:00:00Z',
          updateTime: '2026-01-01T00:00:00Z',
        }),
      });
      return;
    }

    // Default pass-through or safe empty collection response
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ documents: [] }),
    });
  });
}

/**
 * Automates login through the UI form
 */
export async function performUILogin(page: Page, email: string, pass: string = 'Password@123') {
  await page.goto('/auth/login');
  await page.waitForLoadState('domcontentloaded');

  // If already authenticated and redirected away from login, return successfully
  if (!page.url().includes('/auth/login')) {
    return;
  }

  const emailInput = page.locator('[data-testid="login-email-input"]');
  const passwordInput = page.locator('[data-testid="login-password-input"]');
  const submitBtn = page.locator('[data-testid="login-submit-btn"]');

  await expect(emailInput).toBeVisible({ timeout: 5000 });
  await emailInput.fill(email);
  await passwordInput.fill(pass);
  await submitBtn.click();

  // Ensure login transition completes and user is navigated away from /auth/login
  await expect(page).not.toHaveURL(/.*\/auth\/login.*/, { timeout: 10000 });
}
