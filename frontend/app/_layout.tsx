import { Stack, useRouter, useSegments } from 'expo-router';
import type { Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { I18nManager } from 'react-native';
import { COLORS } from '@/constants/theme';
import { DataProvider } from '@/context/DataContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { initPushNotifications, registerDevicePushToken } from '@/lib/pushNotifications';
import { validateConfig, getMissingConfigVars } from '@/lib/config';
import { ConfigErrorScreen } from '@/components/ui/ConfigErrorScreen';
import { dedupeNotificationEvent, resolveRouteFromNotificationData } from '@/lib/notificationCenter';
import { markNotificationDelivered, markNotificationOpened } from '@/lib/notificationTelemetryWriter';
import { getConsentStatus } from '@/lib/legal';
import { reportError } from '@/lib/errorReporter';
import { getReleaseDiagnostics } from '@/lib/releaseDiagnostics';
import { FullScreenLoader } from '@/components/ui';
import { startupLog } from '@/lib/startup';
import { shouldShowOnboardingEntry } from '@/lib/onboarding';
import { OnboardingProvider } from '@/context/OnboardingContext';

SplashScreen.preventAutoHideAsync().catch(() => {});

const ONBOARDING_GATE_TIMEOUT_MS = 2500;

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, profile, authLoading, emailVerified, profileOffline } = useAuth();
  const profileStatus = profile?.status;
  const [needsLegalAcceptance, setNeedsLegalAcceptance] = useState(false);
  const [onboardingStatus, setOnboardingStatus] = useState<'checking' | 'required' | 'complete'>('checking');
  const [splashHidden, setSplashHidden] = useState(false);
  const [configError, setConfigError] = useState<string | null>(() => {
    try {
      validateConfig();
      return null;
    } catch (error) {
      return String(error?.message || 'Invalid environment configuration.');
    }
  });
  const [missingConfigVars] = useState<string[]>(() => getMissingConfigVars());
  const hideRequestedRef = useRef(false);
  const segments = useSegments();
  const segmentKey = segments.join('/');
  const router = useRouter();

  const safeHideSplash = useCallback(async () => {
    if (hideRequestedRef.current) return;
    hideRequestedRef.current = true;

    try {
      await SplashScreen.hideAsync();
      startupLog('Splash screen hidden');
    } catch (error) {
      startupLog('Splash screen hide failed', { message: String(error?.message || error) });
    } finally {
      setSplashHidden(true);
    }
  }, []);

  useEffect(() => {
    if (!configError) return;
    void safeHideSplash();
  }, [configError, safeHideSplash]);

  useEffect(() => {
    let mounted = true;
    let settled = false;
    startupLog('Onboarding gate timeout scheduled', { timeoutMs: ONBOARDING_GATE_TIMEOUT_MS });

    const onboardingTimeout = setTimeout(() => {
      if (!mounted || settled) return;
      settled = true;
      setOnboardingStatus('complete');
      startupLog('Onboarding gate timed out; continuing startup', { timeoutMs: ONBOARDING_GATE_TIMEOUT_MS });
    }, ONBOARDING_GATE_TIMEOUT_MS);

    const startupFallbackTimeout = setTimeout(() => {
      if (!mounted) return;
      startupLog('Startup fallback timeout reached', { timeoutMs: 8000 });
      void safeHideSplash();
    }, 8000);

    const runStartup = async () => {
      try {
        await shouldShowOnboardingEntry()
          .then((required) => {
            if (!mounted || settled) return;
            settled = true;
            clearTimeout(onboardingTimeout);
            setOnboardingStatus(required ? 'required' : 'complete');
            startupLog('Onboarding gate checked', { required });
          })
          .catch((error) => {
            if (!mounted || settled) return;
            settled = true;
            clearTimeout(onboardingTimeout);
            setOnboardingStatus('complete');
            startupLog('Onboarding gate check failed', { message: String(error?.message || error) });
          });
      } catch (error) {
        if (mounted && !settled) {
          setOnboardingStatus('complete');
          startupLog('Startup sequence failed before onboarding complete', { message: String(error?.message || error) });
        }
      } finally {
        clearTimeout(startupFallbackTimeout);
        await safeHideSplash();
      }
    };

    void runStartup();

    return () => {
      mounted = false;
      clearTimeout(onboardingTimeout);
      clearTimeout(startupFallbackTimeout);
    };
  }, [safeHideSplash]);

  const markEntryCompleteInSession = useCallback(() => {
    setOnboardingStatus('complete');
  }, []);

  useEffect(() => {
    if (!user?.uid || profileStatus !== 'approved') {
      setNeedsLegalAcceptance(false);
      return;
    }
    getConsentStatus(user.uid).then((state) => setNeedsLegalAcceptance(state.needsAcceptance)).catch(() => setNeedsLegalAcceptance(true));
  }, [user?.uid, profileStatus, segmentKey]);

  useEffect(() => {
    if (authLoading || onboardingStatus === 'checking') {
      startupLog('Navigation guard waiting', { authLoading, onboardingStatus });
      return;
    }

    startupLog('Root loader cleared');

    const inAuth = segments[0] === 'auth';
    const inOnboardingEntry = segments[0] === 'onboarding-entry';
    const isAdmin = profile?.role === 'admin';
    const inAdmin = segments[0] === 'admin';
    const inUnauthorized = segments[0] === 'unauthorized';
    const legalConsentRoutes = ['legal-gate', 'terms', 'privacy', 'community-guidelines'];
    const inLegalConsentRoute = legalConsentRoutes.includes(String(segments[0] || ''));
    const inLegalGate = segments[0] === 'legal-gate';

    if (onboardingStatus === 'required') {
      if (!inOnboardingEntry) {
        startupLog('Navigation complete', { action: 'replace', route: '/onboarding-entry', reason: 'onboarding-required' });
        router.replace('/onboarding-entry');
      } else {
        startupLog('Navigation complete', { route: 'onboarding-entry', reason: 'onboarding-required' });
      }
    } else if (inOnboardingEntry) {
      const route = user ? '/' : '/auth/login';
      startupLog('Navigation complete', { action: 'replace', route, reason: 'onboarding-complete' });
      router.replace(route);
    } else if (!user) {
      if (!inAuth) {
        startupLog('Navigation complete', { action: 'replace', route: '/auth/login', reason: 'no-user' });
        router.replace('/auth/login');
      } else {
        startupLog('Navigation complete', { route: segmentKey || 'auth', reason: 'no-user-auth-route' });
      }
    } else if (needsLegalAcceptance && !inLegalConsentRoute) {
      startupLog('Navigation complete', { action: 'replace', route: '/legal-gate', reason: 'needs-legal-acceptance' });
      router.replace('/legal-gate');
    } else if (!needsLegalAcceptance && inLegalGate) {
      startupLog('Navigation complete', { action: 'replace', route: '/', reason: 'legal-gate-complete' });
      router.replace('/');
    } else if (inUnauthorized && profile?.status === 'approved') {
      startupLog('Navigation complete', { action: 'replace', route: '/', reason: 'authorized-user-on-unauthorized' });
      router.replace('/');
    } else if (inAdmin && (profileOffline || !isAdmin)) {
      startupLog('Navigation complete', { action: 'replace', route: '/unauthorized?required=admin', reason: 'admin-required' });
      router.replace('/unauthorized?required=admin');
    } else if (profile?.status === 'rejected') {
      if (segments.join('/') !== 'auth/pending') {
        startupLog('Navigation complete', { action: 'replace', route: '/auth/pending', reason: 'account-status' });
        router.replace('/auth/pending');
      } else {
        startupLog('Navigation complete', { route: 'auth/pending', reason: 'already-pending' });
      }
    } else if (profile?.status === 'deactivated') {
      // Deactivated users -> pending screen shows deactivated state
      if (segments.join('/') !== 'auth/pending') {
        startupLog('Navigation complete', { action: 'replace', route: '/auth/pending', reason: 'account-status' });
        router.replace('/auth/pending');
      } else {
        startupLog('Navigation complete', { route: 'auth/pending', reason: 'already-pending' });
      }
    } else if (!emailVerified && !isAdmin) {
      // Email not verified (non-admin) -> pending screen for verification
      if (segments.join('/') !== 'auth/pending') {
        startupLog('Navigation complete', { action: 'replace', route: '/auth/pending', reason: 'email-unverified' });
        router.replace('/auth/pending');
      } else {
        startupLog('Navigation complete', { route: 'auth/pending', reason: 'already-pending' });
      }
    } else if (profile && profile.status === 'pending' && !isAdmin) {
      if (segments.join('/') !== 'auth/pending') {
        startupLog('Navigation complete', { action: 'replace', route: '/auth/pending', reason: 'profile-pending' });
        router.replace('/auth/pending');
      } else {
        startupLog('Navigation complete', { route: 'auth/pending', reason: 'already-pending' });
      }
    } else if (user && (profile?.status === 'approved' || isAdmin)) {
      if (inAuth) {
        startupLog('Navigation complete', { action: 'replace', route: '/', reason: 'approved-user-in-auth' });
        router.replace('/');
      } else {
        startupLog('Navigation complete', { route: segmentKey || '/', reason: 'approved-user' });
      }
    }
  }, [user, profile, authLoading, emailVerified, segments, router, profileOffline, needsLegalAcceptance, onboardingStatus]);


  useEffect(() => {
    try {
      const diag = getReleaseDiagnostics();
      if (__DEV__) {
        console.log('[release_diagnostics]', diag);
      }
    } catch (error) {
      reportError(error, { kind: 'ui', screen: 'root_layout', code: 'release_diag_failed' });
    }
  }, []);

  useEffect(() => {
    const globalHandler = (err: any, isFatal?: boolean) => {
      reportError(err, { kind: 'ui', screen: 'global', code: isFatal ? 'fatal' : 'non_fatal' });
    };
    const maybe = (globalThis as any)?.ErrorUtils;
    const original = maybe?.getGlobalHandler ? maybe.getGlobalHandler() : null;
    if (maybe?.setGlobalHandler) maybe.setGlobalHandler(globalHandler);
    return () => {
      if (maybe?.setGlobalHandler && original) maybe.setGlobalHandler(original);
    };
  }, []);

  useEffect(() => {
    initPushNotifications().catch((error) => {
      console.log('[Notifications] initPushNotifications effect ERROR', error);
    });
  }, []);

  useEffect(() => {
    try {
      I18nManager.allowRTL(false);
      I18nManager.forceRTL(false);
    } catch {
      // no-op
    }
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    registerDevicePushToken(user.uid).catch(() => {});
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return () => {};
    const tokenSub = Notifications.addPushTokenListener(async (event) => {
      const nextToken = String((event as any)?.data || '').trim();
      if (!nextToken) return;
      await registerDevicePushToken(user.uid);
    });
    return () => tokenSub.remove();
  }, [user?.uid]);

  useEffect(() => {
    try {
      const deliveredDedup = new Set<string>();
      const markDeliveredFromNotification = (notification: Notifications.Notification | null) => {
        if (!notification || !user?.uid) return;
        const data = (notification.request.content.data || {}) as any;
        const dedupe = String(data?.push_dedupe_id || notification.request.identifier || '').trim();
        if (!dedupe || deliveredDedup.has(dedupe)) return;
        deliveredDedup.add(dedupe);
        void markNotificationDelivered(dedupe, user.uid).catch(() => {});
      };
      const openFromResponse = (response: Notifications.NotificationResponse | null) => {
        if (!response) return;
        try {
          const data = (response.notification.request.content.data || {}) as any;
          const dedupe = String(data?.push_dedupe_id || response.notification.request.identifier || '').trim();
          if (dedupe && dedupeNotificationEvent(dedupe)) return;
          const route = resolveRouteFromNotificationData(data || {});
          if (!route) return;
          if (dedupe && user?.uid) {
            void markNotificationOpened(dedupe, user.uid, route).catch(() => {});
          }
          if (route.startsWith('/')) router.push(route as Href);
        } catch (error) {
          console.log('[Notifications] response handler ERROR', error);
        }
      };
      const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
        markDeliveredFromNotification(notification);
      });
      const sub = Notifications.addNotificationResponseReceivedListener((response) => openFromResponse(response));
      Notifications.getLastNotificationResponseAsync().then((response) => {
        if (response?.notification) markDeliveredFromNotification(response.notification);
        openFromResponse(response);
      }).catch(() => {});
      return () => { sub.remove(); receivedSub.remove(); };
    } catch (error) {
      console.log('[Notifications] addNotificationResponseReceivedListener ERROR', error);
      return () => {};
    }
  }, [router, user?.uid]);

  if (configError) {
    return <ConfigErrorScreen error={configError} missingVars={missingConfigVars} />;
  }

  if (!splashHidden || authLoading || onboardingStatus === 'checking') {
    return (
      <FullScreenLoader label={splashHidden ? 'Loading account…' : 'Starting app…'} />
    );
  }

  return (
    <OnboardingProvider value={{ markEntryCompleteInSession }}>
      {children}
    </OnboardingProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <DataProvider>
        <AuthGate>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'fade_from_bottom',
              animationDuration: 220,
              contentStyle: { backgroundColor: COLORS.background },
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="course/[id]" />
            <Stack.Screen name="teacher/[id]" />
            <Stack.Screen name="book/[id]" />
            <Stack.Screen name="chat/[id]" />
            <Stack.Screen name="call/[id]" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="live-class/[id]" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="recordings" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="privacy" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="terms" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="community-guidelines" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="data-privacy" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="legal-gate" options={{ animation: 'fade' }} />
            <Stack.Screen name="unauthorized" options={{ animation: 'fade' }} />
            <Stack.Screen name="status" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="status-player" options={{ animation: 'fade' }} />
            <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="more" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="qibla" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="islamic-dashboard" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="islamic-calendar" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="prayer-times" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="payment" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="admin/add-book" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="admin/users" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="admin/payments" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="admin/manage-academics" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="admin/analytics" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="admin/privacy-requests" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="admin/moderation" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="admin/security" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="onboarding-entry" options={{ animation: 'fade' }} />
            <Stack.Screen name="auth/login" options={{ animation: 'fade' }} />
            <Stack.Screen name="auth/signup" options={{ animation: 'fade' }} />
            <Stack.Screen name="auth/pending" options={{ animation: 'fade' }} />
            <Stack.Screen name="auth/forgot-password" options={{ animation: 'slide_from_right' }} />
          </Stack>
        </AuthGate>
      </DataProvider>
    </AuthProvider>
  );
}

