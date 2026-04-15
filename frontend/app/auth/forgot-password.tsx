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

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) { setError('Please enter your email'); return; }
    setLoading(true); setError(''); setSuccess(false);
    const err = await resetPassword(email.trim());
    setLoading(false);
    if (err) { setError(err); } else { setSuccess(true); }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + 30 }]} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.backRow} onPress={() => router.back()} testID="forgot-back-btn">
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
            <Text style={styles.backText}>Back to Sign In</Text>
          </TouchableOpacity>

          <View style={styles.headerSection}>
            <View style={styles.iconCircle}>
              <Ionicons name="key-outline" size={32} color={COLORS.secondary} />
            </View>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>Enter your email and we'll send you a link to reset your password</Text>
          </View>

          <View style={styles.formCard}>
            {error ? (
              <View style={styles.errorBox} testID="forgot-error">
                <Ionicons name="alert-circle" size={18} color={COLORS.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {success ? (
              <View style={styles.successBox} testID="forgot-success">
                <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
                <Text style={styles.successText}>
                  Password reset email sent! Check your inbox and follow the instructions.
                </Text>
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputRow}>
                <Ionicons name="mail-outline" size={20} color={COLORS.textMuted} />
                <TextInput
                  style={styles.input} placeholder="Enter your email" placeholderTextColor={COLORS.border}
                  value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
                  testID="forgot-email-input"
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.btnDisabled]}
              onPress={handleReset} disabled={loading} testID="forgot-submit-btn"
            >
              {loading ? <ActivityIndicator color="#FFF" /> : (
                <Text style={styles.primaryBtnText}>Send Reset Link</Text>
              )}
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
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.lg },
  backText: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  headerSection: { alignItems: 'center', marginBottom: SPACING.xl },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(212,175,55,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '800', color: '#FFFFFF' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 6, lineHeight: 22 },
  formCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.lg, gap: SPACING.md },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF2F2', padding: 12, borderRadius: RADIUS.lg },
  errorText: { fontSize: 13, color: COLORS.error, fontWeight: '500', flex: 1 },
  successBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#F0FDF4', padding: 12, borderRadius: RADIUS.lg },
  successText: { fontSize: 13, color: COLORS.success, fontWeight: '500', flex: 1, lineHeight: 20 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textMain },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.lg, paddingHorizontal: 14, borderWidth: 1, borderColor: COLORS.border },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: COLORS.textMain },
  primaryBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
