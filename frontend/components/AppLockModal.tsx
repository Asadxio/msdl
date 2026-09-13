/**
 * AppLockModal.tsx
 * Fullscreen Islamic Privacy & Purdah Security Lock Screen for Madrasatu-s-Salikat.
 * Integrates native Biometrics (Fingerprint/Face ID) and a custom 4-digit PIN pad.
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  BackHandler,
  StatusBar,
  Animated,
  Alert,
  Vibration,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import {
  verifyAppPin,
  authenticateWithBiometrics,
  isBiometricEnabled,
  checkBiometricCapabilities,
  isLockedOut,
  getRemainingLockoutSeconds,
  disableAppLock,
} from '@/lib/appLock';
import { useAuth } from '@/context/AuthContext';

interface AppLockModalProps {
  visible: boolean;
  onUnlock: () => void;
}

export function AppLockModal({ visible, onUnlock }: AppLockModalProps) {
  const { signOut } = useAuth();
  const [pin, setPin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [lockoutSecs, setLockoutSecs] = useState(0);
  const [hasBiometrics, setHasBiometrics] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Check biometric capability
  useEffect(() => {
    if (!visible) return;

    checkBiometricCapabilities().then(async (caps) => {
      const bioEnabled = await isBiometricEnabled();
      const available = caps.hasHardware && caps.isEnrolled && bioEnabled;
      setHasBiometrics(available);

      if (available && !isLockedOut()) {
        // Auto-trigger biometric prompt on lock screen appearance
        triggerBiometricAuth();
      }
    });
  }, [visible]);

  // Handle countdown if locked out
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isLockedOut()) {
      setLockoutSecs(getRemainingLockoutSeconds());
      timer = setInterval(() => {
        const remaining = getRemainingLockoutSeconds();
        setLockoutSecs(remaining);
        if (remaining <= 0) {
          if (timer) clearInterval(timer);
          setErrorMessage('');
        }
      }, 1000);
    } else {
      setLockoutSecs(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [errorMessage]);

  // Intercept Android hardware back button
  useEffect(() => {
    if (visible) {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        return true; // prevent bypassing
      });
      return () => backHandler.remove();
    }
  }, [visible]);

  const triggerShake = () => {
    Vibration.vibrate([0, 50, 50, 50]);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const triggerBiometricAuth = useCallback(async () => {
    if (isLockedOut()) return;

    const res = await authenticateWithBiometrics(
      'Scan your fingerprint to unlock Madrasatu-s-Salikat'
    );
    if (res.success) {
      setPin('');
      setErrorMessage('');
      onUnlock();
    }
  }, [onUnlock]);

  const handleKeyPress = async (key: string) => {
    if (isLockedOut()) return;
    if (pin.length >= 4) return;

    const nextPin = pin + key;
    setPin(nextPin);
    setErrorMessage('');

    if (nextPin.length === 4) {
      const isValid = await verifyAppPin(nextPin);
      if (isValid) {
        setPin('');
        setErrorMessage('');
        onUnlock();
      } else {
        triggerShake();
        setPin('');
        if (isLockedOut()) {
          setErrorMessage(`Too many failed attempts. Try again in ${getRemainingLockoutSeconds()}s.`);
        } else {
          setErrorMessage('Incorrect Security PIN. Please try again.');
        }
      }
    }
  };

  const handleDelete = () => {
    if (isLockedOut()) return;
    setPin((prev) => prev.slice(0, -1));
    setErrorMessage('');
  };

  const handleForgotPin = () => {
    Alert.alert(
      'Forgot Security PIN?',
      'If you have forgotten your 4-digit PIN, you can sign out of your account. Signing out will securely reset the app lock on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out & Reset Lock',
          style: 'destructive',
          onPress: async () => {
            await disableAppLock();
            onUnlock();
            try {
              await signOut();
            } catch {}
          },
        },
      ]
    );
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent={false} animationType="fade" statusBarTranslucent>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F2E9" />
      <View style={styles.container}>
        {/* Header Branding */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Ionicons name="shield-checkmark" size={36} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>Madrasatu-s-Salikat</Text>
          <Text style={styles.subtitle}>Protected for Your Privacy & Purdah</Text>
        </View>

        {/* PIN Dots Display */}
        <Animated.View style={[styles.dotsContainer, { transform: [{ translateX: shakeAnim }] }]}>
          {[0, 1, 2, 3].map((index) => {
            const isFilled = index < pin.length;
            return (
              <View
                key={index}
                style={[
                  styles.dot,
                  isFilled ? styles.dotFilled : styles.dotEmpty,
                  errorMessage ? styles.dotError : null,
                ]}
              />
            );
          })}
        </Animated.View>

        {/* Error / Lockout Message */}
        <View style={styles.messageBox}>
          {lockoutSecs > 0 ? (
            <Text style={styles.errorText}>
              Security lockout: Try again in {lockoutSecs} seconds
            </Text>
          ) : errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : (
            <Text style={styles.promptText}>Enter 4-Digit PIN to unlock</Text>
          )}
        </View>

        {/* Keypad Grid */}
        <View style={styles.keypad}>
          {[
            ['1', '2', '3'],
            ['4', '5', '6'],
            ['7', '8', '9'],
          ].map((row, rIdx) => (
            <View key={rIdx} style={styles.keypadRow}>
              {row.map((num) => (
                <TouchableOpacity
                  key={num}
                  style={styles.keyButton}
                  onPress={() => handleKeyPress(num)}
                  disabled={lockoutSecs > 0}
                  activeOpacity={0.65}
                >
                  <Text style={styles.keyText}>{num}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}

          {/* Bottom row: Biometric, 0, Backspace */}
          <View style={styles.keypadRow}>
            {hasBiometrics ? (
              <TouchableOpacity
                style={[styles.keyButton, styles.bioButton]}
                onPress={triggerBiometricAuth}
                disabled={lockoutSecs > 0}
                activeOpacity={0.65}
              >
                <Ionicons name="finger-print" size={28} color={COLORS.primary} />
              </TouchableOpacity>
            ) : (
              <View style={styles.keyButtonPlaceholder} />
            )}

            <TouchableOpacity
              style={styles.keyButton}
              onPress={() => handleKeyPress('0')}
              disabled={lockoutSecs > 0}
              activeOpacity={0.65}
            >
              <Text style={styles.keyText}>0</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.keyButton, styles.deleteButton]}
              onPress={handleDelete}
              disabled={lockoutSecs > 0 || pin.length === 0}
              activeOpacity={0.65}
            >
              <Ionicons name="backspace-outline" size={24} color={pin.length > 0 ? COLORS.textMain : '#CBD5E1'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Forgot PIN Action */}
        <TouchableOpacity style={styles.forgotBtn} onPress={handleForgotPin} activeOpacity={0.7}>
          <Text style={styles.forgotText}>Forgot PIN?</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F2E9',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#E8F5EE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    borderWidth: 1.5,
    borderColor: '#C8E6D3',
    ...SHADOWS.header,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textMain,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: SPACING.md,
    height: 24,
    alignItems: 'center',
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  dotEmpty: {
    borderWidth: 2,
    borderColor: '#94A3B8',
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: COLORS.primary,
  },
  dotError: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  messageBox: {
    height: 24,
    marginBottom: SPACING.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  promptText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '600',
    textAlign: 'center',
  },
  keypad: {
    width: '100%',
    maxWidth: 280,
    gap: 14,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  keyButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.card,
  },
  keyButtonPlaceholder: {
    width: 72,
    height: 72,
  },
  keyText: {
    fontSize: 26,
    fontWeight: '600',
    color: COLORS.textMain,
  },
  bioButton: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  deleteButton: {
    backgroundColor: '#F8FAFC',
  },
  forgotBtn: {
    marginTop: SPACING.xl,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  forgotText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
