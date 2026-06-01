import fs from 'fs';
import path from 'path';

const authContextPath = path.join(__dirname, '../context/AuthContext.tsx');
const source = fs.readFileSync(authContextPath, 'utf8');

describe('auth startup freeze protections', () => {
  it('clears auth loading from a finally block in onAuthStateChanged', () => {
    expect(source).toContain('const unsub = onAuthStateChanged(auth, async (firebaseUser) => {');
    expect(source).toContain('} finally {');
    const finallyIndex = source.indexOf('} finally {');
    const finallyBody = source.slice(finallyIndex, source.indexOf('\n    });', finallyIndex));
    expect(finallyBody).toContain('clearAuthLoader();');
    expect(source).toContain('setAuthLoading(false);');
  });

  it('has a 5-second watchdog that clears the loader and uses cached/offline state', () => {
    expect(source).toContain('const AUTH_STARTUP_WATCHDOG_MS = 5000;');
    expect(source).toContain('setTimeout(() => {');
    expect(source).toContain('Auth startup watchdog elapsed; continuing with cached/offline state');
    expect(source).toContain('clearAuthLoader();');
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
});
