import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

export function usePresence() {
  const { user } = useAuth();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    if (!user?.uid) return;

    const updatePresence = async (isOnline: boolean) => {
      try {
        await setDoc(doc(db, 'presence', user.uid), {
          is_online: isOnline,
          last_seen: serverTimestamp(),
          device_type: Platform.OS,
        });
      } catch (error) {
        // Silently fail if offline or permissions issue
      }
    };

    // Set online on mount
    void updatePresence(true);

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        void updatePresence(true);
      } else if (
        appState.current === 'active' &&
        nextAppState.match(/inactive|background/)
      ) {
        void updatePresence(false);
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
      void updatePresence(false);
    };
  }, [user?.uid]);
}
