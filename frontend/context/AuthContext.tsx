/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  User,
} from 'firebase/auth';
import {
  collection, doc, getDoc, getDocs, increment, limit, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { normalizeFirebaseError, withTimeout } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { startupLog } from '@/lib/startup';
import { normalizeRole, type AppRole, type OnboardingRole } from '@/lib/roles';

const AUTH_STARTUP_WATCHDOG_MS = 5000;
const PROFILE_LOOKUP_TIMEOUT_MS = 8000;
const PROFILE_CACHE_TIMEOUT_MS = 1200;

export type UserProfile = {
  uid?: string;
  name: string;
  email: string;
  role: AppRole;
  status: 'pending' | 'approved' | 'deactivated' | 'rejected';
  photo_url?: string;
  avatar?: string;
  referral_code?: string;
  referral_count?: number;
};

type AuthContextType = {
  user: User | null;
  profile: UserProfile | null;
  authLoading: boolean;
  emailVerified: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (name: string, email: string, password: string, role: OnboardingRole, referralCode?: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  resendVerification: () => Promise<string | null>;
  resetPassword: (email: string) => Promise<string | null>;
  refreshUser: () => Promise<void>;
  profileOffline: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  authLoading: true,
  emailVerified: false,
  signIn: async () => null,
  signUp: async () => null,
  signOut: async () => {},
  refreshProfile: async () => {},
  resendVerification: async () => null,
  resetPassword: async () => null,
  refreshUser: async () => {},
  profileOffline: false,
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
  const [authLoading, setAuthLoading] = useState(true);
  const [profileOffline, setProfileOffline] = useState(false);

  const emailVerified = user?.emailVerified ?? false;
  const getProfileCacheKey = (uid: string) => `profile_cache_${uid}`;

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
    setProfileOffline(true);
    return true;
  };

  const fetchProfile = async (uid: string) => {
    try {
      const snap = await withTimeout(getDoc(doc(db, 'users', uid)), PROFILE_LOOKUP_TIMEOUT_MS);
      if (snap.exists()) {
        const nextProfile = { ...(snap.data() as UserProfile), role: normalizeRole((snap.data() as any)?.role, 'auth.fetchProfile') } as UserProfile;
        setProfile(nextProfile);
        setProfileOffline(false);
        await AsyncStorage.setItem(getProfileCacheKey(uid), JSON.stringify(nextProfile)).catch(() => {});
      } else {
        setProfile(null);
        await AsyncStorage.removeItem(getProfileCacheKey(uid)).catch(() => {});
      }
    } catch (err) {
      logger.warn('Failed to fetch profile:', err);
      const usedCache = await applyCachedProfile(uid, 'auth.cachedProfile');
      if (!usedCache) setProfile(null);
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

  const refreshUser = async () => {
    if (auth.currentUser) {
      try {
        await auth.currentUser.reload();
        logger.info('Auth user refreshed', { uid: auth.currentUser.uid, emailVerified: auth.currentUser.emailVerified });
        setUser({ ...auth.currentUser } as User);
      } catch (err) {
        logger.error('Failed to refresh auth user:', err);
      }
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
                setProfile(null);
                await AsyncStorage.removeItem(getProfileCacheKey(firebaseUser.uid)).catch(() => {});
                await firebaseSignOut(auth).catch(() => {});
                return;
              }
              const nextProfile = { ...(snap.data() as UserProfile), role: normalizeRole((snap.data() as any)?.role, 'auth.fetchProfile') } as UserProfile;
              startupLog('Profile loaded', { exists: true, status: nextProfile.status, role: nextProfile.role, fromCache: snap.metadata.fromCache });
              setProfile(nextProfile);
              await AsyncStorage.setItem(getProfileCacheKey(firebaseUser.uid), JSON.stringify(nextProfile)).catch(() => {});
              await syncPublicProfile(firebaseUser.uid, nextProfile);
              if (nextProfile.status === 'deactivated' || nextProfile.status === 'rejected') {
                await firebaseSignOut(auth).catch(() => {});
              }
            }, async (err) => {
              logger.warn('Profile realtime listener failed:', err);
              startupLog('Profile listener failed', { message: String((err as any)?.message || err) });
              setProfileOffline(true);
              await fetchProfile(firebaseUser.uid);
            });
          } else {
            startupLog('Profile loaded', { skipped: 'no-user' });
            setProfile(null);
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
  }, []);

  const signIn = async (email: string, password: string): Promise<string | null> => {
    const safeEmail = email.trim().toLowerCase();
    if (!safeEmail || !password) return 'Please enter email and password';
    try {
      const cred = await withTimeout(signInWithEmailAndPassword(auth, safeEmail, password));
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
    name: string, email: string, password: string, role: OnboardingRole, referralCode?: string
  ): Promise<string | null> => {
    // Role protection - only student or teacher allowed
    const safeRole = role === 'teacher' ? 'teacher' : 'student';
    const safeName = name.trim();
    const safeEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();
    if (!safeName || !safeEmail || !password) return 'Please fill in all required fields';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail)) return 'Invalid email format';
    if (normalizedPassword.length < 6) return 'Password must be at least 6 characters';
    try {
      const cred = await withTimeout(createUserWithEmailAndPassword(auth, safeEmail, normalizedPassword));
      // Send verification email
      try {
        await withTimeout(sendEmailVerification(cred.user));
      } catch { /* non-blocking */ }

      let referrerId: string | null = null;
      const normalizedCode = (referralCode || '').trim().toUpperCase();
      if (normalizedCode) {
        const refSnap = await getDocs(query(collection(db, 'users'), where('referral_code', '==', normalizedCode), limit(1)));
        referrerId = refSnap.empty ? null : refSnap.docs[0].id;
      }

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
      });
      await setDoc(doc(db, 'public_profiles', cred.user.uid), {
        uid: cred.user.uid,
        name: safeName,
        role: safeRole,
        status: 'pending',
        searchable: false,
        is_active: false,
        photo_url: '',
        avatar: 'person',
        updated_at: serverTimestamp(),
      }, { merge: true });
      if (referrerId) {
        await updateDoc(doc(db, 'users', referrerId), {
          referral_count: increment(1),
          updated_at: serverTimestamp(),
        }).catch(() => {});
      }
      await fetchProfile(cred.user.uid);
      return null;
    } catch (err: any) {
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
      await sendEmailVerification(auth.currentUser);
      logger.info('Verification email sent', { uid: auth.currentUser.uid, email: auth.currentUser.email });
      return null;
    } catch (err: any) {
      logger.error('Verification email resend failed', err);
      if (err?.code === 'auth/too-many-requests') return 'Please wait before requesting another email';
      return err?.message || 'Failed to send verification email';
    }
  };

  const resetPassword = async (email: string): Promise<string | null> => {
    const safeEmail = email.trim().toLowerCase();
    if (!safeEmail) return 'Please enter your email';
    try {
      await withTimeout(sendPasswordResetEmail(auth, safeEmail));
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

  return (
    <AuthContext.Provider value={{
      user, profile, authLoading, emailVerified,
      signIn, signUp, signOut: signOutUser, refreshProfile,
      resendVerification, resetPassword, refreshUser, profileOffline,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
