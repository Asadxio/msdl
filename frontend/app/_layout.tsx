import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { COLORS } from '@/constants/theme';
import { DataProvider } from '@/context/DataContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, profile, authLoading, emailVerified } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;

    const inAuth = segments[0] === 'auth';
    const isAdmin = profile?.role === 'admin';

    if (!user) {
      if (!inAuth) router.replace('/auth/login');
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
  }, [user, profile, authLoading, emailVerified, segments]);

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
        <AuthGate>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
              contentStyle: { backgroundColor: COLORS.background },
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="course/[id]" />
            <Stack.Screen name="teacher/[id]" />
            <Stack.Screen name="book/[id]" />
            <Stack.Screen name="admin/add-book" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="admin/users" options={{ animation: 'slide_from_bottom' }} />
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

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
});
