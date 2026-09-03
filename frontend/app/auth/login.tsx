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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY, getThemeColors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { FadeInView, ScalePressable } from '@/components/ui';
import { WHATSAPP_HELP_URL } from '@/lib/links';

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
  testID?: string;
  onSubmitEditing?: () => void;
  returnKeyType?: 'next' | 'done' | 'go' | 'search' | 'send';
  blurOnSubmit?: boolean;
  autoComplete?: 'email' | 'password' | 'current-password' | 'new-password' | 'username' | 'name' | 'tel' | 'off';
  textContentType?: 'emailAddress' | 'password' | 'name' | 'telephoneNumber' | 'none';
};

const PremiumInput = React.forwardRef<TextInput, PremiumInputProps>(function PremiumInput({
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
  testID,
  onSubmitEditing,
  returnKeyType,
  blurOnSubmit,
  autoComplete = 'off',
  textContentType = 'none',
}: PremiumInputProps, ref) {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const colors = getThemeColors(isDarkMode);
  const [isFocused, setIsFocused] = useState(false);

  const activeBorderColor = error 
    ? colors.error 
    : isFocused 
      ? '#005F46' 
      : (isDarkMode ? '#2E3D5C' : '#E2E8E5');

  const activeBgColor = isDarkMode 
    ? (isFocused ? '#132C23' : '#102820') 
    : (isFocused ? '#FFFFFF' : '#FAFCFB');

  const labelColor = error 
    ? colors.error 
    : isFocused 
      ? (isDarkMode ? '#10B981' : '#005F46') 
      : colors.textMuted;

  return (
    <View style={styles.inputContainer} collapsable={false}>
      <Text style={[styles.inputLabel, { color: labelColor }]}>
        {label}
      </Text>
      <View 
        collapsable={false}
        style={[
          styles.inputRow,
          { 
            borderColor: activeBorderColor, 
            backgroundColor: activeBgColor,
            shadowColor: isFocused ? '#005F46' : 'transparent',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: isFocused ? 0.06 : 0,
            shadowRadius: 4,
          },
          disabled && styles.inputRowDisabled
        ]}
      >
        <Ionicons 
          name={leftIcon} 
          size={20} 
          color={error ? colors.error : (isFocused ? (isDarkMode ? '#10B981' : '#005F46') : colors.textMuted)} 
          style={styles.leftIcon} 
        />
        <TextInput
          ref={ref}
          collapsable={false}
          style={[styles.textInput, { color: colors.text }]}
          placeholder={placeholder}
          placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          autoComplete={autoComplete}
          textContentType={textContentType}
          importantForAutofill={autoComplete !== 'off' ? 'yes' : 'no'}
          spellCheck={false}
          editable={!disabled}
          returnKeyType={returnKeyType ?? (secureTextEntry ? 'done' : 'next')}
          blurOnSubmit={blurOnSubmit ?? !!secureTextEntry}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
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

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const colors = getThemeColors(isDarkMode);
  const { signIn } = useAuth();

  // Field refs for focus chain (prevents autofill jump)
  const passwordRef = useRef<TextInput>(null);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // UI State
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Email & Password Validation derived cleanly without cascading useEffect renders
  const emailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()), [email]);
  const emailError = useMemo(() => {
    if (!submitted || email.length === 0 || emailValid) return '';
    return 'Please enter a valid email address';
  }, [submitted, email, emailValid]);

  const passwordError = useMemo(() => {
    if (!submitted || password.length === 0 || password.length >= 6) return '';
    return 'Password must be at least 6 characters';
  }, [submitted, password]);

  // Determine if form is ready to submit
  const formIsValid = useMemo(() => {
    return emailValid && password.length >= 6 && !loading;
  }, [emailValid, password, loading]);

  const handleLogin = async () => {
    setSubmitted(true);
    if (!formIsValid || loading) return;

    setLoading(true);
    setError('');
    try {
      const err = await signIn(email.trim(), password);
      if (err) setError(err);
    } catch (e: any) {
      setError(e?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
          removeClippedSubviews={false}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Section */}
          <FadeInView style={styles.headerSection}>
            <View style={styles.emblemAura}>
              <View style={styles.logoContainer}>
                <Image 
                  source={require('../../assets/images/emblem_pure.png')} 
                  style={styles.logoImage} 
                  resizeMode="contain" 
                />
              </View>
            </View>
            <Text style={styles.bismillahHeader}>بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْم</Text>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Welcome Back</Text>
            <Text style={styles.institutionArabic}>مَدْرَسَةُ السَّالِكَاتِ لِلْبَنَات</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              Sign in to continue your sacred learning journey
            </Text>
          </FadeInView>

          {/* Premium Login Card */}
          <FadeInView delay={60}>
            <View style={[styles.formCard, { backgroundColor: isDarkMode ? '#102820' : '#FFFFFF', borderColor: colors.border }]}>
              
              {/* Premium Inline Error Card */}
              {error ? (
                <View style={[styles.errorBox, { backgroundColor: isDarkMode ? '#2D0A0A' : '#FEE4E2' }]} testID="login-error">
                  <Ionicons name="alert-circle" size={18} color={COLORS.error} />
                  <Text style={[styles.errorText, { color: COLORS.error }]}>{error}</Text>
                </View>
              ) : null}

              {/* 1. Email Address Input */}
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
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => passwordRef.current?.focus()}
                testID="login-email-input"
              />

              {/* 2. Password Input */}
              <View style={styles.passwordFieldContainer}>
                <PremiumInput
                  ref={passwordRef}
                  label="Password"
                  leftIcon="lock-closed-outline"
                  placeholder="Enter your password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                  disabled={loading}
                  success={password.length >= 6}
                  error={passwordError}
                  autoCapitalize="none"
                  autoComplete="password"
                  textContentType="password"
                  returnKeyType="done"
                  blurOnSubmit={true}
                  onSubmitEditing={handleLogin}
                  rightElement={
                    <TouchableOpacity 
                      onPress={() => setShowPass(v => !v)} 
                      style={styles.eyeBtn} 
                      accessibilityLabel={showPass ? 'Hide password' : 'Show password'}
                      accessibilityRole="button"
                      focusable={false}
                    >
                      <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                  }
                  testID="login-password-input"
                />

                {/* Forgot Password Right-Aligned Layout */}
                <TouchableOpacity
                  style={styles.forgotRow}
                  onPress={() => router.push('/auth/forgot-password')}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel="Forgot Password"
                  testID="forgot-password-btn"
                >
                  <Text style={[styles.forgotText, { color: isDarkMode ? '#10B981' : '#005F46' }]}>
                    Forgot Password?
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Primary Action Button (Sign In) */}
              <ScalePressable 
                style={[
                  styles.primaryBtn, 
                  { 
                    backgroundColor: formIsValid 
                      ? (isDarkMode ? '#005F46' : '#005F46') 
                      : (isDarkMode ? '#1B3B32' : '#85B5A8'),
                    shadowColor: formIsValid ? '#005F46' : 'transparent',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: formIsValid ? 0.35 : 0,
                    shadowRadius: 12,
                    elevation: formIsValid ? 5 : 0,
                  },
                  !formIsValid && styles.btnDisabled
                ]} 
                onPress={() => {
                  try { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
                  handleLogin();
                }} 
                disabled={!formIsValid || loading} 
                testID="login-submit-btn"
              >
                {loading ? (
                  <View style={styles.loaderContainer}>
                    <ActivityIndicator color="#FFFFFF" size="small" />
                    <Text style={styles.loaderText}>Signing you in...</Text>
                  </View>
                ) : (
                  <View style={styles.primaryBtnInnerRow}>
                    <Text style={styles.primaryBtnText}>Sign In</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
                  </View>
                )}
              </ScalePressable>

              {loading && (
                <Text style={[styles.loaderSubtext, { color: colors.textMuted }]}>
                  Please wait...
                </Text>
              )}

            </View>
          </FadeInView>

          {/* Secondary Actions */}
          <View style={styles.footerRow}>
            <Text style={[styles.footerText, { color: colors.textMuted }]}>Don&apos;t have an account? </Text>
            <TouchableOpacity onPress={() => router.replace('/auth/signup')} testID="goto-signup-btn">
              <Text style={[styles.footerLink, { color: isDarkMode ? '#10B981' : '#005F46' }]}>Sign Up</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity
            style={[
              styles.helpBtn, 
              { 
                backgroundColor: isDarkMode ? '#132C23' : '#F0FDF4',
                borderColor: isDarkMode ? '#1E4D3A' : '#BBF7D0',
                borderWidth: 1,
              }
            ]}
            onPress={async () => {
              try { void Haptics.selectionAsync(); } catch {}
              const phone = '916366919122';
              const text = 'Salam. I am interested in Madrasa Tus Salikat Lil Banat. I need assistance signing in.';
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
            <View style={styles.helpBtnInner}>
              <Ionicons name="logo-whatsapp" size={17} color="#25D366" style={{ marginRight: 8 }} />
              <Text style={[styles.helpBtnText, { color: isDarkMode ? '#34D399' : '#15803D' }]}>
                Need Help? WhatsApp Support
              </Text>
            </View>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
    marginBottom: 20, 
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  emblemAura: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212,175,55,0.08)',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 4,
    marginBottom: 12,
  },
  logoContainer: {
    width: 82,
    height: 82,
    borderRadius: 41,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  bismillahHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#005F46',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 6,
  },
  title: { 
    fontSize: 26, 
    fontWeight: '800', 
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  institutionArabic: {
    fontSize: 16,
    fontWeight: '700',
    color: '#005F46',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: { 
    fontSize: 13.5,
    textAlign: 'center', 
    lineHeight: 19,
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
    // Only border color is updated on focus to prevent Android native elevation focus jump
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
  
  passwordFieldContainer: {
    gap: 8,
    width: '100%',
  },
  forgotRow: { 
    alignSelf: 'flex-end', 
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  forgotText: { 
    fontSize: 13,
    fontWeight: '700',
  },

  // Show/Hide Password Eye Button
  eyeBtn: {
    height: '100%',
    justifyContent: 'center',
    paddingLeft: 8,
  },

  // Submit button
  primaryBtn: {
    borderRadius: 14,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 8,
  },
  primaryBtnInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.65,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: 0.5,
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
    marginTop: 22,
    alignItems: 'center',
  },
  footerText: { 
    ...TYPOGRAPHY.body,
    fontSize: 14,
  },
  footerLink: { 
    ...TYPOGRAPHY.label, 
    fontWeight: '800',
    fontSize: 14,
  },
  helpBtn: { 
    alignSelf: 'center', 
    marginTop: 18, 
    paddingHorizontal: 18, 
    paddingVertical: 10, 
    borderRadius: 20, 
    minHeight: 44,
    justifyContent: 'center',
    shadowColor: '#25D366',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  helpBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpBtnText: { 
    fontSize: 13, 
    fontWeight: '700',
  },
});
