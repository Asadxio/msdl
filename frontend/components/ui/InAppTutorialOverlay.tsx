import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Modal, I18nManager } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '@/constants/theme';
import { useTutorial, type TutorialScreen } from '@/context/TutorialContext';
import { markTutorialCompleted } from '@/lib/tutorialStorage';

const TUTORIAL_STEPS: Record<TutorialScreen, { title: string; desc: string; icon: string }> = {
  dashboard: { title: 'Dashboard', desc: 'Your learning hub. View courses, live classes, and announcements.', icon: 'home-outline' },
  courses: { title: 'Courses', desc: 'Explore and enroll in Islamic courses. Track your progress.', icon: 'school-outline' },
  live_classes: { title: 'Live Classes', desc: 'Join live interactive classes with teachers in real-time.', icon: 'videocam-outline' },
  notifications: { title: 'Notifications', desc: 'Get updates on classes, deadlines, and important announcements.', icon: 'notifications-outline' },
  applications: { title: 'Applications', desc: 'Access Islamic tools like Prayer Times, Qibla, and Islamic Calendar.', icon: 'apps-outline' },
};

const STEP_ORDER: TutorialScreen[] = ['dashboard', 'courses', 'live_classes', 'notifications', 'applications'];

export function InAppTutorialOverlay() {
  const insets = useSafeAreaInsets();
  const { showTutorial, setShowTutorial, currentStep, setCurrentStep, markStepComplete } = useTutorial();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const rtl = I18nManager.isRTL;

  useEffect(() => {
    if (showTutorial && currentStep) {
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    } else {
      Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    }
  }, [showTutorial, currentStep, fadeAnim]);

  if (!showTutorial || !currentStep) return null;

  const step = TUTORIAL_STEPS[currentStep];
  const stepIndex = STEP_ORDER.indexOf(currentStep);
  const isLast = stepIndex === STEP_ORDER.length - 1;

  const next = () => {
    markStepComplete(currentStep);
    if (isLast) {
      markTutorialCompleted().catch(() => {});
      setShowTutorial(false);
      setCurrentStep(null);
      return;
    }
    const nextStep = STEP_ORDER[stepIndex + 1];
    setCurrentStep(nextStep);
  };

  const skip = () => {
    markTutorialCompleted().catch(() => {});
    setShowTutorial(false);
    setCurrentStep(null);
  };

  return (
    <Modal transparent visible={showTutorial} animationType="fade">
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <TouchableOpacity style={styles.backdrop} onPress={skip} activeOpacity={1} />
        <View style={[styles.card, { paddingTop: insets.top + SPACING.md }]}>
          <View style={styles.header}>
            <Ionicons name={step.icon as any} size={40} color={COLORS.primary} />
            <TouchableOpacity onPress={skip} style={styles.closeBtn}>
              <Ionicons name="close-circle" size={24} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.title, rtl ? { textAlign: 'right' } : {}]}>{step.title}</Text>
          <Text style={[styles.desc, rtl ? { textAlign: 'right' } : {}]}>{step.desc}</Text>

          <View style={styles.progressRow}>
            {STEP_ORDER.map((_, i) => (
              <View key={i} style={[styles.dot, i <= stepIndex ? styles.dotActive : {}]} />
            ))}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity onPress={skip} style={styles.skipBtn}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={next} style={styles.nextBtn}>
              <Text style={styles.nextText}>{isLast ? 'Done' : 'Next'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#FFFFFF', paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  closeBtn: { padding: 4 },
  title: { ...TYPOGRAPHY.title, color: COLORS.primary, marginBottom: SPACING.sm },
  desc: { ...TYPOGRAPHY.body, color: COLORS.textMuted, marginBottom: SPACING.md, lineHeight: 22 },
  progressRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: SPACING.md },
  dot: { width: 6, height: 6, borderRadius: 6, backgroundColor: 'rgba(6,78,59,0.2)' },
  dotActive: { backgroundColor: COLORS.primary, width: 12 },
  actions: { flexDirection: 'row', gap: SPACING.md },
  skipBtn: { flex: 1, paddingVertical: 12, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border },
  skipText: { textAlign: 'center', fontWeight: '600', color: COLORS.textMuted },
  nextBtn: { flex: 1, paddingVertical: 12, borderRadius: RADIUS.full, backgroundColor: COLORS.primary },
  nextText: { textAlign: 'center', fontWeight: '700', color: '#fff' },
});
