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
  TextInput,
  Image,
  Pressable,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY, getThemeColors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import type { OnboardingRole } from '@/lib/roles';
import { FadeInView, ScalePressable } from '@/components/ui';
import { WHATSAPP_HELP_URL } from '@/lib/links';
import {
  markSignupStarted,
  markVerificationModalContinue,
  markVerificationModalShown,
  trackEmailVerificationError,
} from '@/lib/emailVerificationAnalytics';

// FUTURE ARCHITECTURE PREPARATION CONFIG (DISABLED FOR CURRENT STAGE)
// Set phonePersistenceEnabled to true after Firestore rules update to allow 'phone' key.
const FUTURE_CHANNELS_CONFIG = {
  persistence: {
    phonePersistenceEnabled: false, 
    guardianContactEnabled: false,
    parentAccountsEnabled: false,
  },
  verification: {
    otpLoginEnabled: false,
    whatsappVerificationEnabled: false,
    smsNotificationsEnabled: false,
  }
};

type PremiumInputProps = {
  label: string;
  leftIcon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  error?: string;
  success?: boolean;
  secureTextEntry?: boolean;
  rightElement?: React.ReactNode;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  disabled?: boolean;
  prefix?: React.ReactNode;
  testID?: string;
};

const PremiumInput = React.memo(function PremiumInput({
  label,
  leftIcon,
  value,
  onChangeText,
  placeholder,
  error,
  success,
  secureTextEntry,
  rightElement,
  keyboardType = 'default',
  autoCapitalize = 'none',
  disabled = false,
  prefix,
  testID,
}: PremiumInputProps) {
  const [focused, setFocused] = useState(false);
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const colors = getThemeColors(isDarkMode);

  let borderColor = isDarkMode ? '#2E3D5C' : '#E2E8E5';
  if (focused) {
    borderColor = isDarkMode ? '#10B981' : '#0F7660'; 
  } else if (error) {
    borderColor = colors.error;
  } else if (success && value.length > 0) {
    borderColor = colors.success;
  }

  return (
    <View style={styles.inputContainer}>
      <Text style={[
        styles.inputLabel,
        { color: error ? colors.error : focused ? (isDarkMode ? '#10B981' : '#0F7660') : colors.textMuted }
      ]}>
        {label}
      </Text>
      <View style={[
        styles.inputRow,
        { borderColor, backgroundColor: isDarkMode ? '#102820' : '#FFFFFF' },
        focused && styles.inputRowFocused,
        disabled && styles.inputRowDisabled
      ]}>
        <Ionicons 
          name={leftIcon} 
          size={20} 
          color={error ? colors.error : focused ? (isDarkMode ? '#10B981' : '#0F7660') : colors.textMuted} 
          style={styles.leftIcon} 
        />
        {prefix ? <View style={styles.prefixContainer}>{prefix}</View> : null}
        <TextInput
          style={[styles.textInput, { color: colors.text }]}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          editable={!disabled}
          testID={testID}
          accessibilityLabel={label}
        />
        {rightElement}
      </View>
      {error ? (
        <Text style={[styles.inputErrorText, { color: colors.error }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
});

const SegmentedControl = React.memo(function SegmentedControl({
  activeRole,
  onChange,
  disabled
}: {
  activeRole: OnboardingRole;
  onChange: (role: OnboardingRole) => void;
  disabled?: boolean;
}) {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const colors = getThemeColors(isDarkMode);
  
  const [width, setWidth] = useState(0);
  const animatedValue = useRef(new Animated.Value(activeRole === 'student' ? 0 : 1)).current;
  
  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: activeRole === 'student' ? 0 : 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [activeRole]);
  
  const activeBgWidth = (width - 8) / 2;
  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, activeBgWidth > 0 ? activeBgWidth : 0],
  });

  return (
    <View style={styles.inputContainer}>
      <Text style={[styles.inputLabel, { color: colors.textMuted }]}>User Type</Text>
      <View 
        style={[styles.segmentedContainer, { backgroundColor: isDarkMode ? '#1A332B' : '#F1F5F9' }]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      >
        <Animated.View style={[
          styles.segmentedActiveBg,
          {
            width: activeBgWidth > 0 ? activeBgWidth : '48%',
            transform: [{ translateX }],
            backgroundColor: isDarkMode ? '#10B981' : '#0F7660',
          }
        ]} />
        <Pressable
          style={styles.segmentedOption}
          onPress={() => !disabled && onChange('student')}
          accessibilityRole="button"
          accessibilityLabel="Select Student"
          accessibilityState={{ selected: activeRole === 'student' }}
          testID="role-student-btn"
        >
          <Text style={[
            styles.segmentedText,
            { color: activeRole === 'student' ? '#FFFFFF' : colors.textMuted }
          ]}>
            Student
          </Text>
        </Pressable>
        <Pressable
          style={styles.segmentedOption}
          onPress={() => !disabled && onChange('teacher')}
          accessibilityRole="button"
          accessibilityLabel="Select Teacher"
          accessibilityState={{ selected: activeRole === 'teacher' }}
          testID="role-teacher-btn"
        >
          <Text style={[
            styles.segmentedText,
            { color: activeRole === 'teacher' ? '#FFFFFF' : colors.textMuted }
          ]}>
            Teacher
          </Text>
        </Pressable>
      </View>
    </View>
  );
});

export default function SignupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const colors = getThemeColors(isDarkMode);
  
  const { user, signUp, showSignupVerificationPrompt, acknowledgeSignupVerificationPrompt } = useAuth();
  const modalShownTrackedRef = useRef(false);

  // Form State
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<OnboardingRole>('student');
  const [referralCode, setReferralCode] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  // UI State
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Name Validation derived cleanly
  const nameError = useMemo(() => {
    if (!submitted || name.length === 0) return '';
    if (name.trim().length < 3) return 'Name must be at least 3 characters';
    if (/\d/.test(name)) return 'Name cannot contain numbers';
    return '';
  }, [submitted, name]);

  // Mobile Validation derived cleanly
  const mobileError = useMemo(() => {
    if (!submitted || mobile.length === 0) return '';
    if (!/^\d*$/.test(mobile)) return 'Mobile number must contain digits only';
    if (mobile.length !== 10) return 'Mobile number must be exactly 10 digits';
    return '';
  }, [submitted, mobile]);

  // Email Validation derived cleanly
  const emailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()), [email]);
  const emailError = useMemo(() => {
    if (!submitted || email.length === 0 || emailValid) return '';
    return 'Please enter a valid email address';
  }, [submitted, email, emailValid]);

  // Password Strength
  const passwordValidation = useMemo(() => {
    const hasMinLen = password.length >= 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    return {
      hasMinLen,
      hasUpper,
      hasLower,
      hasNumber,
      hasSpecial,
      isValid: hasMinLen && hasUpper && hasLower && hasNumber && hasSpecial,
    };
  }, [password]);

  // Confirm Password Validation derived cleanly
  const confirmPasswordMessage = useMemo(() => {
    if (!submitted || confirmPassword.length === 0) return '';
    return confirmPassword === password ? '✓ Passwords Match' : '❌ Passwords Do Not Match';
  }, [submitted, password, confirmPassword]);

  const confirmPasswordIsError = useMemo(() => {
    if (!submitted || confirmPassword.length === 0) return false;
    return confirmPassword !== password;
  }, [submitted, password, confirmPassword]);

  // Determine if form is ready to submit
  const formIsValid = useMemo(() => {
    return (
      name.trim().length >= 3 &&
      !/\d/.test(name) &&
      /^\d{10}$/.test(mobile) &&
      emailValid &&
      passwordValidation.isValid &&
      confirmPassword === password &&
      termsAccepted &&
      !loading
    );
  }, [name, mobile, emailValid, passwordValidation.isValid, confirmPassword, password, termsAccepted, loading]);

  useEffect(() => {
    if (!showSignupVerificationPrompt || modalShownTrackedRef.current) return;
    modalShownTrackedRef.current = true;
    void markVerificationModalShown(user?.uid || '');
    const timer = setTimeout(() => {
      acknowledgeSignupVerificationPrompt();
      if (user) {
        router.replace('/');
      }
    }, 2800);
    return () => clearTimeout(timer);
  }, [showSignupVerificationPrompt, acknowledgeSignupVerificationPrompt, router, user]);

  const handleContinueToVerification = useCallback(() => {
    void markVerificationModalContinue(user?.uid);
    acknowledgeSignupVerificationPrompt();
    try {
      router.replace('/auth/pending');
    } catch (err) {
      trackEmailVerificationError('verification_navigation_failed', err, { uid: user?.uid || '', target: '/auth/pending' });
    }
  }, [acknowledgeSignupVerificationPrompt, router, user?.uid]);

  const handleSignup = async () => {
    setSubmitted(true);
    if (!formIsValid || loading) return;

    markSignupStarted();
    setLoading(true);
    setError('');

    // Future-ready Phone architecture trigger hook
    if (FUTURE_CHANNELS_CONFIG.persistence.phonePersistenceEnabled) {
      console.log('[FUTURE_ARCHITECTURE] Phone capability trigger placeholder. Value:', `+91${mobile}`);
    }

    try {
      const err = await signUp(name.trim(), email.trim(), password, role, referralCode.trim());
      if (err) setError(err);
    } catch (e: any) {
      setError(e?.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const phonePrefix = useMemo(() => (
    <View style={styles.countrySelector}>
      <Text style={styles.flagText}>🇮🇳</Text>
      <Text style={[styles.codeText, { color: colors.text }]}>+91</Text>
      <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
    </View>
  ), [colors]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
        enabled={Platform.OS === 'ios'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FadeInView style={styles.headerSection}>
            <View style={styles.logoContainer}>
              <Image source={require('../../assets/images/icon.png')} style={styles.logoImage} resizeMode="contain" />
            </View>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Create Account</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              Join Madrasa Tus Salikat Lil Banat and begin your Islamic learning journey.
            </Text>
          </FadeInView>

          <FadeInView delay={60}>
            <View style={[styles.formCard, { backgroundColor: isDarkMode ? '#102820' : '#FFFFFF', borderColor: colors.border }]}>
              
              {error ? (
                <View style={[styles.errorBox, { backgroundColor: isDarkMode ? '#2D0A0A' : '#FEE4E2' }]} testID="signup-error">
                  <Ionicons name="alert-circle" size={18} color={COLORS.error} />
                  <Text style={[styles.errorText, { color: COLORS.error }]}>{error}</Text>
                </View>
              ) : null}

              {/* 1. Full Name */}
              <PremiumInput
                label="Full Name"
                leftIcon="person-outline"
                placeholder="Enter your full name"
                value={name}
                onChangeText={setName}
                error={nameError}
                success={name.length >= 3 && !nameError}
                disabled={loading}
                autoCapitalize="words"
                testID="signup-name-input"
              />

              {/* 2. Mobile Number */}
              <PremiumInput
                label="Mobile Number"
                leftIcon="phone-portrait-outline"
                placeholder="00000 00000"
                value={mobile}
                onChangeText={setMobile}
                prefix={phonePrefix}
                keyboardType="numeric"
                error={mobileError}
                success={mobile.length === 10 && !mobileError}
                disabled={loading}
                testID="signup-mobile-input"
              />

              {/* 3. Email Address */}
              <PremiumInput
                label="Email Address"
                leftIcon="mail-outline"
                placeholder="Enter your email address"
                value={email}
                onChangeText={setEmail}
                error={emailError}
                success={emailValid}
                disabled={loading}
                keyboardType="email-address"
                testID="signup-email-input"
              />

              {/* 4. Password */}
              <View>
                <PremiumInput
                  label="Password"
                  leftIcon="lock-closed-outline"
                  placeholder="Create password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                  disabled={loading}
                  success={passwordValidation.isValid}
                  rightElement={
                    <TouchableOpacity 
                      onPress={() => setShowPass(v => !v)} 
                      style={styles.eyeBtn} 
                      accessibilityLabel={showPass ? 'Hide password' : 'Show password'}
                      accessibilityRole="button"
                    >
                      <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                  }
                  testID="signup-password-input"
                />

                {/* Password Strength Checklist */}
                {password.length > 0 && (
                  <View style={[styles.strengthContainer, { backgroundColor: isDarkMode ? '#132C23' : '#F8FAFC' }]}>
                    <Text style={[styles.strengthTitle, { color: colors.text }]}>Password Requirements:</Text>
                    <View style={styles.requirementRow}>
                      <Ionicons name={passwordValidation.hasMinLen ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={passwordValidation.hasMinLen ? '#10B981' : colors.textMuted} />
                      <Text style={[styles.requirementText, { color: colors.textMuted }, passwordValidation.hasMinLen && styles.requirementActive]}>✓ Minimum 8 characters</Text>
                    </View>
                    <View style={styles.requirementRow}>
                      <Ionicons name={passwordValidation.hasUpper ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={passwordValidation.hasUpper ? '#10B981' : colors.textMuted} />
                      <Text style={[styles.requirementText, { color: colors.textMuted }, passwordValidation.hasUpper && styles.requirementActive]}>✓ One uppercase</Text>
                    </View>
                    <View style={styles.requirementRow}>
                      <Ionicons name={passwordValidation.hasLower ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={passwordValidation.hasLower ? '#10B981' : colors.textMuted} />
                      <Text style={[styles.requirementText, { color: colors.textMuted }, passwordValidation.hasLower && styles.requirementActive]}>✓ One lowercase</Text>
                    </View>
                    <View style={styles.requirementRow}>
                      <Ionicons name={passwordValidation.hasNumber ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={passwordValidation.hasNumber ? '#10B981' : colors.textMuted} />
                      <Text style={[styles.requirementText, { color: colors.textMuted }, passwordValidation.hasNumber && styles.requirementActive]}>✓ One number</Text>
                    </View>
                    <View style={styles.requirementRow}>
                      <Ionicons name={passwordValidation.hasSpecial ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={passwordValidation.hasSpecial ? '#10B981' : colors.textMuted} />
                      <Text style={[styles.requirementText, { color: colors.textMuted }, passwordValidation.hasSpecial && styles.requirementActive]}>✓ One special character</Text>
                    </View>
                  </View>
                )}
              </View>

              {/* 5. Confirm Password */}
              <View>
                <PremiumInput
                  label="Confirm Password"
                  leftIcon="lock-closed-outline"
                  placeholder="Repeat password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPass}
                  disabled={loading}
                  success={confirmPassword.length > 0 && confirmPassword === password}
                  error={confirmPasswordIsError ? 'Passwords do not match' : undefined}
                  rightElement={
                    <TouchableOpacity 
                      onPress={() => setShowConfirmPass(v => !v)} 
                      style={styles.eyeBtn} 
                      accessibilityLabel={showConfirmPass ? 'Hide confirm password' : 'Show confirm password'}
                      accessibilityRole="button"
                    >
                      <Ionicons name={showConfirmPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                  }
                  testID="signup-confirm-password-input"
                />
                
                {confirmPasswordMessage ? (
                  <Text style={[
                    styles.confirmMessageText, 
                    { color: confirmPasswordIsError ? colors.error : '#10B981' }
                  ]}>
                    {confirmPasswordMessage}
                  </Text>
                ) : null}
              </View>

              {/* 6. User Type Segmented Control */}
              <SegmentedControl
                activeRole={role}
                onChange={setRole}
                disabled={loading}
              />

              {/* 7. Referral Code (Optional) */}
              <PremiumInput
                label="Referral Code"
                leftIcon="gift-outline"
                placeholder="Enter referral code (if any)"
                value={referralCode}
                onChangeText={setReferralCode}
                disabled={loading}
                autoCapitalize="characters"
              />
              <Text style={[styles.helperText, { color: colors.textMuted }]}>
                Leave empty if you don't have a referral code.
              </Text>

              {/* 8. Required Consent checkbox */}
              <View style={styles.consentRow}>
                <Pressable
                  onPress={() => !loading && setTermsAccepted(v => !v)}
                  style={styles.checkboxTouch}
                  accessibilityRole="checkbox"
                  accessibilityLabel="Accept Terms and Conditions and Privacy Policy"
                  accessibilityState={{ checked: termsAccepted }}
                  disabled={loading}
                >
                  <Ionicons 
                    name={termsAccepted ? 'checkbox' : 'square-outline'} 
                    size={22} 
                    color={termsAccepted ? (isDarkMode ? '#10B981' : '#0F7660') : colors.textMuted} 
                  />
                </Pressable>
                <Text style={[styles.consentLabel, { color: colors.textMain }]}>
                  I agree to the{' '}
                  <Text style={styles.hyperlink} onPress={() => router.push('/terms')}>
                    Terms & Conditions
                  </Text>{' '}
                  and{' '}
                  <Text style={styles.hyperlink} onPress={() => router.push('/privacy')}>
                    Privacy Policy
                  </Text>.
                </Text>
              </View>

              {/* Submit Button & Creating Account Loader overlay details */}
              <ScalePressable 
                style={[
                  styles.primaryBtn, 
                  { backgroundColor: isDarkMode ? '#10B981' : '#0F7660' },
                  !formIsValid && styles.btnDisabled
                ]} 
                onPress={handleSignup} 
                disabled={!formIsValid || loading} 
                testID="signup-submit-btn"
              >
                {loading ? (
                  <View style={styles.loaderContainer}>
                    <ActivityIndicator color="#FFFFFF" size="small" />
                    <Text style={styles.loaderText}>Creating your account...</Text>
                  </View>
                ) : (
                  <Text style={styles.primaryBtnText}>Create Account</Text>
                )}
              </ScalePressable>

              {loading && (
                <Text style={[styles.loaderSubtext, { color: colors.textMuted }]}>
                  Please wait...
                </Text>
              )}

            </View>
          </FadeInView>

          {/* Secondary Footer */}
          <View style={styles.footerRow}>
            <Text style={[styles.footerText, { color: colors.textMuted }]}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.replace('/auth/login')} testID="goto-login-btn">
              <Text style={[styles.footerLink, { color: isDarkMode ? '#10B981' : '#0F7660' }]}>Sign In</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity
            style={[styles.helpBtn, { backgroundColor: isDarkMode ? '#213B31' : '#DCFCE7' }]}
            onPress={async () => {
              const phone = '916366919122';
              const text = 'Salam. I am interested in guidance services. I clicked from your website and would like more information.';
              const webUrl = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
              const directUrl = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(text)}`;
              try {
                if (Platform.OS === 'android') {
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
                Alert.alert('WhatsApp Unavailable', 'Could not open WhatsApp. Please contact us directly.');
              }
            }}
          >
            <Text style={[styles.helpBtnText, { color: isDarkMode ? '#10B981' : '#166534' }]}>
              Need Help? WhatsApp Support
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Success Flow Verification Modal Redesign */}
      <Modal transparent visible={showSignupVerificationPrompt} animationType="fade" onRequestClose={handleContinueToVerification}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: isDarkMode ? '#102820' : '#FFFFFF', borderColor: colors.border }]} testID="signup-verification-modal">
            <View style={[styles.modalIconCircle, { backgroundColor: isDarkMode ? '#213B31' : '#E6F7EE' }]}>
              <Ionicons name="checkmark-circle-outline" size={32} color="#10B981" />
            </View>
            <Text style={[styles.modalTitle, { color: colors.text }]}>✅ Account Created Successfully</Text>
            <Text style={[styles.modalMessage, { color: colors.textMuted }]}>
              Your account has been created successfully.
            </Text>
            
            <View style={[styles.modalBulletBox, { backgroundColor: isDarkMode ? '#132C23' : '#F8FAFC', borderColor: colors.border }]}>
              <Text style={[styles.modalBulletText, { color: colors.text }]}>• Please verify your email.</Text>
              <Text style={[styles.modalBulletText, { color: colors.text }]}>• Your account will be reviewed by the Administrator.</Text>
              <Text style={[styles.modalBulletText, { color: colors.text }]}>• You'll receive access after approval.</Text>
            </View>

            <ScalePressable style={[styles.modalButton, { backgroundColor: isDarkMode ? '#10B981' : '#0F7660' }]} onPress={handleContinueToVerification} testID="signup-verification-continue-btn">
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
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 40,
  },
  headerSection: { 
    alignItems: 'center', 
    marginBottom: 24, 
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  logoContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    overflow: 'hidden',
    marginBottom: 16,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  title: { 
    ...TYPOGRAPHY.title, 
    fontSize: 26, 
    fontWeight: '800', 
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: { 
    ...TYPOGRAPHY.body, 
    textAlign: 'center', 
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  formCard: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5,
    gap: 20,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDA29B',
  },
  errorText: { 
    ...TYPOGRAPHY.body, 
    flex: 1, 
    fontWeight: '600' 
  },
  
  // Premium Inputs styles
  inputContainer: { 
    gap: 6,
    width: '100%',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    paddingLeft: 4,
  },
  inputRow: {
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  inputRowFocused: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 1,
  },
  inputRowDisabled: {
    opacity: 0.65,
  },
  leftIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 0,
  },
  inputErrorText: {
    fontSize: 12,
    fontWeight: '600',
    paddingLeft: 4,
    marginTop: 2,
  },
  confirmMessageText: {
    fontSize: 12,
    fontWeight: '600',
    paddingLeft: 4,
    marginTop: 4,
  },
  helperText: {
    fontSize: 12,
    fontWeight: '500',
    paddingLeft: 4,
    marginTop: -14,
  },

  // Country prefix selector
  prefixContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    gap: 6,
  },
  flagText: {
    fontSize: 18,
  },
  codeText: {
    fontSize: 15,
    fontWeight: '600',
  },
  dividerLine: {
    width: 1,
    height: 20,
    marginLeft: 6,
  },

  // Show/Hide Password Eye Button
  eyeBtn: {
    height: '100%',
    justifyContent: 'center',
    paddingLeft: 8,
  },

  // Password Requirements checklists
  strengthContainer: {
    padding: 12,
    borderRadius: 12,
    marginTop: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  strengthTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requirementText: {
    fontSize: 12,
    fontWeight: '500',
  },
  requirementActive: {
    color: '#10B981',
    fontWeight: '600',
  },

  // Segmented Control
  segmentedContainer: {
    height: 52,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    padding: 4,
  },
  segmentedActiveBg: {
    position: 'absolute',
    left: 4,
    height: '84%',
    borderRadius: 8,
  },
  segmentedOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    zIndex: 2,
  },
  segmentedText: {
    fontSize: 14,
    fontWeight: '700',
  },

  // Consent checkbox
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    width: '100%',
    paddingHorizontal: 4,
  },
  checkboxTouch: {
    paddingVertical: 2,
    minHeight: 48,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -10,
  },
  consentLabel: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  hyperlink: {
    fontWeight: '700',
    textDecorationLine: 'underline',
  },

  // Submit button
  primaryBtn: {
    borderRadius: 12,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 8,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  loaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loaderText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  loaderSubtext: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    marginTop: -8,
  },

  // Footer & Help
  footerRow: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    marginTop: 24,
    alignItems: 'center',
  },
  footerText: { 
    ...TYPOGRAPHY.body,
  },
  footerLink: { 
    ...TYPOGRAPHY.label, 
    fontWeight: '700',
  },
  helpBtn: { 
    alignSelf: 'center', 
    marginTop: 20, 
    paddingHorizontal: 20, 
    paddingVertical: 12, 
    borderRadius: 24, 
    minHeight: 48,
    justifyContent: 'center',
  },
  helpBtnText: { 
    ...TYPOGRAPHY.label, 
    fontWeight: '700',
  },

  // Success Modal
  modalBackdrop: { 
    flex: 1, 
    backgroundColor: 'rgba(0, 0, 0, 0.42)', 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 20,
  },
  modalCard: { 
    width: '100%', 
    maxWidth: 420, 
    borderRadius: 24, 
    padding: 24, 
    alignItems: 'center', 
    gap: 16, 
    borderWidth: 1, 
  },
  modalIconCircle: { 
    width: 64, 
    height: 64, 
    borderRadius: 32, 
    alignItems: 'center', 
    justifyContent: 'center',
    marginBottom: 8,
  },
  modalTitle: { 
    ...TYPOGRAPHY.heading, 
    fontSize: 22,
    textAlign: 'center', 
    fontWeight: '800',
  },
  modalMessage: { 
    ...TYPOGRAPHY.body, 
    textAlign: 'center', 
    lineHeight: 20,
  },
  modalBulletBox: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 8,
    marginVertical: 4,
  },
  modalBulletText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  modalButton: { 
    borderRadius: 12, 
    minHeight: 52, 
    width: '100%', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginTop: 8,
  },
  modalButtonText: { 
    color: '#FFFFFF', 
    fontSize: 16, 
    fontWeight: '700',
  },
});
