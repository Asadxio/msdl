import fs from 'fs';
import path from 'path';

const authContextPath = path.join(__dirname, '../context/AuthContext.tsx');
const source = fs.readFileSync(authContextPath, 'utf8');

describe('auth startup freeze protections', () => {
  it('clears auth loading from a finally block in onAuthStateChanged', () => {
    expect(source).toContain('authUnsub = onAuthStateChanged(auth, async (firebaseUser) => {');
    expect(source).toContain('} finally {');
    const finallyIndex = source.indexOf('} finally {');
    const finallyBody = source.slice(finallyIndex, source.indexOf('\n    });', finallyIndex));
    expect(finallyBody).toContain("clearAuthLoader('auth-state-callback')");
    expect(source).toContain('setAuthLoading(false);');
    expect(source).toContain("startupLog('Loader cleared'");
  });

  it('has a 5-second watchdog that clears the loader and uses cached/offline state', () => {
    expect(source).toContain('const AUTH_STARTUP_WATCHDOG_MS = 5000;');
    expect(source).toContain('setTimeout(() => {');
    expect(source).toContain('Auth startup watchdog elapsed; continuing with cached/offline state');
    expect(source).toContain("startupLog('Auth startup watchdog fired'");
    expect(source).toContain("clearAuthLoader('watchdog')");
    expect(source).toContain("applyCachedProfile(currentUser.uid, 'auth.watchdogCachedProfile')");
  });

  it('uses timeout protection for cached profile reads and direct Firestore profile lookups', () => {
    expect(source).toContain('const PROFILE_CACHE_TIMEOUT_MS = 1200;');
    expect(source).toContain('const PROFILE_LOOKUP_TIMEOUT_MS = 8000;');
    expect(source).toContain('withTimeout(AsyncStorage.getItem(getProfileCacheKey(uid)), PROFILE_CACHE_TIMEOUT_MS)');
    expect(source).toContain("withTimeout(getDoc(doc(db, 'users', uid)), PROFILE_LOOKUP_TIMEOUT_MS)");
  });

  it('preserves cache parsing fallback for corrupted cache and returning users', () => {
    expect(source).toContain('parseCachedProfile');
    expect(source).toContain('Ignoring invalid cached profile');
    expect(source).toContain('return null;');
    expect(source).toContain("applyCachedProfile(firebaseUser.uid, 'auth.cachedRealtime')");
    expect(source).toContain('setProfileOffline(true);');
  });


  it('has a timeout for onboarding gate checks so first launch cannot remain behind the splash screen', () => {
    const layoutSource = fs.readFileSync(path.join(__dirname, '../app/_layout.tsx'), 'utf8');
    expect(layoutSource).toContain('const ONBOARDING_GATE_TIMEOUT_MS = 2500;');
    expect(layoutSource).toContain("startupLog('Onboarding gate timeout scheduled'");
    expect(layoutSource).toContain("startupLog('Onboarding gate timed out; continuing startup'");
    expect(layoutSource).toContain("setOnboardingStatus('complete')");
  });

  it('logs startup milestones for APK logcat investigation', () => {
    const firebaseSource = fs.readFileSync(path.join(__dirname, 'firebase.ts'), 'utf8');
    const layoutSource = fs.readFileSync(path.join(__dirname, '../app/_layout.tsx'), 'utf8');
    expect(firebaseSource).toContain("startupLog('Firebase initialized'");
    expect(firebaseSource).toContain("startupLog('Firebase Auth initialized'");
    expect(source).toContain("startupLog('Auth restored'");
    expect(source).toContain("startupLog('Profile loaded'");
    expect(layoutSource).toContain("startupLog('Navigation complete'");
    expect(layoutSource).toContain("startupLog('Root loader cleared'");
    expect(layoutSource).toContain('SplashScreen.hideAsync()');
  });
});
