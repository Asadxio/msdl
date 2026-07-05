import { Stack, useRouter, useSegments } from 'expo-router';
import type { Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { I18nManager, Platform } from 'react-native';
import { COLORS } from '@/constants/theme';
import { ThemeProvider } from '@/context/ThemeContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { DataProvider } from '@/context/DataContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { initPushNotifications, registerDevicePushToken } from '@/lib/pushNotifications';
import { validateConfig, getMissingConfigVars } from '@/lib/config';
import { dedupeNotificationEvent, resolveRouteFromNotificationData } from '@/lib/notificationCenter';
import { markNotificationDelivered, markNotificationOpened } from '@/lib/notificationTelemetryWriter';
import { getConsentStatus } from '@/lib/legal';
import { reportError } from '@/lib/errorReporter';
import { getReleaseDiagnostics } from '@/lib/releaseDiagnostics';
import { FullScreenLoader } from '@/components/ui';
import { startupLog } from '@/lib/startup';
import { shouldShowOnboardingEntry } from '@/lib/onboarding';
import { safeReplace } from '@/lib/navigation';
import { OnboardingProvider } from '@/context/OnboardingContext';
import { TutorialProvider } from '@/context/TutorialContext';
import { InAppTutorialOverlay } from '@/components/ui/InAppTutorialOverlay';
import { isTutorialCompleted } from '@/lib/tutorialStorage';
import { markUserEnteredApp } from '@/lib/emailVerificationAnalytics';
import { trackEvent, type AnalyticsEventName } from '@/lib/analytics';

SplashScreen.preventAutoHideAsync().catch(() => {});

const ONBOARDING_GATE_TIMEOUT_MS = 2500;

function formatErrorMessage(error: unknown, fallback = 'An unexpected error occurred.') {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return fallback;
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, profile, profileIssue, authLoading, emailVerified, profileOffline, signupVerificationFlowActive } = useAuth();
  const profileStatus = profile?.status;
  const [needsLegalAcceptance, setNeedsLegalAcceptance] = useState(false);
  const [onboardingStatus, setOnboardingStatus] = useState<'checking' | 'required' | 'complete'>('checking');
  const [splashHidden, setSplashHidden] = useState(false);
  const [shouldShowTutorial, setShouldShowTutorial] = useState(false);
  const enteredAppTrackedRef = useRef<string | null>(null);
  useEffect(() => {
    try {
      validateConfig();
    } catch (error) {
      console.warn('[Config] Invalid environment configuration; continuing startup.', {
        error: formatErrorMessage(error, 'Invalid environment configuration.'),
        missingVars: getMissingConfigVars(),
      });
    }
  }, []);
  const hideRequestedRef = useRef(false);
  const rootLoaderClearedRef = useRef(false);
  const gateAnalyticsKeysRef = useRef(new Set<string>());
  const segments = useSegments();
  const segmentKey = segments.join('/');
  const router = useRouter();

  const performReplace = useCallback((route: string) => {
    try {
      // Use global-safe replace to coordinate with other components without
      // permanently suppressing auth-state redirects after sign-in.
      safeReplace(router, route as any);
    } catch (error) {
      startupLog('router.replace failed', { route, message: formatErrorMessage(error) });
    }
  }, [router]);


  const trackGateEvent = useCallback((name: AnalyticsEventName, reason: string, extra: Record<string, unknown> = {}) => {
    const uid = user?.uid || 'anonymous';
    const key = `${name}:${uid}:${reason}:${profile?.status || 'no-status'}:${profile?.role || 'no-role'}:${emailVerified}`;
    if (gateAnalyticsKeysRef.current.has(key)) return;
    gateAnalyticsKeysRef.current.add(key);
    trackEvent(name, {
      uid,
      reason,
      emailVerified,
      profileStatus: profile?.status || 'missing',
      role: profile?.role || 'missing',
      profileIssue: profileIssue || 'none',
      platform: Platform.OS,
      timestamp: Date.now(),
      ...extra,
    }, key);
  }, [emailVerified, profile?.role, profile?.status, profileIssue, user?.uid]);

  const safeHideSplash = useCallback(async () => {
    if (hideRequestedRef.current) return;
    hideRequestedRef.current = true;

    try {
      await SplashScreen.hideAsync();
      startupLog('Splash screen hidden');
    } catch (error) {
      startupLog('Splash screen hide failed', { message: formatErrorMessage(error) });
    } finally {
      setSplashHidden(true);
    }
  }, []);

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
            startupLog('Onboarding gate check failed', { message: formatErrorMessage(error) });
          });
      } catch (error) {
        if (mounted && !settled) {
          setOnboardingStatus('complete');
          startupLog('Startup sequence failed before onboarding complete', { message: formatErrorMessage(error) });
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

    if (!rootLoaderClearedRef.current) {
      rootLoaderClearedRef.current = true;
      startupLog('Root loader cleared');
    }

    const inAuth = segments[0] === 'auth';
    const inPendingAuthRoute = segmentKey === 'auth/pending' || segmentKey === 'auth/change-email';
    const inOnboardingEntry = segments[0] === 'onboarding-entry';
    const isSuperAdminFounder = profile?.role === 'super_admin' && profile?.founder === true;
    const isAdmin = (profile?.role === 'admin' || profile?.role === 'super_admin') && profile?.status === 'approved';
    const inAdmin = segments[0] === 'admin';
    const inUnauthorized = segments[0] === 'unauthorized';
    const legalConsentRoutes = ['legal-gate', 'terms', 'privacy', 'community-guidelines'];
    const inLegalConsentRoute = legalConsentRoutes.includes(String(segments[0] || ''));
    const inLegalGate = segments[0] === 'legal-gate';
    const holdingSignupVerificationPrompt = signupVerificationFlowActive && segmentKey === 'auth/signup';

    if (onboardingStatus === 'required') {
      if (!inOnboardingEntry) {
        startupLog('Navigation complete', { action: 'replace', route: '/onboarding-entry', reason: 'onboarding-required' });
        performReplace('/onboarding-entry');
      } else {
        startupLog('Navigation complete', { route: 'onboarding-entry', reason: 'onboarding-required' });
      }
    } else if (inOnboardingEntry) {
      const route = user ? '/' : '/auth/login';
      startupLog('Navigation complete', { action: 'replace', route, reason: 'onboarding-complete' });
      performReplace(route);
    } else if (!user) {
      if (!inAuth) {
        startupLog('Navigation complete', { action: 'replace', route: '/auth/login', reason: 'no-user' });
        performReplace('/auth/login');
      } else {
        startupLog('Navigation complete', { route: segmentKey || 'auth', reason: 'no-user-auth-route' });
      }
    } else if (holdingSignupVerificationPrompt) {
      startupLog('Navigation complete', { route: segmentKey, reason: 'signup-verification-prompt' });
    } else if (needsLegalAcceptance && !inLegalConsentRoute) {
      startupLog('Navigation complete', { action: 'replace', route: '/legal-gate', reason: 'needs-legal-acceptance' });
      performReplace('/legal-gate');
    } else if (!needsLegalAcceptance && inLegalGate) {
      startupLog('Navigation complete', { action: 'replace', route: '/', reason: 'legal-gate-complete' });
      performReplace('/');
    } else if (inUnauthorized && profile?.status === 'approved') {
      startupLog('Navigation complete', { action: 'replace', route: '/', reason: 'authorized-user-on-unauthorized' });
      performReplace('/');
    } else if (inAdmin && (profileOffline || !isAdmin)) {
      startupLog('Navigation complete', { action: 'replace', route: '/unauthorized?required=admin', reason: 'admin-required' });
      performReplace('/unauthorized?required=admin');
    } else if (profile?.status === 'rejected') {
      trackGateEvent('approval_rejected', 'account-rejected');
      if (emailVerified) trackGateEvent('user_stuck_after_verification', 'account-rejected');
      if (segments.join('/') !== 'auth/pending') {
        startupLog('Navigation complete', { action: 'replace', route: '/auth/pending', reason: 'account-status' });
        performReplace('/auth/pending');
      } else {
        startupLog('Navigation complete', { route: 'auth/pending', reason: 'already-pending' });
      }
    } else if (profile?.status === 'deactivated' || profile?.status === 'suspended') {
      if (emailVerified) trackGateEvent('user_stuck_after_verification', 'account-suspended');
      // Deactivated/suspended users -> pending screen shows a blocked-account state
      if (segments.join('/') !== 'auth/pending') {
        startupLog('Navigation complete', { action: 'replace', route: '/auth/pending', reason: 'account-status' });
        performReplace('/auth/pending');
      } else {
        startupLog('Navigation complete', { route: 'auth/pending', reason: 'already-pending' });
      }
    } else if (profileIssue) {
      const eventName = profileIssue === 'missing_profile_document' ? 'missing_profile_document' : profileIssue;
      trackGateEvent(eventName, profileIssue);
      if (emailVerified) trackGateEvent('user_stuck_after_verification', profileIssue);
      if (segments.join('/') !== 'auth/pending') {
        startupLog('Navigation complete', { action: 'replace', route: '/auth/pending', reason: profileIssue });
        performReplace('/auth/pending');
      } else {
        startupLog('Navigation complete', { route: 'auth/pending', reason: profileIssue });
      }
    } else if (user && !profile && !profileOffline) {
      trackGateEvent('missing_profile_document', 'missing-profile-document');
      if (emailVerified) trackGateEvent('user_stuck_after_verification', 'missing-profile-document');
      if (segments.join('/') !== 'auth/pending') {
        startupLog('Navigation complete', { action: 'replace', route: '/auth/pending', reason: 'missing-profile-document' });
        performReplace('/auth/pending');
      } else {
        startupLog('Navigation complete', { route: 'auth/pending', reason: 'missing-profile-document' });
      }
    } else if (!emailVerified && !isAdmin && !isSuperAdminFounder) {
      // Email not verified (non-admin) -> pending screen for verification
      if (!inPendingAuthRoute) {
        startupLog('Navigation complete', { action: 'replace', route: '/auth/pending', reason: 'email-unverified' });
        performReplace('/auth/pending');
      } else {
        startupLog('Navigation complete', { route: 'auth/pending', reason: 'already-pending' });
      }
    } else if (user && (profile?.status === 'approved' || isAdmin || isSuperAdminFounder)) {
      if (user.uid && emailVerified && enteredAppTrackedRef.current !== user.uid) {
        enteredAppTrackedRef.current = user.uid;
        void markUserEnteredApp(user.uid);
      }
      if (inAuth) {
        startupLog('Navigation complete', { action: 'replace', route: '/', reason: 'approved-user-in-auth' });
        performReplace('/');
      } else {
        startupLog('Navigation complete', { route: segmentKey || '/', reason: 'approved-user' });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, authLoading, emailVerified, segments, router, profileOffline, needsLegalAcceptance, onboardingStatus, signupVerificationFlowActive]);

  useEffect(() => {
    if (shouldShowTutorial || authLoading || onboardingStatus !== 'complete' || !user?.uid) return;
    const isAdmin = (profile?.role === 'admin' || profile?.role === 'super_admin') && profile?.status === 'approved';
    const isSuperAdminFounder = profile?.role === 'super_admin' && profile?.founder === true;
    if (!profile || !(profile.status === 'approved' || isAdmin || isSuperAdminFounder) || needsLegalAcceptance) return;

    let cancelled = false;
    void (async () => {
      try {
        const completed = await isTutorialCompleted();
        if (cancelled || completed) return;
        setShouldShowTutorial(true);
      } catch {
        // If tutorial completion check fails, do not block the app.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, onboardingStatus, user?.uid, profile, needsLegalAcceptance, shouldShowTutorial]);

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

  if (!splashHidden || authLoading || onboardingStatus === 'checking') {
    return (
      <FullScreenLoader label={splashHidden ? 'Loading account…' : 'Starting app…'} />
    );
  }

  return (
    <OnboardingProvider value={{ markEntryCompleteInSession }}>
      <TutorialProvider autoShowOnMount={shouldShowTutorial} initialStep="dashboard">
        {children}
        <InAppTutorialOverlay />
      </TutorialProvider>
    </OnboardingProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
    <LanguageProvider>
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
            <Stack.Screen name="notifications" options={{ animation: 'slide_from_right' }} />
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
            <Stack.Screen name="onboarding-first-time" options={{ animation: 'fade' }} />
            <Stack.Screen name="auth/login" options={{ animation: 'fade' }} />
            <Stack.Screen name="auth/signup" options={{ animation: 'fade' }} />
            <Stack.Screen name="auth/pending" options={{ animation: 'fade' }} />
            <Stack.Screen name="auth/change-email" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="auth/forgot-password" options={{ animation: 'slide_from_right' }} />
          </Stack>
        </AuthGate>
      </DataProvider>
    </AuthProvider>
    </LanguageProvider>
    </ThemeProvider>
  );
}

