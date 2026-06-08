import fs from 'fs';
import path from 'path';

const screenPath = path.join(__dirname, '../app/auth/pending.tsx');
const authContextPath = path.join(__dirname, '../context/AuthContext.tsx');
const layoutPath = path.join(__dirname, '../app/_layout.tsx');
const source = fs.readFileSync(screenPath, 'utf8');
const authSource = fs.readFileSync(authContextPath, 'utf8');
const layoutSource = fs.readFileSync(layoutPath, 'utf8');

describe('email verification pending screen audit', () => {
  it('wires all verification buttons to explicit handlers with loading labels and disabled state', () => {
    expect(source).toContain('onPress={handleResendVerification}');
    expect(source).toContain('onPress={handleCheck}');
    expect(source).toContain('onPress={handleSignOut}');
    expect(source).toContain("resending ? 'Sending...' : 'Resend Verification Email'");
    expect(source).toContain("checking ? 'Checking...' : 'Check Status'");
    expect(source).toContain("signingOut ? 'Signing Out...' : 'Sign Out'");
    expect(source).toContain('disabled={busy}');
  });

  it('resends verification through Firebase Auth and reports success or errors', () => {
    expect(source).toContain("import { sendEmailVerification } from 'firebase/auth';");
    expect(source).toContain('await withTimeout(sendEmailVerification(currentUser), FIREBASE_AUTH_ACTION_TIMEOUT_MS);');
    expect(source).toContain('Verification email sent');
    expect(source).toContain('Verification email resend failed');
    expect(source).toContain("Alert.alert('Email Sent'");
    expect(source).toContain("Alert.alert('Error'");
  });

  it('always reloads Firebase Auth user state before checking email verification', () => {
    expect(source).toContain('await withTimeout(currentUser.reload(), FIREBASE_AUTH_ACTION_TIMEOUT_MS);');
    expect(source).toContain('Boolean(auth.currentUser?.emailVerified)');
    expect(source).toContain("'Email not verified yet. Please verify and try again.'");
    expect(source).toContain('pollRef.current = setInterval(() => {');
    expect(source).toContain('VERIFICATION_POLL_MS = 15000');
  });

  it('redirects verified users and signed-out users to existing routes', () => {
    expect(source).toContain("router.replace('/');");
    expect(source).toContain("router.replace('/auth/login');");
    expect(layoutSource).toContain('<Stack.Screen name="auth/login"');
    expect(layoutSource).toContain('<Stack.Screen name="auth/pending"');
    expect(source).toContain('Navigation triggered');
  });

  it('clears local profile cache on sign out and refreshes auth without losing emailVerified', () => {
    expect(authSource).toContain('await auth.currentUser.reload();');
    expect(authSource).toContain('emailVerified: auth.currentUser.emailVerified');
    expect(authSource).toContain('AsyncStorage.removeItem(getProfileCacheKey(uid))');
    expect(authSource).toContain('setProfileOffline(false);');
  });

  it('does not add touch-blocking wrappers or overlays on the pending screen', () => {
    expect(source).not.toContain('Modal');
    expect(source).not.toContain('ScrollView');
    expect(source).not.toContain('pointerEvents');
    expect(source).not.toContain('zIndex');
    expect(source).not.toContain("position: 'absolute'");
  });

  it('guards race conditions, timeouts, and navigation loops found in production audit', () => {
    expect(source).toContain('verificationCheckInFlightRef');
    expect(source).toContain('authActionVersionRef');
    expect(source).toContain('FIREBASE_AUTH_ACTION_TIMEOUT_MS = 15000');
    expect(source).toContain('stopPolling();');
    expect(source).toContain("router.replace('/');");
    expect(layoutSource).not.toContain('profile-pending');
  });
});
