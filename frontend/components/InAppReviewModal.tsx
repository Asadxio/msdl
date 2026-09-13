/**
 * InAppReviewModal.tsx
 * Polite and respectful In-App Review & Rating Modal for Madrasatu-s-Salikat.
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import {
  openGooglePlayStore,
  recordReviewPromptShown,
} from '@/lib/inAppReview';

interface InAppReviewModalProps {
  visible: boolean;
  onClose: () => void;
  onFeedback?: () => void;
}

export function InAppReviewModal({
  visible,
  onClose,
  onFeedback,
}: InAppReviewModalProps) {
  if (!visible) return null;

  const handleRate = async () => {
    onClose();
    await openGooglePlayStore();
  };

  const handleLater = async () => {
    await recordReviewPromptShown();
    onClose();
  };

  const handleFeedback = () => {
    onClose();
    if (onFeedback) {
      onFeedback();
    }
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={handleLater}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="star" size={38} color="#F59E0B" />
          </View>

          <Text style={styles.title}>Loving Madrasatu-s-Salikat? 🌟</Text>
          <Text style={styles.message}>
            Your 5-star review on Google Play helps more Muslim sisters discover and benefit from authentic Islamic education.
          </Text>

          <TouchableOpacity style={styles.primaryButton} onPress={handleRate} activeOpacity={0.85}>
            <Ionicons name="logo-google-playstore" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.primaryButtonText}>Rate 5 Stars on Google Play</Text>
          </TouchableOpacity>

          {onFeedback && (
            <TouchableOpacity style={styles.secondaryButton} onPress={handleFeedback} activeOpacity={0.7}>
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={COLORS.primary} style={{ marginRight: 6 }} />
              <Text style={styles.secondaryButtonText}>Send Direct Feedback</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.laterButton} onPress={handleLater} activeOpacity={0.7}>
            <Text style={styles.laterButtonText}>Maybe Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    ...SHADOWS.card,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textMain,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  primaryButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 13,
    borderRadius: RADIUS.lg,
    marginBottom: 8,
    ...SHADOWS.header,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: '#F1F5F9',
    marginBottom: 4,
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  laterButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  laterButtonText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
});
