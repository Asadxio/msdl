import React, { useState } from 'react';
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

export default function SignupScreen() {
  const insets = useSafeAreaInsets();
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
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + SPACING.md }]} keyboardShouldPersistTaps="handled">
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

              <AppInput label="Full Name" leftIcon="person-outline" placeholder="Enter your name" value={name} onChangeText={setName} testID="signup-name-input" />
              <AppInput label="Email" leftIcon="mail-outline" placeholder="Enter your email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" testID="signup-email-input" />

              <View>
                <AppInput label="Password" leftIcon="lock-closed-outline" placeholder="Min 6 characters" value={password} onChangeText={setPassword} secureTextEntry={!showPass} testID="signup-password-input" />
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

              <AppInput label="Referral Code (optional)" leftIcon="gift-outline" placeholder="Enter referral code" value={referralCode} onChangeText={setReferralCode} autoCapitalize="characters" />

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  body: { flexGrow: 1, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg },
  headerSection: { marginBottom: SPACING.md },
  title: { ...TYPOGRAPHY.title, color: COLORS.text },
  subtitle: { ...TYPOGRAPHY.body, color: COLORS.textMuted, marginTop: SPACING.xs },
  formCard: { gap: SPACING.md },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, backgroundColor: '#FEE4E2', padding: SPACING.sm, borderRadius: RADIUS.md },
  errorText: { ...TYPOGRAPHY.body, color: COLORS.error, flex: 1 },
  eyeBtn: { position: 'absolute', right: SPACING.sm, top: 34, height: 40, justifyContent: 'center' },
  field: { gap: SPACING.xs },
  label: { ...TYPOGRAPHY.label, color: COLORS.text },
  roleRow: { flexDirection: 'row', gap: SPACING.sm },
  roleBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.background },
  roleBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  roleBtnText: { ...TYPOGRAPHY.label, color: COLORS.textMuted },
  roleBtnTextActive: { color: '#FFFFFF' },
  primaryBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.md },
  footerText: { ...TYPOGRAPHY.body, color: COLORS.textMuted },
  footerLink: { ...TYPOGRAPHY.label, color: COLORS.primary },
});
