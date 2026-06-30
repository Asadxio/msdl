import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, StatusBar, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { AppCard, AppInput, FadeInView, ScalePressable } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function ChangeEmailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile, changeEmailAddress } = useAuth();
  const currentEmail = profile?.email || user?.email || '';
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const normalizedEmail = useMemo(() => normalizeEmail(email), [email]);
  const emailDomain = normalizedEmail.split('@')[1] || 'unknown';

  useEffect(() => {
    trackEvent('verification_change_email_opened', {
      timestamp: Date.now(),
      platform: Platform.OS,
      uid: user?.uid || 'unknown',
      currentEmailDomain: currentEmail.split('@')[1] || 'unknown',
    }, `verification-change-email-opened-${user?.uid || currentEmail || Date.now()}`);
  }, [currentEmail, user?.uid]);

  const handleEmailChange = useCallback((text: string) => setEmail(text), []);
  const handlePasswordChange = useCallback((text: string) => setCurrentPassword(text), []);

  const handleSubmit = async () => {
    if (loading) return;
    setError('');

    const submittedAt = Date.now();
    const basePayload = {
      timestamp: submittedAt,
      platform: Platform.OS,
      uid: user?.uid || 'unknown',
      emailDomain,
      reauthProvided: Boolean(currentPassword),
    };
    trackEvent('verification_change_email_submitted', basePayload, `verification-change-email-submitted-${user?.uid || normalizedEmail}-${submittedAt}`);

    const failValidation = (code: string, message: string) => {
      trackEvent('verification_change_email_failed', {
        ...basePayload,
        code,
      }, `verification-change-email-validation-failed-${user?.uid || normalizedEmail}-${code}-${Date.now()}`);
      setError(message);
    };

    if (!normalizedEmail) {
      failValidation('auth/missing-email', 'Please enter your new email address');
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      failValidation('auth/invalid-email', 'Please enter a valid email address');
      return;
    }
    if (normalizedEmail === normalizeEmail(currentEmail)) {
      failValidation('auth/same-email', 'Please enter a different email address');
      return;
    }
    if (requiresPassword && !currentPassword) {
      failValidation('auth/missing-password', 'Please enter your current password to continue');
      return;
    }

    setLoading(true);
    const result = await changeEmailAddress(normalizedEmail, currentPassword || undefined);
    setLoading(false);

    if (result.error) {
      if (result.code === 'auth/requires-recent-login') setRequiresPassword(true);
      setError(result.error);
      return;
    }

    Alert.alert(
      'Email Updated',
      'Your email address has been updated. A new verification email has been sent.',
      [{ text: 'OK', onPress: () => router.replace('/auth/pending') }],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.backRow} onPress={() => router.replace('/auth/pending')} testID="change-email-back-btn">
            <Ionicons name="arrow-back" size={20} color={COLORS.text} />
            <Text style={styles.backText}>Back to Verification</Text>
          </TouchableOpacity>

          <FadeInView style={styles.headerSection}>
            <Text style={styles.title}>Change Email Address</Text>
            <Text style={styles.subtitle}>Correct your email so we can send a fresh verification link.</Text>
          </FadeInView>

          <FadeInView delay={60}>
            <AppCard style={styles.formCard}>
              <View style={styles.currentEmailBox} testID="current-email-box">
                <Text style={styles.currentEmailLabel}>Current email address</Text>
                <Text style={styles.currentEmailValue}>{currentEmail || 'Not available'}</Text>
              </View>

              {error ? (
                <View style={styles.errorBox} testID="change-email-error">
                  <Ionicons name="alert-circle" size={18} color={COLORS.error} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <AppInput
                label="New email address"
                leftIcon="mail-outline"
                placeholder="Enter new email"
                value={email}
                onChangeText={handleEmailChange}
                autoCapitalize="none"
                keyboardType="email-address"
                testID="change-email-input"
              />

              {requiresPassword ? (
                <View>
                  <AppInput
                    label="Current password"
                    leftIcon="lock-closed-outline"
                    placeholder="Enter your current password"
                    value={currentPassword}
                    onChangeText={handlePasswordChange}
                    secureTextEntry={!showPassword}
                    testID="change-email-password-input"
                  />
                  <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn} testID="change-email-toggle-password" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.textMuted} />
                  </TouchableOpacity>
                </View>
              ) : null}

              <Text style={styles.helpText}>We will update your account email and send a new verification email to the new address.</Text>

              <ScalePressable style={[styles.primaryBtn, loading && styles.btnDisabled]} onPress={handleSubmit} disabled={loading} testID="change-email-submit-btn">
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Update Email & Send Verification</Text>}
              </ScalePressable>
            </AppCard>
          </FadeInView>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: SPACING.lg },
  backText: { ...TYPOGRAPHY.label, color: COLORS.textMuted },
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
  currentEmailBox: { backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  currentEmailLabel: { ...TYPOGRAPHY.label, color: COLORS.textMuted, marginBottom: 4 },
  currentEmailValue: { fontSize: 16, color: COLORS.text, fontWeight: '800' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, backgroundColor: '#FEE4E2', padding: SPACING.sm, borderRadius: RADIUS.md },
  errorText: { ...TYPOGRAPHY.body, color: COLORS.error, flex: 1 },
  helpText: { ...TYPOGRAPHY.body, color: COLORS.textMuted },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  eyeBtn: { position: 'absolute', right: 14, top: 38, padding: SPACING.sm },
});
