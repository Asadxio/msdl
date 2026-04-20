import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  reload,
  User,
} from 'firebase/auth';
import {
  collection, doc, getDoc, getDocs, increment, limit, query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export type UserProfile = {
  name: string;
  email: string;
  role: 'student' | 'teacher' | 'admin';
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
  signUp: (name: string, email: string, password: string, role: 'student' | 'teacher', referralCode?: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  resendVerification: () => Promise<string | null>;
  resetPassword: (email: string) => Promise<string | null>;
  refreshUser: () => Promise<void>;
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

  const emailVerified = user?.emailVerified ?? false;

  const fetchProfile = async (uid: string) => {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        setProfile(snap.data() as UserProfile);
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.warn('Failed to fetch profile:', err);
      setProfile(null);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.uid);
    }
  };

  const refreshUser = async () => {
    if (auth.currentUser) {
      await reload(auth.currentUser);
      setUser({ ...auth.currentUser } as User);
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await fetchProfile(firebaseUser.uid);
      } else {
        setProfile(null);
      }
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  const signIn = async (email: string, password: string): Promise<string | null> => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
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
      return err?.message || 'Login failed. Please try again';
    }
  };

  const signUp = async (
    name: string, email: string, password: string, role: 'student' | 'teacher', referralCode?: string
  ): Promise<string | null> => {
    // Role protection - only student or teacher allowed
    const safeRole = role === 'teacher' ? 'teacher' : 'student';
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      // Send verification email
      try {
        await sendEmailVerification(cred.user);
      } catch { /* non-blocking */ }

      let referrerId: string | null = null;
      const normalizedCode = (referralCode || '').trim().toUpperCase();
      if (normalizedCode) {
        const refSnap = await getDocs(query(collection(db, 'users'), where('referral_code', '==', normalizedCode), limit(1)));
        referrerId = refSnap.empty ? null : refSnap.docs[0].id;
      }

      await setDoc(doc(db, 'users', cred.user.uid), {
        name,
        email,
        role: safeRole,
        status: 'pending',
        referral_code: generateReferralCode(name),
        referred_by: referrerId,
        referral_count: 0,
        last_login_at: serverTimestamp(),
        created_at: serverTimestamp(),
      });
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
      return err?.message || 'Signup failed. Please try again';
    }
  };

  const resendVerification = async (): Promise<string | null> => {
    if (!auth.currentUser) return 'Not signed in';
    try {
      await sendEmailVerification(auth.currentUser);
      return null;
    } catch (err: any) {
      if (err?.code === 'auth/too-many-requests') return 'Please wait before requesting another email';
      return err?.message || 'Failed to send verification email';
    }
  };

  const resetPassword = async (email: string): Promise<string | null> => {
    try {
      await sendPasswordResetEmail(auth, email);
      return null;
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') return 'No account found with this email';
      if (code === 'auth/invalid-email') return 'Invalid email format';
      if (code === 'auth/too-many-requests') return 'Please wait before requesting another email';
      if (code === 'auth/network-request-failed') return 'Network error. Check your internet connection';
      return err?.message || 'Failed to send reset email';
    }
  };

  const signOutUser = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{
      user, profile, authLoading, emailVerified,
      signIn, signUp, signOut: signOutUser, refreshProfile,
      resendVerification, resetPassword, refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
