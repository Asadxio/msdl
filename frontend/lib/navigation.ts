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
