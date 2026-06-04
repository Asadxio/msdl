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

// Safe replace with a global startup navigation lock to prevent duplicate
// navigations during app startup. Uses a global flag on `globalThis`.
export function safeReplace(router: BackCapableRouter, href: Href) {
  const KEY = '__startupNavigationLock_v1';
  const g = globalThis as any;
  if (g[KEY]) return;
  g[KEY] = true;
  try {
    router.replace(href);
  } catch (error) {
    g[KEY] = false;
    throw error;
  }
}
