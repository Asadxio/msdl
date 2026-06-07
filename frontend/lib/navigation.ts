import type { Href } from 'expo-router';

export const HOME_ROUTE = '/(tabs)' as Href;

type BackCapableRouter = {
  back: () => void;
  canGoBack: () => boolean;
  replace: (href: Href) => void;
};

export function goBackOrReplace(router: BackCapableRouter, fallback: Href = HOME_ROUTE) {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback);
}

type ReplaceLockState = {
  href: string;
  timer: ReturnType<typeof setTimeout> | null;
};

const STARTUP_NAVIGATION_LOCK_KEY = '__startupNavigationLock_v2';
const STARTUP_NAVIGATION_LOCK_MS = 250;

// Safe replace with a short, target-aware global lock to prevent duplicate
// startup navigations without blocking later auth-state redirects (for example,
// replacing /auth/login with / after sign-in).
export function safeReplace(router: BackCapableRouter, href: Href) {
  const g = globalThis as any;
  const hrefKey = String(href);
  const currentLock = g[STARTUP_NAVIGATION_LOCK_KEY] as ReplaceLockState | undefined;

  if (currentLock?.href === hrefKey) return;
  if (currentLock?.timer) clearTimeout(currentLock.timer);

  const nextLock: ReplaceLockState = { href: hrefKey, timer: null };
  g[STARTUP_NAVIGATION_LOCK_KEY] = nextLock;

  try {
    router.replace(href);
  } catch (error) {
    delete g[STARTUP_NAVIGATION_LOCK_KEY];
    throw error;
  }

  nextLock.timer = setTimeout(() => {
    if (g[STARTUP_NAVIGATION_LOCK_KEY] === nextLock) {
      delete g[STARTUP_NAVIGATION_LOCK_KEY];
    }
  }, STARTUP_NAVIGATION_LOCK_MS);
}
