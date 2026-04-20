import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { AppCard, AppInput, FadeInView, ScalePressable } from '@/components/ui';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const handleEmailChange = useCallback((text: string) => setEmail(text), []);
  const handlePasswordChange = useCallback((text: string) => setPassword(text), []);

  const handleLogin = async () => {
    if (!email.trim() || !password) { setError('Please fill in all fields'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Please enter a valid email address'); return; }
    setLoading(true); setError('');
    const err = await signIn(email.trim(), password);
    setLoading(false);
    if (err) setError(err);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + SPACING.lg }]} keyboardShouldPersistTaps="handled">
          <FadeInView style={styles.headerSection}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to continue learning</Text>
          </FadeInView>

          <FadeInView delay={60}>
            <AppCard style={styles.formCard}>
              {error ? (
                <View style={styles.errorBox} testID="login-error">
                  <Ionicons name="alert-circle" size={18} color={COLORS.error} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <AppInput
                label="Email"
                leftIcon="mail-outline"
                placeholder="Enter your email"
                value={email}
                onChangeText={handleEmailChange}
                autoCapitalize="none"
                keyboardType="email-address"
                testID="login-email-input"
              />

              <View>
                <AppInput
                  label="Password"
                  leftIcon="lock-closed-outline"
                  placeholder="Enter your password"
                  value={password}
                  onChangeText={handlePasswordChange}
                  secureTextEntry={!showPass}
                  testID="login-password-input"
                />
                <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn} testID="toggle-password">
                  <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.forgotRow} onPress={() => router.push('/auth/forgot-password')} testID="forgot-password-btn">
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>

              <ScalePressable style={[styles.primaryBtn, loading && styles.btnDisabled]} onPress={handleLogin} disabled={loading} testID="login-submit-btn">
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Sign In</Text>}
              </ScalePressable>
            </AppCard>
          </FadeInView>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Don&apos;t have an account? </Text>
            <TouchableOpacity onPress={() => router.replace('/auth/signup')} testID="goto-signup-btn">
              <Text style={styles.footerLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  body: { flexGrow: 1, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg },
  headerSection: { marginBottom: SPACING.lg },
  title: { ...TYPOGRAPHY.title, color: COLORS.text, fontWeight: '800' },
  subtitle: { ...TYPOGRAPHY.body, color: COLORS.textMuted, marginTop: SPACING.xs },
  formCard: {
    gap: SPACING.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EBEBEB',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, backgroundColor: '#FEE4E2', padding: SPACING.sm, borderRadius: RADIUS.md },
  errorText: { ...TYPOGRAPHY.body, color: COLORS.error, flex: 1 },
  eyeBtn: { position: 'absolute', right: SPACING.sm, top: 34, height: 40, justifyContent: 'center' },
  primaryBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, minHeight: 54, width: '100%', justifyContent: 'center', alignItems: 'center', marginTop: SPACING.md },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  forgotRow: { alignSelf: 'flex-end', marginTop: SPACING.xs },
  forgotText: { ...TYPOGRAPHY.label, color: COLORS.primary },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.lg },
  footerText: { ...TYPOGRAPHY.body, color: COLORS.textMuted },
  footerLink: { ...TYPOGRAPHY.label, color: COLORS.primary },
});
