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

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) { setError('Please fill in all fields'); return; }
    setLoading(true); setError('');
    const err = await signIn(email.trim(), password);
    setLoading(false);
    if (err) setError(err);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + 40 }]} keyboardShouldPersistTaps="handled">
          <View style={styles.headerSection}>
            <Text style={styles.greeting}>السلام عليكم</Text>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to continue learning</Text>
          </View>

          <View style={styles.formCard}>
            {error ? (
              <View style={styles.errorBox} testID="login-error">
                <Ionicons name="alert-circle" size={18} color={COLORS.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputRow}>
                <Ionicons name="mail-outline" size={20} color={COLORS.textMuted} />
                <TextInput
                  style={styles.input} placeholder="Enter your email" placeholderTextColor={COLORS.border}
                  value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
                  testID="login-email-input"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={20} color={COLORS.textMuted} />
                <TextInput
                  style={styles.input} placeholder="Enter your password" placeholderTextColor={COLORS.border}
                  value={password} onChangeText={setPassword} secureTextEntry={!showPass}
                  testID="login-password-input"
                />
                <TouchableOpacity onPress={() => setShowPass(!showPass)} testID="toggle-password">
                  <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.forgotRow}
              onPress={() => router.push('/auth/forgot-password')}
              testID="forgot-password-btn"
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.btnDisabled]}
              onPress={handleLogin} disabled={loading} testID="login-submit-btn"
            >
              {loading ? <ActivityIndicator color="#FFF" /> : (
                <Text style={styles.primaryBtnText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Don't have an account? </Text>
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
  container: { flex: 1, backgroundColor: COLORS.primary },
  body: { flexGrow: 1, paddingHorizontal: SPACING.lg, paddingBottom: 40 },
  headerSection: { alignItems: 'center', marginBottom: SPACING.xl },
  greeting: { fontSize: 28, color: COLORS.secondary, fontWeight: '700', marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '800', color: '#FFFFFF' },
  subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  formCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.lg, gap: SPACING.md },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF2F2', padding: 12, borderRadius: RADIUS.lg },
  errorText: { fontSize: 13, color: COLORS.error, fontWeight: '500', flex: 1 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textMain },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.lg, paddingHorizontal: 14, borderWidth: 1, borderColor: COLORS.border },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: COLORS.textMain },
  primaryBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  forgotRow: { alignSelf: 'flex-end', marginTop: -4, marginBottom: 4 },
  forgotText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.lg },
  footerText: { fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  footerLink: { fontSize: 14, fontWeight: '700', color: COLORS.secondary },
});
