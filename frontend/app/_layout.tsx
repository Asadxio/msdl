import { Stack, useRouter, useSegments } from 'expo-router';
import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, I18nManager, Alert, Linking } from 'react-native';
import { COLORS } from '@/constants/theme';
import { DataProvider } from '@/context/DataContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { CallProvider } from '@/context/CallContext';
import { IncomingCallModal } from '@/components/IncomingCallModal';
import * as Notifications from 'expo-notifications';
import { initPushNotifications, registerDevicePushToken, requestNotificationPermission } from '@/lib/pushNotifications';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, profile, authLoading, emailVerified } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;

    const inAuth = segments[0] === 'auth';
    const isAdmin = profile?.role === 'admin';
    const inAdmin = segments[0] === 'admin';
    const inUnauthorized = segments[0] === 'unauthorized';
    const topLevelPath = segments.join('/');
    const teacherOnlyRoutes = new Set(['status']);
    const isTeacherOnlyRoute = teacherOnlyRoutes.has(topLevelPath);
    const isTeacherOrAdmin = profile?.role === 'teacher' || profile?.role === 'admin';

    if (!user) {
      if (!inAuth) router.replace('/auth/login');
    } else if (inUnauthorized && profile?.status === 'approved') {
      router.replace('/');
    } else if (inAdmin && !isAdmin) {
      router.replace('/unauthorized?required=admin');
    } else if (isTeacherOnlyRoute && !isTeacherOrAdmin) {
      router.replace('/unauthorized?required=teacher');
    } else if (profile?.status === 'rejected') {
      if (segments.join('/') !== 'auth/pending') router.replace('/auth/pending');
    } else if (profile?.status === 'deactivated') {
      // Deactivated users -> pending screen shows deactivated state
      if (segments.join('/') !== 'auth/pending') router.replace('/auth/pending');
    } else if (!emailVerified && !isAdmin) {
      // Email not verified (non-admin) -> pending screen for verification
      if (segments.join('/') !== 'auth/pending') router.replace('/auth/pending');
    } else if (profile && profile.status === 'pending' && !isAdmin) {
      if (segments.join('/') !== 'auth/pending') router.replace('/auth/pending');
    } else if (user && (profile?.status === 'approved' || isAdmin)) {
      if (inAuth) router.replace('/');
    }
  }, [user, profile, authLoading, emailVerified, segments, router]);

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
    const setupPush = async () => {
      try {
        console.log('[Notifications] setupPush started');
        // Initialize notification handler first
        await initPushNotifications();
        
        const permission = await requestNotificationPermission();
        console.log('[Notifications] setupPush permission status', permission);
        
        if (!permission.granted) {
          // Only show alert if permission can be requested again
          if (permission.canAskAgain) {
            Alert.alert(
              'Enable Notifications',
              'Allow notifications to receive chat and class updates.',
              [
                { text: 'Not Now', style: 'cancel' },
                { text: 'Open Settings', onPress: () => Linking.openSettings().catch(() => {}) },
              ],
            );
          }
          // Don't show error for denied permissions - this is normal user behavior
          return;
        }
        
        const token = await registerDevicePushToken(user.uid);
        console.log('[Notifications] setupPush registerDevicePushToken result', { hasToken: Boolean(token) });
      } catch (error) {
        // Log error but don't show alert - notifications are not critical
        console.log('[Notifications] setupPush inner ERROR', error);
      }
    };
    setupPush().catch((error) => {
      console.log('[Notifications] setupPush outer ERROR', error);
      // Don't show alert for setup failures - this often happens on web/simulators
    });
  }, [user?.uid]);

  useEffect(() => {
    try {
      const sub = Notifications.addNotificationResponseReceivedListener((response) => {
        try {
          const data = (response.notification.request.content.data || {}) as any;
          console.log('[Notifications] notification response received', data);
          if (data?.chat_id) {
            router.push(`/chat/${data.chat_id}`);
          }
        } catch (error) {
          console.log('[Notifications] response handler ERROR', error);
        }
      });
      return () => sub.remove();
    } catch (error) {
      console.log('[Notifications] addNotificationResponseReceivedListener ERROR', error);
      return () => {};
    }
  }, [router]);

  if (authLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <DataProvider>
        <CallProvider>
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
              <Stack.Screen name="call/[id]" options={{ animation: 'fade', gestureEnabled: false }} />
              <Stack.Screen name="recordings" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="privacy" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="unauthorized" options={{ animation: 'fade' }} />
              <Stack.Screen name="status" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="more" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="payment" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="admin/add-book" options={{ animation: 'slide_from_bottom' }} />
              <Stack.Screen name="admin/users" options={{ animation: 'slide_from_bottom' }} />
              <Stack.Screen name="admin/payments" options={{ animation: 'slide_from_bottom' }} />
              <Stack.Screen name="admin/manage-academics" options={{ animation: 'slide_from_bottom' }} />
              <Stack.Screen name="admin/analytics" options={{ animation: 'slide_from_bottom' }} />
              <Stack.Screen name="auth/login" options={{ animation: 'fade' }} />
              <Stack.Screen name="auth/signup" options={{ animation: 'fade' }} />
              <Stack.Screen name="auth/pending" options={{ animation: 'fade' }} />
              <Stack.Screen name="auth/forgot-password" options={{ animation: 'slide_from_right' }} />
            </Stack>
            {/* Global incoming call modal */}
            <IncomingCallModal />
          </AuthGate>
        </CallProvider>
      </DataProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
});
