import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

export default function PendingScreen() {
  const insets = useSafeAreaInsets();
  const { signOut, refreshProfile, resendVerification, refreshUser, profile, emailVerified } = useAuth();
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);

  const isDeactivated = profile?.status === 'deactivated';
  const needsVerification = !emailVerified && profile?.role !== 'admin';
  const isPending = profile?.status === 'pending' && !isDeactivated;

  const handleCheck = async () => {
    setChecking(true);
    await refreshUser();
    await refreshProfile();
    setChecking(false);
  };

  const handleResendVerification = async () => {
    setResending(true);
    const err = await resendVerification();
    setResending(false);
    if (err) {
      Alert.alert('Error', err);
    } else {
      Alert.alert('Email Sent', 'Verification email sent. Please check your inbox.');
    }
  };

  // Deactivated state
  if (isDeactivated) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.content}>
          <View style={[styles.iconCircle, { backgroundColor: '#FEF2F2' }]}>
            <Ionicons name="close-circle-outline" size={48} color={COLORS.error} />
          </View>
          <Text style={styles.title}>Account Deactivated</Text>
          <Text style={styles.subtitle}>
            Your account has been deactivated by an administrator.{'\n'}Please contact support for assistance.
          </Text>
          <TouchableOpacity style={styles.logoutBtn} onPress={signOut} testID="deactivated-logout-btn">
            <Ionicons name="log-out-outline" size={18} color={COLORS.error} />
            <Text style={styles.logoutBtnText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.content}>
        {/* Email Verification Section */}
        {needsVerification ? (
          <>
            <View style={[styles.iconCircle, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="mail-unread-outline" size={48} color="#92400E" />
            </View>
            <Text style={styles.title}>Verify Your Email</Text>
            <Text style={styles.subtitle}>
              We sent a verification email to your inbox.{'\n'}Please verify your email to continue.
            </Text>
            <TouchableOpacity
              style={styles.resendBtn}
              onPress={handleResendVerification}
              disabled={resending}
              testID="resend-verification-btn"
            >
              {resending ? <ActivityIndicator size="small" color={COLORS.secondary} /> : (
                <Ionicons name="mail-outline" size={18} color={COLORS.secondary} />
              )}
              <Text style={styles.resendBtnText}>
                {resending ? 'Sending...' : 'Resend Verification Email'}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.iconCircle}>
              <Ionicons name="hourglass-outline" size={48} color={COLORS.secondary} />
            </View>
            <Text style={styles.title}>Account Pending</Text>
            <Text style={styles.subtitle}>
              Your account is pending approval.{'\n'}An admin will review your request soon.
            </Text>
          </>
        )}

        {/* Profile Info */}
        {profile && (
          <View style={styles.infoCard} testID="pending-info">
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Name</Text>
              <Text style={styles.infoValue}>{profile.name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Role</Text>
              <Text style={styles.infoValue}>{profile.role}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email Verified</Text>
              <View style={[styles.statusBadge, emailVerified ? styles.verifiedBadge : styles.unverifiedBadge]}>
                <Text style={[styles.statusBadgeText, emailVerified ? styles.verifiedText : styles.unverifiedText]}>
                  {emailVerified ? 'Verified' : 'Unverified'}
                </Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status</Text>
              <View style={[styles.statusBadge, styles.pendingStatusBadge]}>
                <Text style={styles.pendingStatusText}>{profile.status}</Text>
              </View>
            </View>
          </View>
        )}

        <TouchableOpacity style={styles.checkBtn} onPress={handleCheck} disabled={checking} testID="check-status-btn">
          {checking ? <ActivityIndicator size="small" color={COLORS.primary} /> : (
            <>
              <Ionicons name="refresh" size={18} color={COLORS.primary} />
              <Text style={styles.checkBtnText}>Check Status</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={signOut} testID="pending-logout-btn">
          <Ionicons name="log-out-outline" size={18} color={COLORS.error} />
          <Text style={styles.logoutBtnText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg, gap: SPACING.md },
  iconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.goldBg, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.textMain },
  subtitle: { fontSize: 15, color: COLORS.textMuted, textAlign: 'center', lineHeight: 24 },
  resendBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingHorizontal: 24, paddingVertical: 14, marginTop: 4 },
  resendBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.secondary },
  infoCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.lg, width: '100%', gap: SPACING.sm, marginTop: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { fontSize: 14, color: COLORS.textMuted, fontWeight: '500' },
  infoValue: { fontSize: 14, fontWeight: '600', color: COLORS.textMain, textTransform: 'capitalize' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: RADIUS.full },
  verifiedBadge: { backgroundColor: '#D1FAE5' },
  unverifiedBadge: { backgroundColor: '#FEF3C7' },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },
  verifiedText: { color: '#065F46' },
  unverifiedText: { color: '#92400E' },
  pendingStatusBadge: { backgroundColor: '#FEF3C7' },
  pendingStatusText: { fontSize: 12, fontWeight: '700', color: '#92400E', textTransform: 'capitalize' },
  checkBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 2, borderColor: COLORS.primary, borderRadius: RADIUS.lg, paddingHorizontal: 24, paddingVertical: 14, marginTop: 8 },
  checkBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.primary },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  logoutBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.error },
});
