import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ActivityIndicator, Alert, ScrollView, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import {
  getVerificationFunnelRecord,
  markPendingScreenOpened,
  markPendingSignout,
  markVerificationEmailResent,
  markVerificationStatus,
  trackEmailVerificationError,
} from '@/lib/emailVerificationAnalytics';

export default function PendingScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const { user, signOut, refreshProfile, resendVerification, refreshUser, profile, emailVerified } = useAuth();
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCount, setResendCount] = useState(0);
  const [lastEmailSentAt, setLastEmailSentAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const pendingOpenTrackedRef = useRef(false);

  const isDeactivated = profile?.status === 'deactivated';
  const isRejected = profile?.status === 'rejected';
  const needsVerification = !emailVerified && profile?.role !== 'admin';
  const cooldownRemainingSeconds = useMemo(() => {
    if (!lastEmailSentAt) return 0;
    return Math.max(0, Math.ceil((60000 - (nowMs - lastEmailSentAt)) / 1000));
  }, [lastEmailSentAt, nowMs]);
  const resendDisabled = resending || cooldownRemainingSeconds > 0;
  const lastEmailSentLabel = lastEmailSentAt ? new Date(lastEmailSentAt).toLocaleString() : 'Not available yet';

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    let mounted = true;
    getVerificationFunnelRecord(user.uid).then((record) => {
      if (!mounted || !record) return;
      setResendCount(record.resendCount || 0);
      setLastEmailSentAt(record.lastEmailSentAt || null);
    }).catch(() => {});
    return () => { mounted = false; };
  }, [user?.uid]);

  useEffect(() => {
    if (!needsVerification || !user?.uid || pendingOpenTrackedRef.current) return;
    pendingOpenTrackedRef.current = true;
    void markPendingScreenOpened(user.uid, resendCount);
  }, [needsVerification, resendCount, user?.uid]);

  useEffect(() => {
    if (!user?.uid || !emailVerified) return;
    void markVerificationStatus(user.uid, true, resendCount);
  }, [emailVerified, resendCount, user?.uid]);

  const handleCheck = async () => {
    setChecking(true);
    const uid = user?.uid || '';
    const startedAt = Date.now();
    try {
      const latestVerified = await Promise.race([
        (async () => {
          const verified = await refreshUser();
          await refreshProfile();
          return verified;
        })(),
        new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('Verification status check timed out')), 10000)),
      ]);
      if (Date.now() - startedAt >= 10000) {
        trackEmailVerificationError('verification_timeout', new Error('Verification status check exceeded timeout'), { uid });
      }
      void markVerificationStatus(uid, Boolean(latestVerified), resendCount);
    } catch (error) {
      trackEmailVerificationError('verification_timeout', error, { uid });
      Alert.alert('Still Checking', 'We could not refresh your verification status. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  const handleResendVerification = async () => {
    if (resendDisabled) return;
    setResending(true);
    const err = await resendVerification();
    setResending(false);
    if (err) {
      trackEmailVerificationError('verification_email_send_failed', new Error(err), { uid: user?.uid || '', resend_count: resendCount });
      Alert.alert('Error', err);
    } else {
      const nextCount = resendCount + 1;
      const sentAt = Date.now();
      setResendCount(nextCount);
      setLastEmailSentAt(sentAt);
      void markVerificationEmailResent(user?.uid || '', nextCount);
      Alert.alert('Email Sent', 'Verification email sent. Please check your inbox, Spam/Junk, Promotions, and Updates folders.');
    }
  };

  const handlePendingSignOut = async () => {
    if (user?.uid) void markPendingSignout(user.uid, resendCount);
    await signOut();
  };

  // Deactivated state
  if (isDeactivated || isRejected) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <View style={styles.content}>
          <View style={[styles.iconCircle, { backgroundColor: '#FEF2F2' }]}>
            <Ionicons name="close-circle-outline" size={48} color={COLORS.error} />
          </View>
          <Text style={styles.title}>{isRejected ? 'Account Rejected' : 'Account Deactivated'}</Text>
          <Text style={styles.subtitle}>
            {isRejected
              ? `Your signup request was rejected by an administrator.${'\n'}Please contact support for details.`
              : `Your account has been deactivated by an administrator.${'\n'}Please contact support for assistance.`}
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
    <View style={[styles.container, isDarkMode && styles.containerDark, { paddingTop: insets.top }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Email Verification Section */}
        {needsVerification ? (
          <>
            <View style={[styles.iconCircle, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="mail-unread-outline" size={48} color="#92400E" />
            </View>
            <Text style={[styles.title, isDarkMode && styles.titleDark]}>Verify Your Email</Text>
            <Text style={[styles.subtitle, isDarkMode && styles.subtitleDark]}>
              We sent a verification email to your inbox.{'\n'}Please verify your email to continue.
            </Text>
            <View style={[styles.deliveryInfoBox, isDarkMode && styles.deliveryInfoBoxDark]} testID="verification-delivery-guidance">
              <Ionicons name="information-circle-outline" size={20} color={isDarkMode ? COLORS.secondary : COLORS.primary} />
              <Text style={[styles.deliveryInfoText, isDarkMode && styles.deliveryInfoTextDark]}>
                Verification email may take a few minutes to arrive. Please check your Inbox, Spam/Junk, Promotions, and Updates folders.
              </Text>
            </View>
            <Text style={[styles.resendHelperText, isDarkMode && styles.resendHelperTextDark]}>
              Didn{'\''}t receive the email? Check Spam/Junk first, then try resending.
            </Text>
            <View style={[styles.resendMetaBox, isDarkMode && styles.resendMetaBoxDark]}>
              <Text style={[styles.resendMetaText, isDarkMode && styles.resendMetaTextDark]}>Last verification email sent: {lastEmailSentLabel}</Text>
              {cooldownRemainingSeconds > 0 ? (
                <Text style={[styles.cooldownText, isDarkMode && styles.cooldownTextDark]}>
                  You can resend again in {cooldownRemainingSeconds} seconds
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              style={[styles.resendBtn, resendDisabled && styles.resendBtnDisabled]}
              onPress={handleResendVerification}
              disabled={resendDisabled}
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
            <Text style={[styles.title, isDarkMode && styles.titleDark]}>Account Pending</Text>
            <Text style={[styles.subtitle, isDarkMode && styles.subtitleDark]}>
              Your account is pending approval.{'\n'}An admin will review your request soon.
            </Text>
          </>
        )}

        {/* Profile Info */}
        {profile && (
          <View style={[styles.infoCard, isDarkMode && styles.infoCardDark]} testID="pending-info">
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isDarkMode && styles.infoLabelDark]}>Name</Text>
              <Text style={[styles.infoValue, isDarkMode && styles.infoValueDark]}>{profile.name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isDarkMode && styles.infoLabelDark]}>Role</Text>
              <Text style={[styles.infoValue, isDarkMode && styles.infoValueDark]}>{profile.role}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isDarkMode && styles.infoLabelDark]}>Email Verified</Text>
              <View style={[styles.statusBadge, emailVerified ? styles.verifiedBadge : styles.unverifiedBadge]}>
                <Text style={[styles.statusBadgeText, emailVerified ? styles.verifiedText : styles.unverifiedText]}>
                  {emailVerified ? 'Verified' : 'Unverified'}
                </Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isDarkMode && styles.infoLabelDark]}>Status</Text>
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

        <TouchableOpacity style={styles.logoutBtn} onPress={handlePendingSignOut} testID="pending-logout-btn">
          <Ionicons name="log-out-outline" size={18} color={COLORS.error} />
          <Text style={styles.logoutBtnText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  containerDark: { backgroundColor: '#071A14' },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg, gap: SPACING.md },
  iconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.goldBg, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.textMain, textAlign: 'center' },
  titleDark: { color: '#F8FAF9' },
  subtitle: { fontSize: 15, color: COLORS.textMuted, textAlign: 'center', lineHeight: 24 },
  subtitleDark: { color: '#C8D7D1' },
  deliveryInfoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.xs, width: '100%', backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md },
  deliveryInfoBoxDark: { backgroundColor: '#102820', borderColor: '#214438' },
  deliveryInfoText: { flex: 1, fontSize: 14, color: COLORS.textMain, lineHeight: 21, fontWeight: '600' },
  deliveryInfoTextDark: { color: '#E3ECE8' },
  resendHelperText: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 19, maxWidth: 340 },
  resendHelperTextDark: { color: '#A9BBB4' },
  resendMetaBox: { width: '100%', alignItems: 'center', gap: 4, marginTop: -4 },
  resendMetaBoxDark: {},
  resendMetaText: { fontSize: 12, color: COLORS.textMuted, textAlign: 'center', lineHeight: 17 },
  resendMetaTextDark: { color: '#A9BBB4' },
  cooldownText: { fontSize: 13, color: COLORS.primary, textAlign: 'center', fontWeight: '700', lineHeight: 18 },
  cooldownTextDark: { color: COLORS.secondary },
  resendBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingHorizontal: 24, paddingVertical: 14, marginTop: 4 },
  resendBtnDisabled: { opacity: 0.55 },
  resendBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.secondary },
  infoCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.lg, width: '100%', gap: SPACING.sm, marginTop: 8, borderWidth: 1, borderColor: COLORS.border },
  infoCardDark: { backgroundColor: '#102820', borderColor: '#214438' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { fontSize: 14, color: COLORS.textMuted, fontWeight: '500' },
  infoLabelDark: { color: '#A9BBB4' },
  infoValue: { fontSize: 14, fontWeight: '600', color: COLORS.textMain, textTransform: 'capitalize' },
  infoValueDark: { color: '#F8FAF9' },
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
