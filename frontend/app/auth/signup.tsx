import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

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
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true); setError('');
    const err = await signUp(name.trim(), email.trim(), password, role, referralCode.trim());
    setLoading(false);
    if (err) setError(err);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + 30 }]} keyboardShouldPersistTaps="handled">
          <View style={styles.headerSection}>
            <Text style={styles.greeting}>بِسْمِ ٱللَّهِ</Text>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join our learning community</Text>
          </View>

          <View style={styles.formCard}>
            {error ? (
              <View style={styles.errorBox} testID="signup-error">
                <Ionicons name="alert-circle" size={18} color={COLORS.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.label}>Full Name</Text>
              <View style={styles.inputRow}>
                <Ionicons name="person-outline" size={20} color={COLORS.textMuted} />
                <TextInput
                  style={styles.input} placeholder="Enter your name" placeholderTextColor={COLORS.border}
                  value={name} onChangeText={setName} testID="signup-name-input"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputRow}>
                <Ionicons name="mail-outline" size={20} color={COLORS.textMuted} />
                <TextInput
                  style={styles.input} placeholder="Enter your email" placeholderTextColor={COLORS.border}
                  value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
                  testID="signup-email-input"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={20} color={COLORS.textMuted} />
                <TextInput
                  style={styles.input} placeholder="Min 6 characters" placeholderTextColor={COLORS.border}
                  value={password} onChangeText={setPassword} secureTextEntry={!showPass}
                  testID="signup-password-input"
                />
                <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                  <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>I am a</Text>
              <View style={styles.roleRow}>
                <TouchableOpacity
                  style={[styles.roleBtn, role === 'student' && styles.roleBtnActive]}
                  onPress={() => setRole('student')} testID="role-student-btn"
                >
                  <Ionicons name="school-outline" size={20} color={role === 'student' ? '#FFF' : COLORS.textMuted} />
                  <Text style={[styles.roleBtnText, role === 'student' && styles.roleBtnTextActive]}>Student</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.roleBtn, role === 'teacher' && styles.roleBtnActive]}
                  onPress={() => setRole('teacher')} testID="role-teacher-btn"
                >
                  <Ionicons name="people-outline" size={20} color={role === 'teacher' ? '#FFF' : COLORS.textMuted} />
                  <Text style={[styles.roleBtnText, role === 'teacher' && styles.roleBtnTextActive]}>Teacher</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Referral Code (optional)</Text>
              <View style={styles.inputRow}>
                <Ionicons name="gift-outline" size={20} color={COLORS.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter referral code"
                  placeholderTextColor={COLORS.border}
                  value={referralCode}
                  onChangeText={setReferralCode}
                  autoCapitalize="characters"
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.btnDisabled]}
              onPress={handleSignup} disabled={loading} testID="signup-submit-btn"
            >
              {loading ? <ActivityIndicator color="#FFF" /> : (
                <Text style={styles.primaryBtnText}>Create Account</Text>
              )}
            </TouchableOpacity>
          </View>

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
  container: { flex: 1, backgroundColor: COLORS.primary },
  body: { flexGrow: 1, paddingHorizontal: SPACING.lg, paddingBottom: 40 },
  headerSection: { alignItems: 'center', marginBottom: SPACING.lg },
  greeting: { fontSize: 24, color: COLORS.secondary, fontWeight: '700', marginBottom: 6 },
  title: { fontSize: 26, fontWeight: '800', color: '#FFFFFF' },
  subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  formCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.lg, gap: SPACING.md },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF2F2', padding: 12, borderRadius: RADIUS.lg },
  errorText: { fontSize: 13, color: COLORS.error, fontWeight: '500', flex: 1 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textMain },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.lg, paddingHorizontal: 14, borderWidth: 1, borderColor: COLORS.border },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: COLORS.textMain },
  roleRow: { flexDirection: 'row', gap: SPACING.sm },
  roleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: RADIUS.lg, borderWidth: 2, borderColor: COLORS.border },
  roleBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  roleBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.textMuted },
  roleBtnTextActive: { color: '#FFFFFF' },
  primaryBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.lg },
  footerText: { fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  footerLink: { fontSize: 14, fontWeight: '700', color: COLORS.secondary },
});
