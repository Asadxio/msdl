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
  autoComplete?: 'email' | 'password' | 'off';
  textContentType?: 'emailAddress' | 'password' | 'none';
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
  autoComplete = 'off',
  textContentType = 'none',
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
          autoComplete={autoComplete}
          textContentType={textContentType}
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

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // UI State
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Real-time error messages
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Email Validation
  const emailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()), [email]);
  useEffect(() => {
    if (email.length === 0) {
      setEmailError('');
      return;
    }
    if (!emailValid) {
      setEmailError('Please enter a valid email address');
    } else {
      setEmailError('');
    }
  }, [email, emailValid]);

  // Password Validation
  useEffect(() => {
    if (password.length === 0) {
      setPasswordError('');
      return;
    }
    if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
    } else {
      setPasswordError('');
    }
  }, [password]);

  // Determine if form is ready to submit
  const formIsValid = useMemo(() => {
    return emailValid && password.length >= 6 && !loading;
  }, [emailValid, password, loading]);

  const handleLogin = async () => {
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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Section */}
          <FadeInView style={styles.headerSection}>
            <View style={styles.logoContainer}>
              <Image source={require('../../assets/images/icon.png')} style={styles.logoImage} resizeMode="contain" />
            </View>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Welcome Back</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              Sign in to continue your Islamic learning journey.
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
                autoComplete="email"
                textContentType="emailAddress"
                testID="login-email-input"
              />

              {/* 2. Password Input */}
              <View style={styles.passwordFieldContainer}>
                <PremiumInput
                  label="Password"
                  leftIcon="lock-closed-outline"
                  placeholder="Enter your password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                  disabled={loading}
                  success={password.length >= 6}
                  error={passwordError}
                  autoComplete="password"
                  textContentType="password"
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
                  <Text style={[styles.forgotText, { color: isDarkMode ? '#10B981' : '#0F7660' }]}>
                    Forgot Password?
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Primary Action Button (Sign In) */}
              <ScalePressable 
                style={[
                  styles.primaryBtn, 
                  { backgroundColor: isDarkMode ? '#10B981' : '#0F7660' },
                  !formIsValid && styles.btnDisabled
                ]} 
                onPress={handleLogin} 
                disabled={!formIsValid || loading} 
                testID="login-submit-btn"
              >
                {loading ? (
                  <View style={styles.loaderContainer}>
                    <ActivityIndicator color="#FFFFFF" size="small" />
                    <Text style={styles.loaderText}>Signing you in...</Text>
                  </View>
                ) : (
                  <Text style={styles.primaryBtnText}>Sign In</Text>
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
            <Text style={[styles.footerText, { color: colors.textMuted }]}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.replace('/auth/signup')} testID="goto-signup-btn">
              <Text style={[styles.footerLink, { color: isDarkMode ? '#10B981' : '#0F7660' }]}>Sign Up</Text>
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
    minHeight: 56,
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
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 14,
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
});
