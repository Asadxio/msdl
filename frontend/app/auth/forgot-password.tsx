import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, StatusBar, Image, useColorScheme, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { goBackOrReplace } from '@/lib/navigation';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY, getThemeColors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { FadeInView, ScalePressable } from '@/components/ui';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { resetPassword } = useAuth();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const colors = getThemeColors(isDarkMode);

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const handleEmailChange = useCallback((text: string) => {
    setEmail(text);
    if (error) setError('');
  }, [error]);

  const handleReset = async () => {
    const trimmed = email.trim();
    if (!trimmed) { setError('Please enter your email address'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setError('Please enter a valid email address'); return; }
    
    try { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    setLoading(true); 
    setError(''); 
    setSuccess(false);
    
    const err = await resetPassword(trimmed);
    setLoading(false);
    if (err) { 
      setError(err); 
    } else { 
      try { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      setSuccess(true); 
    }
  };

  const isFormValid = email.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" removeClippedSubviews={false} showsVerticalScrollIndicator={false}>
          
          <TouchableOpacity 
            style={styles.backRow} 
            onPress={() => {
              try { void Haptics.selectionAsync(); } catch {}
              goBackOrReplace(router, '/auth/login');
            }} 
            testID="forgot-back-btn"
          >
            <Ionicons name="arrow-back" size={20} color={isDarkMode ? '#10B981' : '#005F46'} />
            <Text style={[styles.backText, { color: isDarkMode ? '#10B981' : '#005F46' }]}>Back to Sign In</Text>
          </TouchableOpacity>

          {/* Institutional Header */}
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
            <Text style={[styles.title, { color: colors.text }]}>Reset Password</Text>
            <Text style={styles.institutionArabic}>مَدْرَسَةُ السَّالِكَاتِ لِلْبَنَات</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              Enter your registered email to receive an official recovery link.
            </Text>
          </FadeInView>

          <FadeInView delay={60} style={{ width: '100%', maxWidth: 480, alignSelf: 'center' }}>
            <View style={[styles.formCard, { backgroundColor: isDarkMode ? '#102820' : '#FFFFFF', borderColor: colors.border }]}>
              {error ? (
                <View style={[styles.errorBox, { backgroundColor: isDarkMode ? '#2D0A0A' : '#FEE4E2' }]} testID="forgot-error">
                  <Ionicons name="alert-circle" size={18} color={COLORS.error} />
                  <Text style={[styles.errorText, { color: COLORS.error }]}>{error}</Text>
                </View>
              ) : null}

              {success ? (
                <View style={[styles.successBox, { backgroundColor: isDarkMode ? '#132C23' : '#F0FDF4', borderColor: isDarkMode ? '#1E4D3A' : '#BBF7D0' }]} testID="forgot-success">
                  <Ionicons name="checkmark-circle" size={20} color={isDarkMode ? '#34D399' : '#15803D'} />
                  <Text style={[styles.successText, { color: isDarkMode ? '#34D399' : '#15803D' }]}>
                    Official password reset instructions have been sent to your email. Please check your inbox.
                  </Text>
                </View>
              ) : null}

              {/* Email Input Field with Focus Glow */}
              <View style={styles.inputContainer} collapsable={false}>
                <Text style={[
                  styles.inputLabel,
                  { color: error ? colors.error : isFocused ? (isDarkMode ? '#10B981' : '#005F46') : colors.textMuted }
                ]}>
                  Email Address
                </Text>
                <View 
                  collapsable={false}
                  style={[
                    styles.inputRow,
                    {
                      borderColor: error ? colors.error : isFocused ? '#005F46' : (isDarkMode ? '#2E3D5C' : '#E2E8E5'),
                      backgroundColor: isDarkMode ? (isFocused ? '#132C23' : '#102820') : (isFocused ? '#FFFFFF' : '#FAFCFB'),
                      shadowColor: isFocused ? '#005F46' : 'transparent',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: isFocused ? 0.06 : 0,
                      shadowRadius: 4,
                    }
                  ]}
                >
                  <Ionicons 
                    name="mail-outline" 
                    size={20} 
                    color={error ? colors.error : isFocused ? (isDarkMode ? '#10B981' : '#005F46') : colors.textMuted} 
                    style={styles.leftIcon} 
                  />
                  <TextInput
                    collapsable={false}
                    style={[styles.textInput, { color: colors.text }]}
                    placeholder="Enter your registered email"
                    placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
                    value={email}
                    onChangeText={handleEmailChange}
                    autoCapitalize="none"
                    autoCorrect={false}
                    spellCheck={false}
                    keyboardType="email-address"
                    autoComplete="email"
                    textContentType="emailAddress"
                    importantForAutofill="yes"
                    returnKeyType="done"
                    blurOnSubmit={true}
                    onSubmitEditing={() => {}}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    editable={!loading}
                    testID="forgot-email-input"
                    accessibilityLabel="Email Address"
                  />
                </View>
              </View>

              <ScalePressable 
                style={[
                  styles.primaryBtn, 
                  { 
                    backgroundColor: isFormValid 
                      ? '#005F46' 
                      : (isDarkMode ? '#1B3B32' : '#85B5A8'),
                    shadowColor: isFormValid ? '#005F46' : 'transparent',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: isFormValid ? 0.35 : 0,
                    shadowRadius: 12,
                    elevation: isFormValid ? 5 : 0,
                  },
                  (!isFormValid || loading) && styles.btnDisabled
                ]} 
                onPress={handleReset} 
                disabled={!isFormValid || loading} 
                testID="forgot-submit-btn"
              >
                {loading ? (
                  <View style={styles.loaderContainer}>
                    <ActivityIndicator color="#FFFFFF" size="small" />
                    <Text style={styles.loaderText}>Sending Recovery Link...</Text>
                  </View>
                ) : (
                  <View style={styles.primaryBtnInnerRow}>
                    <Text style={styles.primaryBtnText}>Send Reset Link</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
                  </View>
                )}
              </ScalePressable>
            </View>
          </FadeInView>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { 
    flexGrow: 1, 
    paddingHorizontal: 20, 
    paddingTop: 16,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  backRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    alignSelf: 'flex-start',
    marginBottom: 20,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  backText: { 
    fontSize: 14,
    fontWeight: '700',
  },
  headerSection: { 
    alignItems: 'center', 
    marginBottom: 20, 
    width: '100%',
    maxWidth: 480,
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
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#005F46',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 4,
    gap: 18,
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
    fontSize: 13, 
    fontWeight: '600',
    flex: 1,
  },
  successBox: { 
    flexDirection: 'row', 
    alignItems: 'flex-start', 
    gap: 10, 
    padding: 14, 
    borderRadius: 14,
    borderWidth: 1,
  },
  successText: { 
    fontSize: 13.5, 
    fontWeight: '600',
    lineHeight: 19,
    flex: 1,
  },
  inputContainer: { 
    gap: 6,
    width: '100%',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
    paddingLeft: 4,
  },
  inputRow: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
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
  primaryBtn: {
    borderRadius: 14,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 4,
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
});

