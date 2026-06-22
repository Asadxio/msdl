import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Linking,
  Modal,
  useColorScheme,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import type { OnboardingRole } from '@/lib/roles';
import { AppCard, AppInput, FadeInView, ScalePressable } from '@/components/ui';
import { WHATSAPP_HELP_URL, normalizeWhatsAppUrl } from '@/lib/links';
import {
  markSignupStarted,
  markVerificationModalContinue,
  markVerificationModalShown,
  trackEmailVerificationError,
} from '@/lib/emailVerificationAnalytics';

/**
 * Production-safe Signup UI:
 * - SafeArea + ScrollView for all device sizes
 * - Defensive async handling and validation
 */
export default function SignupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const { user, signUp, showSignupVerificationPrompt, acknowledgeSignupVerificationPrompt } = useAuth();
  const modalShownTrackedRef = useRef(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [role, setRole] = useState<OnboardingRole>('student');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleNameChange = useCallback((text: string) => setName(text), []);
  const handleEmailChange = useCallback((text: string) => setEmail(text), []);
  const handlePasswordChange = useCallback((text: string) => setPassword(text), []);
  const handleReferralCodeChange = useCallback((text: string) => setReferralCode(text), []);

  const emailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()), [email]);

  useEffect(() => {
    if (!showSignupVerificationPrompt || modalShownTrackedRef.current) return;
    modalShownTrackedRef.current = true;
    void markVerificationModalShown(user?.uid || '');
  }, [showSignupVerificationPrompt, user?.uid]);

  const handleContinueToVerification = useCallback(() => {
    void markVerificationModalContinue(user?.uid);
    acknowledgeSignupVerificationPrompt();
    try {
      router.replace('/auth/pending');
    } catch (error) {
      trackEmailVerificationError('verification_navigation_failed', error, { uid: user?.uid || '', target: '/auth/pending' });
    }
  }, [acknowledgeSignupVerificationPrompt, router, user?.uid]);

  const handleSignup = async () => {
    if (loading) return;
    if (!name.trim() || !email.trim() || !password) {
      setError('Please fill in all fields');
      return;
    }
    if (!emailValid) {
      setError('Please enter a valid email address');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    markSignupStarted();
    setLoading(true);
    setError('');
    try {
      const err = await signUp(name.trim(), email.trim(), password, role, referralCode.trim());
      if (err) setError(err);
    } catch (e: any) {
      setError(e?.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, isDarkMode && styles.containerDark]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FadeInView style={styles.headerSection}>
            <Text style={[styles.title, isDarkMode && styles.titleDark]}>Create Account</Text>
            <Text style={[styles.subtitle, isDarkMode && styles.subtitleDark]}>Join our learning community</Text>
          </FadeInView>

          <FadeInView delay={60}>
            <AppCard style={[styles.formCard, isDarkMode && styles.formCardDark]}>
              {error ? (
                <View style={styles.errorBox} testID="signup-error">
                  <Ionicons name="alert-circle" size={18} color={COLORS.error} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <AppInput label="Full Name" leftIcon="person-outline" placeholder="Enter your name" value={name} onChangeText={handleNameChange} testID="signup-name-input" />
              <AppInput label="Email" leftIcon="mail-outline" placeholder="Enter your email" value={email} onChangeText={handleEmailChange} autoCapitalize="none" keyboardType="email-address" testID="signup-email-input" />

              <View>
                <AppInput label="Password" leftIcon="lock-closed-outline" placeholder="Min 6 characters" value={password} onChangeText={handlePasswordChange} secureTextEntry={!showPass} testID="signup-password-input" />
                <TouchableOpacity onPress={() => setShowPass((v) => !v)} style={styles.eyeBtn} testID="toggle-password" accessibilityLabel={showPass ? 'Hide password' : 'Show password'}>
                  <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>I am a</Text>
                <View style={styles.roleRow}>
                  <ScalePressable style={[styles.roleBtn, role === 'student' && styles.roleBtnActive]} onPress={() => setRole('student')} testID="role-student-btn">
                    <Text style={[styles.roleBtnText, role === 'student' && styles.roleBtnTextActive]}>Student</Text>
                  </ScalePressable>
                  <ScalePressable style={[styles.roleBtn, role === 'teacher' && styles.roleBtnActive]} onPress={() => setRole('teacher')} testID="role-teacher-btn">
                    <Text style={[styles.roleBtnText, role === 'teacher' && styles.roleBtnTextActive]}>Teacher</Text>
                  </ScalePressable>
                </View>
              </View>

              <AppInput label="Referral Code (optional)" leftIcon="gift-outline" placeholder="Enter referral code" value={referralCode} onChangeText={handleReferralCodeChange} autoCapitalize="characters" />

              <ScalePressable style={[styles.primaryBtn, loading && styles.btnDisabled]} onPress={handleSignup} disabled={loading} testID="signup-submit-btn">
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Create Account</Text>}
              </ScalePressable>
            </AppCard>
          </FadeInView>

          <View style={styles.footerRow}>
            <Text style={[styles.footerText, isDarkMode && styles.footerTextDark]}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.replace('/auth/login')} testID="goto-login-btn">
              <Text style={[styles.footerLink, isDarkMode && styles.footerLinkDark]}>Sign In</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.helpBtn}
            onPress={async () => {
              const phone = '916366919122';
              const text = 'Salam. I am interested in guidance services. I clicked from your website and would like more information.';
              const webUrl = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
              const directUrl = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(text)}`;
              try {
                if (Platform.OS === 'android') {
                  // On Android 11+, canOpenURL requires <queries> in manifest.
                  // Use wa.me URL which opens WhatsApp directly if installed.
                  await Linking.openURL(webUrl);
                } else {
                  const canOpen = await Linking.canOpenURL(directUrl);
                  if (canOpen) {
                    await Linking.openURL(directUrl);
                  } else {
                    await Linking.openURL(webUrl);
                  }
                }
              } catch {
                try {
                  await Linking.openURL(WHATSAPP_HELP_URL);
                } catch {
                  Alert.alert('WhatsApp Unavailable', 'Could not open WhatsApp. Please install WhatsApp or contact us directly.');
                }
              }
            }}
          >
            <Text style={styles.helpBtnText}>Need Help? WhatsApp Us</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
      <Modal transparent visible={showSignupVerificationPrompt} animationType="fade" onRequestClose={handleContinueToVerification}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, isDarkMode && styles.modalCardDark]} testID="signup-verification-modal">
            <View style={[styles.modalIconCircle, isDarkMode && styles.modalIconCircleDark]}>
              <Ionicons name="mail-unread-outline" size={28} color={isDarkMode ? COLORS.secondary : COLORS.primary} />
            </View>
            <Text style={[styles.modalTitle, isDarkMode && styles.modalTitleDark]}>Verify Your Email</Text>
            <Text style={[styles.modalMessage, isDarkMode && styles.modalMessageDark]}>
              We have sent a verification email to your email address. If you don{'\''}t see it within a few minutes, please check your Spam/Junk, Promotions, or Updates folders.
            </Text>
            <ScalePressable style={styles.modalButton} onPress={handleContinueToVerification} testID="signup-verification-continue-btn">
              <Text style={styles.modalButtonText}>Continue</Text>
            </ScalePressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  containerDark: { backgroundColor: '#071A14' },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xl,
    gap: SPACING.md,
  },
  headerSection: { marginBottom: SPACING.md },
  title: { ...TYPOGRAPHY.title, color: COLORS.text, fontWeight: '800', textAlign: 'left' },
  titleDark: { color: '#F8FAF9' },
  subtitle: { ...TYPOGRAPHY.body, color: COLORS.textMuted, marginTop: SPACING.xs, textAlign: 'left' },
  subtitleDark: { color: '#A9BBB4' },
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
  formCardDark: {
    backgroundColor: '#102820',
    borderColor: '#214438',
    shadowColor: '#000000',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: '#FEE4E2',
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  errorText: { ...TYPOGRAPHY.body, color: COLORS.error, flex: 1, textAlign: 'left' },
  eyeBtn: { position: 'absolute', right: SPACING.sm, top: 34, height: 40, justifyContent: 'center' },
  field: { gap: SPACING.xs },
  label: { ...TYPOGRAPHY.label, color: '#6A6A6A', fontSize: 12, fontWeight: '500', textAlign: 'left' },
  roleRow: { flexDirection: 'row', gap: SPACING.sm },
  roleBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
  },
  roleBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  roleBtnText: { ...TYPOGRAPHY.label, color: COLORS.textMuted },
  roleBtnTextActive: { color: '#FFFFFF' },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    minHeight: 54,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.md },
  footerText: { ...TYPOGRAPHY.body, color: COLORS.textMuted },
  footerTextDark: { color: '#A9BBB4' },
  footerLink: { ...TYPOGRAPHY.label, color: COLORS.primary },
  footerLinkDark: { color: COLORS.secondary },
  helpBtn: { alignSelf: 'center', marginTop: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.full, backgroundColor: '#DCFCE7' },
  helpBtnText: { ...TYPOGRAPHY.label, color: '#166534', fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.42)', alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
  modalCard: { width: '100%', maxWidth: 420, backgroundColor: '#FFFFFF', borderRadius: RADIUS.xl, padding: SPACING.lg, alignItems: 'center', gap: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  modalCardDark: { backgroundColor: '#102820', borderColor: '#214438' },
  modalIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.goldBg, alignItems: 'center', justifyContent: 'center' },
  modalIconCircleDark: { backgroundColor: '#213B31' },
  modalTitle: { ...TYPOGRAPHY.heading, color: COLORS.textMain, textAlign: 'center', fontWeight: '800' },
  modalTitleDark: { color: '#F8FAF9' },
  modalMessage: { ...TYPOGRAPHY.body, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22 },
  modalMessageDark: { color: '#C8D7D1' },
  modalButton: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, minHeight: 50, width: '100%', alignItems: 'center', justifyContent: 'center', marginTop: SPACING.xs },
  modalButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
