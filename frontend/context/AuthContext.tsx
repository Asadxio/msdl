import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export type UserProfile = {
  name: string;
  email: string;
  role: 'student' | 'teacher' | 'admin';
  status: 'pending' | 'approved';
};

type AuthContextType = {
  user: User | null;
  profile: UserProfile | null;
  authLoading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (name: string, email: string, password: string, role: 'student' | 'teacher') => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  authLoading: true,
  signIn: async () => null,
  signUp: async () => null,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

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
      await fetchProfile(cred.user.uid);
      return null;
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') return 'Invalid email or password';
      if (code === 'auth/wrong-password') return 'Invalid email or password';
      if (code === 'auth/invalid-email') return 'Invalid email format';
      if (code === 'auth/too-many-requests') return 'Too many attempts. Try again later';
      return err?.message || 'Login failed';
    }
  };

  const signUp = async (
    name: string, email: string, password: string, role: 'student' | 'teacher'
  ): Promise<string | null> => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, 'users', cred.user.uid), {
        name,
        email,
        role,
        status: 'pending',
        created_at: serverTimestamp(),
      });
      await fetchProfile(cred.user.uid);
      return null;
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/email-already-in-use') return 'Email already registered';
      if (code === 'auth/weak-password') return 'Password must be at least 6 characters';
      if (code === 'auth/invalid-email') return 'Invalid email format';
      return err?.message || 'Signup failed';
    }
  };

  const signOutUser = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{
      user, profile, authLoading,
      signIn, signUp, signOut: signOutUser, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
