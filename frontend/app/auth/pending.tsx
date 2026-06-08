import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { sendEmailVerification } from 'firebase/auth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { auth } from '@/lib/firebase';
import { normalizeFirebaseError, withTimeout } from '@/lib/errors';
import { logger } from '@/lib/logger';

const VERIFICATION_POLL_MS = 15000;
const FIREBASE_AUTH_ACTION_TIMEOUT_MS = 15000;

type MessageState = { type: 'success' | 'error' | 'info'; text: string } | null;

export default function PendingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut, refreshProfile, refreshUser, profile } = useAuth();
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [freshEmailVerified, setFreshEmailVerified] = useState(Boolean(auth.currentUser?.emailVerified));
  const [message, setMessage] = useState<MessageState>(null);
  const mountedRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigationTriggeredRef = useRef(false);
  const refreshProfileRef = useRef(refreshProfile);
  const refreshUserRef = useRef(refreshUser);
  const verificationCheckInFlightRef = useRef(false);
  const authActionVersionRef = useRef(0);

  useEffect(() => {
    refreshProfileRef.current = refreshProfile;
    refreshUserRef.current = refreshUser;
  }, [refreshProfile, refreshUser]);

  const isSuspended = profile?.status === 'deactivated' || profile?.status === 'suspended';
  const isRejected = profile?.status === 'rejected';
  const displayEmailVerified = freshEmailVerified;
  const needsVerification = !displayEmailVerified && profile?.role !== 'admin';
  const displayStatus = displayEmailVerified ? 'active' : profile?.status;
  const busy = checking || resending || signingOut;

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const navigateAfterVerified = useCallback(async () => {
    if (navigationTriggeredRef.current) return;
    navigationTriggeredRef.current = true;
    stopPolling();
    logger.info('Navigation triggered', { reason: 'email-verified', route: '/' });
    console.log('[EmailVerification] Navigation triggered', { route: '/' });
    await refreshProfileRef.current().catch((err) => {
      logger.error('Email verification profile refresh failed before navigation', err);
      console.log('[EmailVerification] Any caught errors', err);
    });
    router.replace('/');
  }, [router, stopPolling]);

  const refreshVerificationStatus = useCallback(async (source: 'mount' | 'manual' | 'poll', showUnverifiedMessage = false) => {
    if (verificationCheckInFlightRef.current) {
      logger.info('Verification status check skipped because another check is in flight', { source });
      return false;
    }
    const actionVersion = authActionVersionRef.current;
    const currentUser = auth.currentUser;
    console.log('[EmailVerification] Verification status check started', { source });
    if (!currentUser) {
      const text = 'Not signed in. Please log in again.';
      logger.warn('Email verification status check failed: no current user', { source });
      console.log('[EmailVerification] Any caught errors', { source, error: text });
      if (mountedRef.current) setMessage({ type: 'error', text });
      return false;
    }

    console.log('[EmailVerification] Current user uid', currentUser.uid);
    console.log('[EmailVerification] Current email', currentUser.email);

    verificationCheckInFlightRef.current = true;
    try {
      await withTimeout(currentUser.reload(), FIREBASE_AUTH_ACTION_TIMEOUT_MS);
      if (authActionVersionRef.current !== actionVersion || !mountedRef.current) return false;
      const verified = Boolean(auth.currentUser?.emailVerified);
      console.log('[EmailVerification] emailVerified value', verified);
      logger.info('Verification status updated', { source, uid: currentUser.uid, emailVerified: verified });
      console.log('[EmailVerification] Verification status updated', { source, emailVerified: verified });

      if (!mountedRef.current) return verified;
      setFreshEmailVerified(verified);
      await refreshUserRef.current();

      if (verified) {
        setMessage({ type: 'success', text: 'Email verified. Redirecting...' });
        await navigateAfterVerified();
      } else if (showUnverifiedMessage) {
        setMessage({ type: 'info', text: 'Email not verified yet. Please verify and try again.' });
      }
      return verified;
    } catch (err) {
      logger.error('Email verification status check failed', err);
      console.log('[EmailVerification] Any caught errors', err);
      const text = normalizeFirebaseError(err, 'Unable to check verification status. Please try again.');
      if (mountedRef.current) setMessage({ type: 'error', text });
      return false;
    } finally {
      verificationCheckInFlightRef.current = false;
    }
  }, [navigateAfterVerified]);

  useEffect(() => {
    mountedRef.current = true;
    const currentUser = auth.currentUser;
    console.log('[EmailVerification] Screen mounted');
    console.log('[EmailVerification] Current user uid', currentUser?.uid || null);
    console.log('[EmailVerification] Current email', currentUser?.email || null);
    console.log('[EmailVerification] emailVerified value', Boolean(currentUser?.emailVerified));
    setFreshEmailVerified(Boolean(currentUser?.emailVerified));
    refreshVerificationStatus('mount');
    pollRef.current = setInterval(() => {
      refreshVerificationStatus('poll');
    }, VERIFICATION_POLL_MS);

    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, [refreshVerificationStatus, stopPolling]);

  const handleCheck = async () => {
    if (busy) return;
    console.log('[EmailVerification] Check status clicked');
    logger.info('Check status clicked');
    setChecking(true);
    setMessage(null);
    try {
      await refreshVerificationStatus('manual', true);
    } finally {
      if (mountedRef.current) setChecking(false);
    }
  };

  const handleResendVerification = async () => {
    if (busy) return;
    console.log('[EmailVerification] Resend button clicked');
    logger.info('Resend button clicked');
    const currentUser = auth.currentUser;
    if (!currentUser) {
      const text = 'Not signed in. Please log in again.';
      logger.warn('Verification email resend failed: no current user');
      console.log('[EmailVerification] Any caught errors', { error: text });
      setMessage({ type: 'error', text });
      Alert.alert('Error', text);
      return;
    }

    setResending(true);
    setMessage(null);
    try {
      await withTimeout(sendEmailVerification(currentUser), FIREBASE_AUTH_ACTION_TIMEOUT_MS);
      console.log('[EmailVerification] Verification email sent');
      logger.info('Verification email sent', { uid: currentUser.uid, email: currentUser.email });
      const text = 'Verification email sent. Please check your inbox.';
      if (mountedRef.current) setMessage({ type: 'success', text });
      Alert.alert('Email Sent', text);
    } catch (err: any) {
      logger.error('Verification email resend failed', err);
      console.log('[EmailVerification] Any caught errors', err);
      const text = err?.code === 'auth/too-many-requests'
        ? 'Please wait before requesting another email.'
        : normalizeFirebaseError(err, 'Failed to send verification email.');
      if (mountedRef.current) setMessage({ type: 'error', text });
      Alert.alert('Error', text);
    } finally {
      if (mountedRef.current) setResending(false);
    }
  };

  const handleSignOut = async () => {
    if (busy) return;
    console.log('[EmailVerification] Sign out clicked');
    logger.info('Sign out clicked');
    authActionVersionRef.current += 1;
    setSigningOut(true);
    setMessage(null);
    stopPolling();
    try {
      await withTimeout(signOut(), FIREBASE_AUTH_ACTION_TIMEOUT_MS);
      console.log('[EmailVerification] Navigation triggered', { route: '/auth/login' });
      logger.info('Navigation triggered', { reason: 'sign-out', route: '/auth/login' });
      router.replace('/auth/login');
    } catch (err) {
      logger.error('Sign out failed from pending screen', err);
      console.log('[EmailVerification] Any caught errors', err);
      const text = normalizeFirebaseError(err, 'Unable to sign out. Please try again.');
      if (mountedRef.current) setMessage({ type: 'error', text });
    } finally {
      if (mountedRef.current) setSigningOut(false);
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
          <Text style={styles.title}>{isRejected ? 'Account Rejected' : 'Account Suspended'}</Text>
          <Text style={styles.subtitle}>
            {isRejected
              ? `Your signup request was rejected by an administrator.${'\n'}Please contact support for details.`
              : `Your account is currently suspended.${'\n'}Please contact support for assistance.`}
          </Text>
          <TouchableOpacity style={[styles.logoutBtn, signingOut && styles.disabledBtn]} onPress={handleSignOut} disabled={busy} testID="deactivated-logout-btn">
            {signingOut ? <ActivityIndicator size="small" color={COLORS.error} /> : <Ionicons name="log-out-outline" size={18} color={COLORS.error} />}
            <Text style={styles.logoutBtnText}>{signingOut ? 'Signing Out...' : 'Sign Out'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }



  if (hasProfileBlocker) {
    const blockerTitle = profileIssue === 'role_missing' ? 'Role Missing' : 'Profile Incomplete';
    const blockerMessage = profileIssue === 'missing_profile_document' || !profile
      ? `We could not find your account profile after email verification.${'\n'}Tap Check Status, or contact support if this continues.`
      : profileIssue === 'role_missing'
        ? `Your account role is missing or invalid.${'\n'}Please contact support so we can fix your access.`
        : `Your account profile is missing required details.${'\n'}Tap Check Status, or contact support if this continues.`;
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.content}>
          <View style={[styles.iconCircle, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="alert-circle-outline" size={48} color="#92400E" />
          </View>
          <Text style={styles.title}>{blockerTitle}</Text>
          <Text style={styles.subtitle}>{blockerMessage}</Text>
          <TouchableOpacity style={styles.checkBtn} onPress={handleCheck} disabled={checking} testID="profile-blocker-check-btn">
            {checking ? <ActivityIndicator size="small" color={COLORS.primary} /> : (
              <>
                <Ionicons name="refresh" size={18} color={COLORS.primary} />
                <Text style={styles.checkBtnText}>Check Status</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutBtn} onPress={signOut} testID="profile-blocker-logout-btn">
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
            <Text style={styles.title}>Verify Your Email</Text>
            <Text style={styles.subtitle}>
              We sent a verification email to your inbox.{"\n"}Please verify your email to continue.
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
              style={[styles.resendBtn, busy && styles.disabledBtn]}
              onPress={handleResendVerification}
              disabled={busy}
              testID="resend-verification-btn"
            >
              {resending ? <ActivityIndicator size="small" color={COLORS.secondary} /> : (
                <Ionicons name="mail-outline" size={18} color={COLORS.secondary} />
              )}
              <Text style={styles.resendBtnText}>
                {resending ? 'Sending...' : 'Resend Verification Email'}
              </Text>
            </TouchableOpacity>
            <View style={styles.changeEmailSection}>
              <Text style={styles.changeEmailPrompt}>Wrong email address?</Text>
              <TouchableOpacity
                style={styles.changeEmailBtn}
                onPress={() => router.push('/auth/change-email')}
                testID="change-email-btn"
              >
                <Ionicons name="create-outline" size={17} color={COLORS.primary} />
                <Text style={styles.changeEmailBtnText}>Change Email Address</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <View style={styles.iconCircle}>
              <Ionicons name={displayEmailVerified ? 'checkmark-circle-outline' : 'hourglass-outline'} size={48} color={COLORS.secondary} />
            </View>
            <Text style={styles.title}>{displayEmailVerified ? 'Email Verified' : 'Account Pending'}</Text>
            <Text style={styles.subtitle}>
              {displayEmailVerified
                ? `Your email is verified.${'\n'}Redirecting you to the app...`
                : `Your account is pending approval.${'\n'}An admin will review your request soon.`}
            </Text>
          </>
        )}

        {message && (
          <View style={[styles.messageBox, message.type === 'error' ? styles.errorMessage : message.type === 'success' ? styles.successMessage : styles.infoMessage]} testID="verification-message">
            <Text style={[styles.messageText, message.type === 'error' ? styles.errorMessageText : message.type === 'success' ? styles.successMessageText : styles.infoMessageText]}>{message.text}</Text>
          </View>
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
              <Text style={styles.infoLabel}>Email Verified</Text>
              <View style={[styles.statusBadge, displayEmailVerified ? styles.verifiedBadge : styles.unverifiedBadge]}>
                <Text style={[styles.statusBadgeText, displayEmailVerified ? styles.verifiedText : styles.unverifiedText]}>
                  {displayEmailVerified ? 'Verified' : 'Unverified'}
                </Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status</Text>
              <View style={[styles.statusBadge, displayEmailVerified ? styles.activeStatusBadge : styles.pendingStatusBadge]}>
                <Text style={displayEmailVerified ? styles.activeStatusText : styles.pendingStatusText}>{displayStatus}</Text>
              </View>
            </View>
          </View>
        )}

        <TouchableOpacity style={[styles.checkBtn, busy && styles.disabledBtn]} onPress={handleCheck} disabled={busy} testID="check-status-btn">
          {checking ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Ionicons name="refresh" size={18} color={COLORS.primary} />}
          <Text style={styles.checkBtnText}>{checking ? 'Checking...' : 'Check Status'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.logoutBtn, busy && styles.disabledBtn]} onPress={handleSignOut} disabled={busy} testID="pending-logout-btn">
          {signingOut ? <ActivityIndicator size="small" color={COLORS.error} /> : <Ionicons name="log-out-outline" size={18} color={COLORS.error} />}
          <Text style={styles.logoutBtnText}>{signingOut ? 'Signing Out...' : 'Sign Out'}</Text>
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
  disabledBtn: { opacity: 0.55 },
  messageBox: { width: '100%', borderRadius: RADIUS.lg, paddingHorizontal: 14, paddingVertical: 10 },
  messageText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  successMessage: { backgroundColor: '#D1FAE5' },
  successMessageText: { color: '#065F46' },
  errorMessage: { backgroundColor: '#FEE2E2' },
  errorMessageText: { color: '#991B1B' },
  infoMessage: { backgroundColor: '#E0F2FE' },
  infoMessageText: { color: '#075985' },
  infoCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.lg, width: '100%', gap: SPACING.sm, marginTop: 8 },
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
  activeStatusBadge: { backgroundColor: '#D1FAE5' },
  activeStatusText: { fontSize: 12, fontWeight: '700', color: '#065F46', textTransform: 'capitalize' },
  checkBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 2, borderColor: COLORS.primary, borderRadius: RADIUS.lg, paddingHorizontal: 24, paddingVertical: 14, marginTop: 8 },
  checkBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.primary },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  logoutBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.error },
});
