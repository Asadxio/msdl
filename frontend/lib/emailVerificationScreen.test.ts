import fs from 'fs';
import path from 'path';

const screenPath = path.join(__dirname, '../app/auth/pending.tsx');
const authContextPath = path.join(__dirname, '../context/AuthContext.tsx');
const source = fs.readFileSync(screenPath, 'utf8');
const authSource = fs.readFileSync(authContextPath, 'utf8');

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
    expect(source).toContain('await sendEmailVerification(currentUser);');
    expect(source).toContain('Verification email sent');
    expect(source).toContain('Verification email resend failed');
    expect(source).toContain("Alert.alert('Email Sent'");
    expect(source).toContain("Alert.alert('Error'");
  });

  it('always reloads Firebase Auth user state before checking email verification', () => {
    expect(source).toContain('await currentUser.reload();');
    expect(source).toContain('Boolean(auth.currentUser?.emailVerified)');
    expect(source).toContain("'Email not verified yet. Please verify and try again.'");
    expect(source).toContain("setInterval(() => {");
    expect(source).toContain('VERIFICATION_POLL_MS = 15000');
  });

  it('redirects verified users and signed-out users to the expected routes', () => {
    expect(source).toContain("router.replace('/');");
    expect(source).toContain("router.replace('/auth/login');");
    expect(source).toContain('Navigation triggered');
  });

  it('clears local profile cache on sign out and refreshes auth from currentUser.reload', () => {
    expect(authSource).toContain('await auth.currentUser.reload();');
    expect(authSource).toContain('AsyncStorage.removeItem(getProfileCacheKey(uid))');
    expect(authSource).toContain('setProfileOffline(false);');
  });
});
