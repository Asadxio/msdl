import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { AppCard, AppInput, FadeInView, ScalePressable } from '@/components/ui';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SignupScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const handleNameChange = useCallback((text: string) => setName(text), []);
  const handleEmailChange = useCallback((text: string) => setEmail(text), []);
  const handlePasswordChange = useCallback((text: string) => setPassword(text), []);
  const handleReferralCodeChange = useCallback((text: string) => setReferralCode(text), []);

  const handleSignup = async () => {
    if (!name.trim() || !email.trim() || !password) { setError('Please fill in all fields'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Please enter a valid email address'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true); setError('');
    const err = await signUp(name.trim(), email.trim(), password, role, referralCode.trim());
    setLoading(false);
    if (err) setError(err);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <FadeInView style={styles.headerSection}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join our learning community</Text>
          </FadeInView>

          <FadeInView delay={60}>
            <AppCard style={styles.formCard}>
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
                <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
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
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.replace('/auth/login')} testID="goto-login-btn">
              <Text style={styles.footerLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  field: { gap: SPACING.xs },
  label: { ...TYPOGRAPHY.label, color: '#6A6A6A', fontSize: 12, fontWeight: '500' },
  roleRow: { flexDirection: 'row', gap: SPACING.sm },
  roleBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: '#E5E5E5', backgroundColor: '#FFFFFF' },
  roleBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  roleBtnText: { ...TYPOGRAPHY.label, color: COLORS.textMuted },
  roleBtnTextActive: { color: '#FFFFFF' },
  primaryBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, minHeight: 54, width: '100%', justifyContent: 'center', alignItems: 'center', marginTop: SPACING.md },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.lg },
  footerText: { ...TYPOGRAPHY.body, color: COLORS.textMuted },
  footerLink: { ...TYPOGRAPHY.label, color: COLORS.primary },
});
