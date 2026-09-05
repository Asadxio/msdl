import React, { createContext, useContext, useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  User,
  updateEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  reload,
} from 'firebase/auth';
import {
  collection, doc, getDoc, getDocs, increment, limit, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { normalizeFirebaseError, withTimeout } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { startupLog } from '@/lib/startup';
import { normalizeRole, type AppRole, type OnboardingRole } from '@/lib/roles';
import { isOwnerEmail, isFounderEmail } from '@/lib/founderPolicy';
import {
  markSignupCompleted,
  markVerificationEmailSent,
  trackEmailVerificationError,
} from '@/lib/emailVerificationAnalytics';
import { trackEvent } from '@/lib/analytics';
import { VERIFICATION_ACTION_CODE_SETTINGS, PASSWORD_RESET_ACTION_CODE_SETTINGS } from '@/lib/emailVerificationSettings';
import { dispatchWelcomeNotification } from '@/lib/notifications';

const AUTH_STARTUP_WATCHDOG_MS = 5000;
const PROFILE_LOOKUP_TIMEOUT_MS = 8000;
const PROFILE_CACHE_TIMEOUT_MS = 1200;

export type UserProfile = {
  uid?: string;
  name: string;
  email: string;
  role: AppRole;
  status: 'pending' | 'approved' | 'deactivated' | 'rejected' | 'suspended';
  photo_url?: string;
  avatar?: string;
  referral_code?: string;
  referral_count?: number;
  founder?: boolean;
};

export type ProfileIssue = 'missing_profile_document' | 'profile_incomplete' | 'role_missing' | null;

export type ChangeEmailResult = {
  error: string | null;
  code?: string;
  email?: string;
};

type AuthContextType = {
  user: User | null;
  profile: UserProfile | null;
  profileIssue: ProfileIssue;
  authLoading: boolean;
  emailVerified: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (
    name: string,
    email: string,
    password: string,
    role: OnboardingRole,
    referralCode?: string,
    complianceData?: {
      is_minor?: boolean;
      age_bracket?: string;
      guardian_name?: string;
      guardian_phone?: string;
    }
  ) => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  resendVerification: () => Promise<string | null>;
  changeEmailAddress: (newEmail: string, currentPassword?: string) => Promise<ChangeEmailResult>;
  resetPassword: (email: string) => Promise<string | null>;
  refreshUser: () => Promise<boolean>;
  profileOffline: boolean;
  showSignupVerificationPrompt: boolean;
  signupVerificationFlowActive: boolean;
  acknowledgeSignupVerificationPrompt: () => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  profileIssue: null,
  authLoading: true,
  emailVerified: false,
  signIn: async () => null,
  signUp: async () => null,
  signOut: async () => {},
  refreshProfile: async () => {},
  resendVerification: async () => null,
  changeEmailAddress: async () => ({ error: 'Not signed in' }),
  resetPassword: async () => null,
  refreshUser: async () => false,
  profileOffline: false,
  showSignupVerificationPrompt: false,
  signupVerificationFlowActive: false,
  acknowledgeSignupVerificationPrompt: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

function generateReferralCode(name: string): string {
  const prefix = name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'USER';
  return `${prefix}${Math.floor(1000 + Math.random() * 9000)}`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileIssue, setProfileIssue] = useState<ProfileIssue>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileOffline, setProfileOffline] = useState(false);
  const [showSignupVerificationPrompt, setShowSignupVerificationPrompt] = useState(false);
  const [signupVerificationFlowActive, setSignupVerificationFlowActive] = useState(false);

  const emailVerified = user?.emailVerified ?? false;
  const getProfileCacheKey = (uid: string) => `profile_cache_${uid}`;
  const getVerificationResendKey = (uid: string) => `verification_resend_${uid}`;


  const validateProfileData = (raw: any, uid: string, source: string): { profile: UserProfile; issue: ProfileIssue } => {
    const rawRole = raw?.role;
    const rawStatus = String(raw?.status || '').trim().toLowerCase();
    const rawEmail = String(raw?.email || '').trim().toLowerCase();
    const isOwner = isOwnerEmail(rawEmail);

    const role = isOwner ? 'super_admin' : normalizeRole(rawRole, source);
    const status = isOwner
      ? 'approved'
      : (['pending', 'approved', 'deactivated', 'rejected', 'suspended'].includes(rawStatus) ? rawStatus as UserProfile['status'] : 'pending');

    const profileData = {
      ...(raw as UserProfile),
      uid: raw?.uid || uid,
      name: String(raw?.name || '').trim() || (isOwner ? 'Administrator' : ''),
      email: rawEmail,
      role,
      status,
      ...(isOwner ? { founder: true } : {}),
    } as UserProfile;

    let issue: ProfileIssue = null;
    if (!isOwner) {
      if (!rawRole || role !== String(rawRole).trim().toLowerCase()) issue = 'role_missing';
      if (!profileData.name || !profileData.email || !rawStatus || status !== rawStatus) issue = issue || 'profile_incomplete';
    }
    return { profile: profileData, issue };
  };

  const parseCachedProfile = (raw: string | null, source: string): UserProfile | null => {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as UserProfile;
      return { ...parsed, role: normalizeRole((parsed as any)?.role, source) } as UserProfile;
    } catch (err) {
      logger.warn('Ignoring invalid cached profile:', err);
      return null;
    }
  };

  const readCachedProfile = async (uid: string, source: string): Promise<UserProfile | null> => {
    try {
      const cached = await withTimeout(AsyncStorage.getItem(getProfileCacheKey(uid)), PROFILE_CACHE_TIMEOUT_MS);
      return parseCachedProfile(cached, source);
    } catch (err) {
      logger.warn('Cached profile read timed out or failed:', err);
      return null;
    }
  };

  const applyCachedProfile = async (uid: string, source: string): Promise<boolean> => {
    const cachedProfile = await readCachedProfile(uid, source);
    if (!cachedProfile) return false;
    setProfile(cachedProfile);
    setProfileIssue(null);
    setProfileOffline(true);
    return true;
  };

  const fetchProfile = async (uid: string) => {
    try {
      const snap = await withTimeout(getDoc(doc(db, 'users', uid)), PROFILE_LOOKUP_TIMEOUT_MS);
      if (snap.exists()) {
        const { profile: nextProfile, issue } = validateProfileData(snap.data(), uid, 'auth.fetchProfile');
        setProfile(nextProfile);
        setProfileIssue(issue);
        setProfileOffline(false);
        await AsyncStorage.setItem(getProfileCacheKey(uid), JSON.stringify(nextProfile)).catch(() => {});
      } else {
        setProfile(null);
        setProfileIssue('missing_profile_document');
        setProfileOffline(false);
        trackEvent('missing_profile_document', { uid, timestamp: Date.now(), source: 'fetchProfile', platform: Platform.OS }, `missing-profile-${uid}-${Date.now()}`);
        await AsyncStorage.removeItem(getProfileCacheKey(uid)).catch(() => {});
      }
    } catch (err) {
      logger.warn('Failed to fetch profile:', err);
      const usedCache = await applyCachedProfile(uid, 'auth.cachedProfile');
      if (!usedCache) {
        setProfile(null);
        setProfileIssue('missing_profile_document');
      }
    }
  };

  const syncPublicProfile = async (uid: string, nextProfile: UserProfile) => {
    await setDoc(doc(db, 'public_profiles', uid), {
      uid,
      name: nextProfile.name || 'User',
      role: nextProfile.role,
      status: nextProfile.status,
      searchable: nextProfile.status === 'approved',
      is_active: nextProfile.status === 'approved',
      photo_url: nextProfile.photo_url || '',
      avatar: nextProfile.avatar || 'person',
      updated_at: serverTimestamp(),
    }, { merge: true }).catch(() => {});
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.uid);
    }
  };

  const refreshUser = async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    try {
      await auth.currentUser.reload();
      logger.info('Auth user refreshed', { uid: auth.currentUser.uid, emailVerified: auth.currentUser.emailVerified });
      setUser({ ...auth.currentUser, emailVerified: auth.currentUser.emailVerified } as User);
      return true;
    } catch (err) {
      logger.error('Failed to refresh auth user:', err);
      return false;
    }
  };

  const authStartupCompletedRef = useRef(false);
  const authLoaderClearReasonRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let profileUnsub: (() => void) | null = null;
    let authUnsub: (() => void) | null = null;

    startupLog('Auth provider mounted', { authLoadingInitial: true });

    const clearAuthLoader = (reason: string) => {
      if (!mounted) return;
      authStartupCompletedRef.current = true;
      if (!authLoaderClearReasonRef.current) {
        authLoaderClearReasonRef.current = reason;
        startupLog('Loader cleared', { reason });
      }
      setAuthLoading(false);
    };

    startupLog('Auth startup watchdog scheduled', { timeoutMs: AUTH_STARTUP_WATCHDOG_MS });
    const watchdog = setTimeout(() => {
      if (!mounted || authStartupCompletedRef.current) return;
      logger.warn('Auth startup watchdog elapsed; continuing with cached/offline state');
      startupLog('Auth startup watchdog fired', { timeoutMs: AUTH_STARTUP_WATCHDOG_MS, hasCurrentUser: Boolean(auth.currentUser?.uid) });
      const currentUser = auth.currentUser;
      setUser(currentUser ?? null);
      clearAuthLoader('watchdog');
      if (currentUser?.uid) {
        setProfileOffline(true);
        applyCachedProfile(currentUser.uid, 'auth.watchdogCachedProfile').catch(() => {});
      } else {
        setProfile(null);
        setProfileIssue(null);
      }
    }, AUTH_STARTUP_WATCHDOG_MS);

    try {
      authUnsub = onAuthStateChanged(auth, async (firebaseUser) => {
        startupLog('Auth restored', { hasUser: Boolean(firebaseUser?.uid), emailVerified: Boolean(firebaseUser?.emailVerified) });
        try {
          if (profileUnsub) {
            profileUnsub();
            profileUnsub = null;
          }
          setUser(firebaseUser);
          setProfileOffline(false);
          if (firebaseUser) {
            const usedCachedProfile = await applyCachedProfile(firebaseUser.uid, 'auth.cachedRealtime');
            startupLog('Cached profile lookup complete', { usedCache: usedCachedProfile });
            profileUnsub = onSnapshot(doc(db, 'users', firebaseUser.uid), async (snap) => {
              setProfileOffline(Boolean(snap.metadata.fromCache && !snap.metadata.hasPendingWrites));
              if (!snap.exists()) {
                startupLog('Profile loaded', { exists: false, fromCache: snap.metadata.fromCache });
                if (isOwnerEmail(firebaseUser.email)) {
                  try {
                    await setDoc(doc(db, 'users', firebaseUser.uid), {
                      name: firebaseUser.displayName || 'Owner',
                      email: firebaseUser.email.trim().toLowerCase(),
                      role: 'super_admin',
                      status: 'approved',
                      founder: true,
                      created_at: serverTimestamp(),
                      updated_at: serverTimestamp(),
                    });
                    return;
                  } catch (initErr) {
                    logger.warn('[AuthContext] Failed to initialize owner user document:', initErr);
                  }
                }
                setProfile(null);
                setProfileIssue('missing_profile_document');
                trackEvent('missing_profile_document', { uid: firebaseUser.uid, timestamp: Date.now(), source: 'snapshot', platform: Platform.OS }, `missing-profile-${firebaseUser.uid}-${Date.now()}`);
                await AsyncStorage.removeItem(getProfileCacheKey(firebaseUser.uid)).catch(() => {});
                return;
              }
              const { profile: nextProfile, issue } = validateProfileData(snap.data(), firebaseUser.uid, 'auth.snapshotProfile');
              startupLog('Profile loaded', { exists: true, status: nextProfile.status, role: nextProfile.role, issue, fromCache: snap.metadata.fromCache });

              if (nextProfile.status === 'approved' && !firebaseUser.emailVerified) {
                try {
                  await firebaseUser.reload();
                  await firebaseUser.getIdToken(true);
                  setUser({ ...firebaseUser, emailVerified: firebaseUser.emailVerified } as User);
                } catch (reloadErr) {
                  // Non-fatal — cached token will still be used
                }
              }

              // Self-healing for Owner: ensure Firestore doc has super_admin, approved, and founder: true
              if (isOwnerEmail(firebaseUser.email)) {
                const snapData = snap.data() || {};
                if (snapData.role !== 'super_admin' || snapData.status !== 'approved' || !snapData.founder) {
                  try {
                    await setDoc(doc(db, 'users', firebaseUser.uid), {
                      name: snapData.name || firebaseUser.displayName || 'Owner',
                      email: firebaseUser.email.trim().toLowerCase(),
                      role: 'super_admin',
                      status: 'approved',
                      founder: true,
                      updated_at: serverTimestamp(),
                    }, { merge: true });
                  } catch (healErr) {
                    logger.warn('[AuthContext] Failed to self-heal owner user document:', healErr);
                  }
                }
              }

              // After email verification detected
              if (firebaseUser.emailVerified && nextProfile.status === 'pending' && nextProfile.role === 'student') {
                try {
                  await updateDoc(doc(db, 'users', firebaseUser.uid), {
                    status: 'approved',
                    updated_at: serverTimestamp(),
                  });
                  // Also update public_profiles
                  await updateDoc(doc(db, 'public_profiles', firebaseUser.uid), {
                    status: 'approved',
                    updated_at: serverTimestamp(),
                  });
                  nextProfile.status = 'approved';
                } catch (e) {
                  // Non-fatal; user can re-login to retry
                }
              }

              setProfile((prev) => {
                if (prev && JSON.stringify(prev) === JSON.stringify(nextProfile)) {
                  return prev;
                }
                return nextProfile;
              });
              setProfileIssue(issue);
              await AsyncStorage.setItem(getProfileCacheKey(firebaseUser.uid), JSON.stringify(nextProfile)).catch(() => {});
              await syncPublicProfile(firebaseUser.uid, nextProfile);
            }, async (err) => {
              logger.warn('Profile realtime listener failed:', err);
              startupLog('Profile listener failed', { message: String((err as any)?.message || err) });
              setProfileOffline(true);
              await fetchProfile(firebaseUser.uid);
            });
          } else {
            startupLog('Profile loaded', { skipped: 'no-user' });
            setProfile(null);
            setProfileIssue(null);
          }
        } catch (err) {
          logger.warn('Auth startup callback failed:', err);
          startupLog('Auth startup callback failed', { message: String((err as any)?.message || err) });
          setUser(auth.currentUser ?? null);
          if (!auth.currentUser) setProfile(null);
        } finally {
          clearTimeout(watchdog);
          clearAuthLoader('auth-state-callback');
        }
      });
    } catch (err) {
      logger.warn('Auth state subscription failed:', err);
      startupLog('Auth state subscription failed', { message: String((err as any)?.message || err) });
      clearTimeout(watchdog);
      setUser(auth.currentUser ?? null);
      if (!auth.currentUser) setProfile(null);
      clearAuthLoader('auth-subscribe-error');
    }

    return () => {
      mounted = false;
      clearTimeout(watchdog);
      if (profileUnsub) profileUnsub();
      if (authUnsub) authUnsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = async (email: string, password: string): Promise<string | null> => {
    const safeEmail = email.trim().toLowerCase();
    if (!safeEmail || !password) return 'Please enter email and password';
    try {
      const cred = await withTimeout(signInWithEmailAndPassword(auth, safeEmail, password));
      try {
        await cred.user.reload();
        await cred.user.getIdToken(true);
      } catch {}
      await updateDoc(doc(db, 'users', cred.user.uid), { last_login_at: serverTimestamp() }).catch(() => {});
      await fetchProfile(cred.user.uid);
      return null;
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') return 'Invalid email or password';
      if (code === 'auth/wrong-password') return 'Invalid email or password';
      if (code === 'auth/invalid-email') return 'Invalid email format';
      if (code === 'auth/too-many-requests') return 'Too many attempts. Please try again later';
      if (code === 'auth/network-request-failed') return 'Network error. Check your internet connection';
      if (code === 'auth/user-disabled') return 'This account has been disabled';
      return normalizeFirebaseError(err, 'Login failed. Please try again');
    }
  };

  const signUp = async (
    name: string,
    email: string,
    password: string,
    role: OnboardingRole,
    referralCode?: string,
    complianceData?: {
      is_minor?: boolean;
      age_bracket?: string;
      guardian_name?: string;
      guardian_phone?: string;
    }
  ): Promise<string | null> => {
    // Role protection - only student or teacher allowed
    const safeRole = role === 'teacher' ? 'teacher' : 'student';
    const safeName = name.trim();
    const safeEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();
    if (!safeName || !safeEmail || !password) return 'Please fill in all required fields';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail)) return 'Invalid email format';
    if (normalizedPassword.length < 6) return 'Password must be at least 6 characters';

    const debugLog = (...args: any[]) => {
      if (__DEV__) {
        console.log(...args);
      }
    };
    const debugError = (...args: any[]) => {
      if (__DEV__) {
        console.error(...args);
      }
    };

    setSignupVerificationFlowActive(true);
     try {
      debugLog('[SIGNUP_DEBUG] Attempting createUserWithEmailAndPassword for:', safeEmail);
      const cred = await withTimeout(createUserWithEmailAndPassword(auth, safeEmail, normalizedPassword));
      debugLog('[SIGNUP_DEBUG] createUserWithEmailAndPassword SUCCESS, uid:', cred.user.uid);
      // Send verification email
      try {
        debugLog('[SIGNUP_DEBUG] Attempting sendEmailVerification for uid:', cred.user.uid);
        trackEvent('verification_email_delivery_attempt', {
          source: 'signup',
          status: 'requested',
          uid: cred.user.uid,
          emailDomain: safeEmail.split('@')[1] || 'unknown',
        }, `verification-email-signup-requested-${cred.user.uid}`);
        await withTimeout(sendEmailVerification(cred.user, VERIFICATION_ACTION_CODE_SETTINGS));
        debugLog('[SIGNUP_DEBUG] sendEmailVerification SUCCESS for uid:', cred.user.uid);
        void markVerificationEmailSent(cred.user.uid);
      } catch (error: any) {
        debugError('[SIGNUP_DEBUG] FAILED sendEmailVerification. Code:', error?.code, 'Message:', error?.message);
        trackEmailVerificationError('verification_email_send_failed', error, { uid: cred.user.uid });
      }

      let referrerId: string | null = null;
      const normalizedCode = (referralCode || '').trim().toUpperCase();
      if (normalizedCode) {
        debugLog('[SIGNUP_DEBUG] Checking referral code:', normalizedCode);
        try {
          const refSnap = await getDocs(query(collection(db, 'users'), where('referral_code', '==', normalizedCode), limit(1)));
          referrerId = refSnap.empty ? null : refSnap.docs[0].id;
          debugLog('[SIGNUP_DEBUG] Referral check success, referrerId:', referrerId);
        } catch (refErr: any) {
          debugError('[SIGNUP_DEBUG] Referral check failed. Code:', refErr?.code, 'Msg:', refErr?.message);
        }
      }

      debugLog('[SIGNUP_DEBUG] Attempting write to users/', cred.user.uid);
      try {
        await setDoc(doc(db, 'users', cred.user.uid), {
          name: safeName,
          email: safeEmail,
          role: safeRole,
          status: 'pending',
          referral_code: generateReferralCode(name),
          referred_by: referrerId,
          referral_count: 0,
          last_login_at: serverTimestamp(),
          created_at: serverTimestamp(),
          is_minor: Boolean(complianceData?.is_minor),
          age_bracket: complianceData?.age_bracket || (complianceData?.is_minor ? 'under_18' : '18_plus'),
          ...(complianceData?.guardian_name ? { guardian_name: complianceData.guardian_name } : {}),
          ...(complianceData?.guardian_phone ? { guardian_phone: complianceData.guardian_phone } : {}),
        });
        debugLog('[SIGNUP_DEBUG] Successfully wrote users/', cred.user.uid);

        // Record auditable legal acceptance & parental consent document
        await setDoc(doc(db, 'users', cred.user.uid, 'compliance', 'legal_acceptance'), {
          accepted: {
            terms: { version: '2026.1', acceptedAt: serverTimestamp() },
            privacy: { version: '2026.1', acceptedAt: serverTimestamp() },
            community: { version: '2026.1', acceptedAt: serverTimestamp() },
            ...(complianceData?.is_minor ? {
              minor_guardian_consent: { version: '2026.1', acceptedAt: serverTimestamp() },
            } : {}),
          },
          acceptance_updated_at: serverTimestamp(),
          policy_bundle_version: '2026.1',
          is_minor: Boolean(complianceData?.is_minor),
          age_bracket: complianceData?.age_bracket || (complianceData?.is_minor ? 'under_18' : '18_plus'),
          ...(complianceData?.guardian_name ? { guardian_name: complianceData.guardian_name } : {}),
          ...(complianceData?.guardian_phone ? { guardian_phone: complianceData.guardian_phone } : {}),
        });
      } catch (userErr: any) {
        debugError('[SIGNUP_DEBUG] FAILED write to users/. Code:', userErr?.code, 'Message:', userErr?.message, 'Full:', userErr);
        throw userErr;
      }

      debugLog('[SIGNUP_DEBUG] Attempting write to public_profiles/', cred.user.uid);
      try {
        await setDoc(doc(db, 'public_profiles', cred.user.uid), {
          uid: cred.user.uid,
          name: safeName,
          role: safeRole,
          status: 'pending',
          searchable: true,
          is_active: true,
          photo_url: '',
          avatar: 'person',
          updated_at: serverTimestamp(),
        }, { merge: true });
        debugLog('[SIGNUP_DEBUG] Successfully wrote public_profiles/', cred.user.uid);
      } catch (pubErr: any) {
        debugError('[SIGNUP_DEBUG] FAILED write to public_profiles/. Code:', pubErr?.code, 'Message:', pubErr?.message, 'Full:', pubErr);
        throw pubErr;
      }

      if (referrerId) {
        debugLog('[SIGNUP_DEBUG] Recording referral attribution:', referrerId);
        try {
          // Multi-level gamified counter removed; write clean attribution record
          const recordId = 'ref_' + cred.user.uid;
          const nameParts = safeName.split(/\s+/);
          const maskedName = (nameParts[0] || 'طالبہ') + ' (محفوظ برائے پردہ)';
          await setDoc(doc(db, 'referral_records', recordId), {
            id: recordId,
            referrer_uid: referrerId,
            referee_uid: cred.user.uid,
            referee_name: maskedName,
            referral_code: normalizedCode,
            status: 'joined',
            created_at: serverTimestamp(),
          });

          // Send congratulations notification
          const notifRef = doc(collection(db, 'notifications'));
          await setDoc(notifRef, {
            id: notifRef.id,
            recipient_id: referrerId,
            user_id: referrerId,
            type: 'referral_success',
            title: '🌸 صدقہ جاریہ کی مبارکباد (New Sister Joined)',
            body: 'ماشاءاللہ! آپ کی دعوت سے ایک نئی بہن نے مدرسہ جوائن کر لیا ہے۔ اللہ تعالیٰ اس نیکی کو آپ کے لیے صدقہ جاریہ بنائے۔',
            route: '/referral',
            read: false,
            created_at: serverTimestamp(),
          });
          debugLog('[SIGNUP_DEBUG] Successfully updated referrer & recorded referral:', referrerId);
        } catch (refUpErr: any) {
          debugError('[SIGNUP_DEBUG] FAILED update to referrer. Code:', refUpErr?.code, 'Message:', refUpErr?.message);
        }
      }
      void markSignupCompleted(cred.user.uid);
      void dispatchWelcomeNotification(cred.user.uid, safeName).catch((err) => {
        debugError('[SIGNUP_DEBUG] Welcome notification dispatch failed:', err);
      });
      setShowSignupVerificationPrompt(false);
      setSignupVerificationFlowActive(false);
      await fetchProfile(cred.user.uid);
      return null;
    } catch (err: any) {
      setSignupVerificationFlowActive(false);
      const code = err?.code || '';
      if (code === 'auth/email-already-in-use') return 'Email already registered';
      if (code === 'auth/weak-password') return 'Password must be at least 6 characters';
      if (code === 'auth/invalid-email') return 'Invalid email format';
      if (code === 'auth/network-request-failed') return 'Network error. Check your internet connection';
      return normalizeFirebaseError(err, 'Signup failed. Please try again');
    }
  };

  const resendVerification = async (): Promise<string | null> => {
    if (!auth.currentUser) return 'Not signed in';
    try {
      await sendEmailVerification(auth.currentUser, VERIFICATION_ACTION_CODE_SETTINGS);
      logger.info('Verification email sent', { uid: auth.currentUser.uid, email: auth.currentUser.email });
      return null;
    } catch (err: any) {
      logger.error('Verification email resend failed', err);
      if (err?.code === 'auth/too-many-requests') return 'Please wait before requesting another email';
      return err?.message || 'Failed to send verification email';
    }
  };


  const changeEmailAddress = async (newEmail: string, currentPassword?: string): Promise<ChangeEmailResult> => {
    const currentUser = auth.currentUser;
    if (!currentUser) return { error: 'Not signed in', code: 'auth/no-current-user' };

    const safeEmail = newEmail.trim().toLowerCase();
    const previousEmail = currentUser.email || profile?.email || '';
    const emailDomain = safeEmail.split('@')[1] || 'unknown';
    const eventBase = {
      uid: currentUser.uid,
      emailDomain,
      platform: Platform.OS,
      timestamp: Date.now(),
    };

    const fail = (code: string, message: string): ChangeEmailResult => {
      trackEvent('verification_change_email_failed', {
        ...eventBase,
        code,
      }, `verification-change-email-failed-${currentUser.uid}-${Date.now()}`);
      return { error: message, code };
    };

    if (!safeEmail) return fail('auth/missing-email', 'Please enter your new email address');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail)) return fail('auth/invalid-email', 'Please enter a valid email address');
    if (safeEmail === previousEmail.trim().toLowerCase()) return fail('auth/same-email', 'Please enter a different email address');

    try {
      if (currentPassword && previousEmail) {
        const credential = EmailAuthProvider.credential(previousEmail, currentPassword);
        await reauthenticateWithCredential(currentUser, credential);
      }

      await updateEmail(currentUser, safeEmail);
      await sendEmailVerification(currentUser, VERIFICATION_ACTION_CODE_SETTINGS);
      await AsyncStorage.removeItem(getVerificationResendKey(currentUser.uid)).catch(() => {});
      await setDoc(doc(db, 'users', currentUser.uid), {
        email: safeEmail,
        updated_at: serverTimestamp(),
      }, { merge: true });
      setProfile((prev) => prev ? { ...prev, email: safeEmail } : prev);
      await reload(currentUser);
      setUser({ ...currentUser } as User);
      await fetchProfile(currentUser.uid);
      trackEvent('verification_change_email_success', {
        ...eventBase,
        previousEmailDomain: previousEmail.split('@')[1] || 'unknown',
      }, `verification-change-email-success-${currentUser.uid}-${Date.now()}`);
      return { error: null, email: safeEmail };
    } catch (err: any) {
      const code = err?.code || 'unknown';
      if (code === 'auth/requires-recent-login') return fail(code, 'For your security, please enter your current password and try again.');
      if (code === 'auth/invalid-email') return fail(code, 'Please enter a valid email address');
      if (code === 'auth/email-already-in-use') return fail(code, 'This email address is already in use. Please use a different email or sign in with that account.');
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') return fail(code, 'The current password you entered is incorrect. Please try again.');
      if (code === 'auth/too-many-requests') return fail(code, 'Too many attempts. Please wait and try again later.');
      if (code === 'auth/network-request-failed') return fail(code, 'Network error. Check your internet connection and try again.');
      return fail(code, normalizeFirebaseError(err, 'Failed to update email address. Please try again.'));
    }
  };

  const resetPassword = async (email: string): Promise<string | null> => {
    const safeEmail = email.trim().toLowerCase();
    if (!safeEmail) return 'Please enter your email';
    try {
      await withTimeout(sendPasswordResetEmail(auth, safeEmail, PASSWORD_RESET_ACTION_CODE_SETTINGS));
      return null;
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') return 'No account found with this email';
      if (code === 'auth/invalid-email') return 'Invalid email format';
      if (code === 'auth/too-many-requests') return 'Please wait before requesting another email';
      if (code === 'auth/network-request-failed') return 'Network error. Check your internet connection';
      return normalizeFirebaseError(err, 'Failed to send reset email');
    }
  };

  const signOutUser = async () => {
    const uid = auth.currentUser?.uid || user?.uid || null;
    try {
      await firebaseSignOut(auth);
      if (uid) await AsyncStorage.removeItem(getProfileCacheKey(uid)).catch(() => {});
      logger.info('Signed out and cleared auth session cache', { uid });
    } catch (err) {
      logger.error('Failed to sign out cleanly:', err);
    } finally {
      setUser(null);
      setProfile(null);
      setProfileOffline(false);
    }
  };

  const acknowledgeSignupVerificationPrompt = () => {
    setShowSignupVerificationPrompt(false);
    setSignupVerificationFlowActive(false);
  };

  const contextValue = useMemo(() => ({
    user, profile, profileIssue, authLoading, emailVerified,
    signIn, signUp, signOut: signOutUser, refreshProfile,
    resendVerification, changeEmailAddress, resetPassword, refreshUser, profileOffline,
    showSignupVerificationPrompt, signupVerificationFlowActive, acknowledgeSignupVerificationPrompt,
  }), [
    user, profile, profileIssue, authLoading, emailVerified, profileOffline,
    showSignupVerificationPrompt, signupVerificationFlowActive,
  ]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}
