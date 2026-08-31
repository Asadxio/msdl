import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  StatusBar,
  Alert,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { goBackOrReplace } from '@/lib/navigation';
import {
  loadTasbeehStats,
  recordTasbeehTap,
  recordTasbeehLap,
  resetDailyTasbeeh,
  type TasbeehStats,
} from '@/lib/tasbeehStorage';

export interface DhikrPreset {
  id: string;
  arabic: string;
  transliteration: string;
  meaning: string;
  target: number;
  virtue?: string;
}

export const DHIKR_PRESETS: DhikrPreset[] = [
  {
    id: 'fatima',
    arabic: 'تَسْبِيحِ فَاطِمَة',
    transliteration: 'Tasbeeh-e-Fatima',
    meaning: '33x SubhanAllah • 33x Alhamdulillah • 34x Allahu Akbar',
    target: 33,
    virtue: 'Sunnah after every Fardh Salah & before sleeping',
  },
  {
    id: 'subhanallah',
    arabic: 'سُبْحَانَ اللَّهِ',
    transliteration: 'SubhanAllah',
    meaning: 'Glory be to Allah',
    target: 33,
    virtue: 'Planting a tree in Jannah for each recitation',
  },
  {
    id: 'alhamdulillah',
    arabic: 'الْحَمْدُ لِلَّهِ',
    transliteration: 'Alhamdulillah',
    meaning: 'All praise is due to Allah',
    target: 33,
    virtue: 'Fills the scale of good deeds with light',
  },
  {
    id: 'allahuakbar',
    arabic: 'اللَّهُ أَكْبَرُ',
    transliteration: 'Allahu Akbar',
    meaning: 'Allah is the Greatest',
    target: 34,
    virtue: 'Declaring the supreme greatness of the Creator',
  },
  {
    id: 'astaghfirullah',
    arabic: 'أَسْتَغْفِرُ اللَّهَ',
    transliteration: 'Astaghfirullah',
    meaning: 'I seek forgiveness from Allah',
    target: 100,
    virtue: 'Opens the doors of Rizq, relief, and peace of heart',
  },
  {
    id: 'darood',
    arabic: 'اللَّهُمَّ صَلِّ عَلَىٰ مُحَمَّدٍ',
    transliteration: 'Allahumma Salli Ala Muhammad',
    meaning: 'O Allah, send blessings upon our Master Muhammad',
    target: 100,
    virtue: '10 blessings & 10 sins forgiven for each Salawat',
  },
  {
    id: 'kalima',
    arabic: 'لَا إِلٰهَ إِلَّا اللَّهُ',
    transliteration: 'La ilaha illallah',
    meaning: 'None has the right to be worshipped except Allah',
    target: 100,
    virtue: 'The best form of Dhikr (Afdal-uz-Zikr)',
  },
  {
    id: 'lahawla',
    arabic: 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ',
    transliteration: 'La Hawla Wa La Quwwata Illa Billah',
    meaning: 'There is no power nor strength except with Allah',
    target: 100,
    virtue: 'A treasure from the treasures of Paradise',
  },
  {
    id: 'custom',
    arabic: 'ذِكْرٌ مُخَصَّصٌ',
    transliteration: 'Custom Dhikr',
    meaning: 'User defined target count',
    target: 100,
    virtue: 'Daily personal Wazeefa and Zikr',
  },
];

export default function DigitalTasbeehScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Selected Preset
  const [selectedPresetId, setSelectedPresetId] = useState<string>('fatima');
  const [fatimaStep, setFatimaStep] = useState<number>(0); // 0: SubhanAllah (33), 1: Alhamdulillah (33), 2: Allahu Akbar (34)
  const [customTarget, setCustomTarget] = useState<number>(100);
  const [customTargetInput, setCustomTargetInput] = useState<string>('100');
  const [showCustomModal, setShowCustomModal] = useState<boolean>(false);

  // Counter State
  const [count, setCount] = useState<number>(0);
  const [laps, setLaps] = useState<number>(0);
  const [hapticsEnabled, setHapticsEnabled] = useState<boolean>(true);

  // Statistics
  const [stats, setStats] = useState<TasbeehStats>({
    todayCount: 0,
    lifetimeCount: 0,
    lastActiveDate: new Date().toISOString().slice(0, 10),
    streakDays: 1,
    lapsCompleted: 0,
  });

  // Animation
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Load Initial Stats
  useEffect(() => {
    loadTasbeehStats().then((s) => setStats(s));
  }, []);

  const activePreset = useMemo(() => {
    return DHIKR_PRESETS.find((p) => p.id === selectedPresetId) || DHIKR_PRESETS[0];
  }, [selectedPresetId]);

  // Current display details for Fatima auto-flow
  const currentDhikrInfo = useMemo(() => {
    if (selectedPresetId === 'fatima') {
      if (fatimaStep === 0) {
        return {
          arabic: 'سُبْحَانَ اللَّهِ',
          transliteration: 'SubhanAllah (1/3)',
          meaning: 'Glory be to Allah',
          target: 33,
        };
      } else if (fatimaStep === 1) {
        return {
          arabic: 'الْحَمْدُ لِلَّهِ',
          transliteration: 'Alhamdulillah (2/3)',
          meaning: 'All praise is due to Allah',
          target: 33,
        };
      } else {
        return {
          arabic: 'اللَّهُ أَكْبَرُ',
          transliteration: 'Allahu Akbar (3/3)',
          meaning: 'Allah is the Greatest',
          target: 34,
        };
      }
    }

    if (selectedPresetId === 'custom') {
      return {
        ...activePreset,
        target: customTarget,
      };
    }

    return activePreset;
  }, [selectedPresetId, fatimaStep, customTarget, activePreset]);

  // Handle Tap on the bead
  const handleBeadTap = async () => {
    // 1. Spring scale animation
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.93,
        duration: 40,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 80,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Haptic feedback
    if (hapticsEnabled && Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    // 3. Update count & storage
    const nextCount = count + 1;
    setCount(nextCount);
    const updatedStats = await recordTasbeehTap(1);
    setStats(updatedStats);

    // 4. Check target reached
    if (nextCount >= currentDhikrInfo.target) {
      if (hapticsEnabled && Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }

      if (selectedPresetId === 'fatima') {
        if (fatimaStep < 2) {
          // Advance step in Tasbeeh-e-Fatima
          setFatimaStep((prev) => prev + 1);
          setCount(0);
        } else {
          // Completed full 100 cycle
          setFatimaStep(0);
          setCount(0);
          setLaps((prev) => prev + 1);
          await recordTasbeehLap();
          Alert.alert('MashaAllah! 🌟', 'You have completed the full Tasbeeh-e-Fatima (100 Dhikr)!');
        }
      } else {
        // Standard preset target completed
        setCount(0);
        setLaps((prev) => prev + 1);
        await recordTasbeehLap();
      }
    }
  };

  // Reset current counter
  const handleResetCounter = () => {
    Alert.alert('Reset Counter', 'Do you want to reset the current session count to 0?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          setCount(0);
          setFatimaStep(0);
        },
      },
    ]);
  };

  // Switch Preset
  const handleSelectPreset = (presetId: string) => {
    if (presetId === 'custom') {
      setShowCustomModal(true);
    }
    setSelectedPresetId(presetId);
    setCount(0);
    setFatimaStep(0);
  };

  const progressRatio = Math.min(1, count / currentDhikrInfo.target);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#062F24" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => goBackOrReplace(router, '/(tabs)')}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Digital Smart Tasbeeh</Text>
          <Text style={styles.headerSub}>Daily Dhikr & Azkar Counter</Text>
        </View>
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={() => setHapticsEnabled(!hapticsEnabled)}
        >
          <Ionicons
            name={hapticsEnabled ? 'phone-portrait' : 'phone-portrait-outline'}
            size={20}
            color={hapticsEnabled ? COLORS.secondary : '#FFF'}
          />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Presets Horizontal Strip */}
        <View style={styles.presetSection}>
          <Text style={styles.presetSectionLabel}>SELECT DHIKR PRESET</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.presetsRow}
          >
            {DHIKR_PRESETS.map((p) => {
              const isSelected = selectedPresetId === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.presetChip, isSelected && styles.presetChipActive]}
                  onPress={() => handleSelectPreset(p.id)}
                >
                  <Text style={[styles.presetChipArabic, isSelected && styles.presetChipArabicActive]}>
                    {p.arabic}
                  </Text>
                  <Text style={[styles.presetChipText, isSelected && styles.presetChipTextActive]}>
                    {p.transliteration} ({p.id === 'custom' ? customTarget : p.target})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Active Dhikr Display Card */}
        <View style={styles.dhikrCard}>
          <Text style={styles.arabicCalligraphy}>{currentDhikrInfo.arabic}</Text>
          <Text style={styles.transliterationText}>{currentDhikrInfo.transliteration}</Text>
          <Text style={styles.meaningText}>"{currentDhikrInfo.meaning}"</Text>

          {activePreset.virtue ? (
            <View style={styles.virtueBadge}>
              <Ionicons name="sparkles" size={13} color={COLORS.secondary} />
              <Text style={styles.virtueText} numberOfLines={1}>
                {activePreset.virtue}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Central Tactile Bead Counter */}
        <View style={styles.counterCenterWrapper}>
          {/* Outer Ring */}
          <View style={styles.outerRing}>
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <TouchableOpacity
                style={styles.beadCircle}
                activeOpacity={0.88}
                onPress={handleBeadTap}
              >
                <Text style={styles.countNumber}>{count}</Text>
                <Text style={styles.targetLabel}>TARGET: {currentDhikrInfo.target}</Text>

                {/* Progress Bar inside Bead */}
                <View style={styles.miniProgressBar}>
                  <View style={[styles.miniProgressFill, { width: `${progressRatio * 100}%` }]} />
                </View>

                <Text style={styles.tapPrompt}>TAP ANYWHERE TO COUNT</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Laps / Rounds Pill */}
          <View style={styles.lapsRow}>
            <View style={styles.lapBadge}>
              <Ionicons name="repeat-outline" size={14} color={COLORS.primary} />
              <Text style={styles.lapBadgeText}>Rounds Completed: {laps}</Text>
            </View>
            <TouchableOpacity style={styles.resetBtn} onPress={handleResetCounter}>
              <Ionicons name="refresh" size={16} color={COLORS.textSecondary} />
              <Text style={styles.resetBtnText}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Daily & Lifetime Stats Summary Banner */}
        <View style={styles.statsCard}>
          <View style={styles.statCol}>
            <Text style={styles.statValue}>{stats.todayCount}</Text>
            <Text style={styles.statLabel}>Today's Dhikr</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <Text style={styles.statValue}>{stats.streakDays} Days</Text>
            <Text style={styles.statLabel}>Daily Streak</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <Text style={styles.statValue}>{stats.lifetimeCount}</Text>
            <Text style={styles.statLabel}>Lifetime Total</Text>
          </View>
        </View>
      </ScrollView>

      {/* Custom Target Modal */}
      <Modal
        visible={showCustomModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowCustomModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Set Custom Target</Text>
              <TouchableOpacity onPress={() => setShowCustomModal(false)}>
                <Ionicons name="close" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>Enter desired number of recitations (e.g. 100, 313, 1000):</Text>
            <TextInput
              style={styles.customInput}
              keyboardType="number-pad"
              value={customTargetInput}
              onChangeText={setCustomTargetInput}
              placeholder="100"
              placeholderTextColor={COLORS.textMuted}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowCustomModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={() => {
                  const val = parseInt(customTargetInput, 10);
                  if (val && val > 0) {
                    setCustomTarget(val);
                    setCount(0);
                    setShowCustomModal(false);
                  } else {
                    Alert.alert('Invalid Target', 'Please enter a number greater than 0.');
                  }
                }}
              >
                <Text style={styles.modalSaveText}>Set Target</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#062F24',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: '#062F24',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(200, 168, 78, 0.2)',
  },
  backBtn: {
    padding: 6,
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  headerSub: {
    fontSize: 11,
    color: COLORS.secondary,
    marginTop: 1,
  },
  headerIconBtn: {
    padding: 6,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  presetSection: {
    marginTop: SPACING.md,
    gap: 8,
  },
  presetSectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.secondary,
    letterSpacing: 0.8,
    paddingHorizontal: SPACING.lg,
  },
  presetsRow: {
    paddingHorizontal: SPACING.lg,
    gap: 8,
  },
  presetChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
  },
  presetChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.secondary,
  },
  presetChipArabic: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '700',
    marginBottom: 2,
  },
  presetChipArabicActive: {
    color: '#FFF',
  },
  presetChipText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600',
  },
  presetChipTextActive: {
    color: COLORS.secondary,
  },
  dhikrCard: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    backgroundColor: '#0A3B2E',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(200, 168, 78, 0.3)',
    ...SHADOWS.card,
  },
  arabicCalligraphy: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
    lineHeight: 38,
    marginBottom: 6,
  },
  transliterationText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 4,
  },
  meaningText: {
    fontSize: 12,
    color: '#D1E0D9',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 10,
  },
  virtueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(200, 168, 78, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    gap: 6,
  },
  virtueText: {
    fontSize: 11,
    color: '#E8D28B',
    fontWeight: '600',
  },
  counterCenterWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: SPACING.xl,
  },
  outerRing: {
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 4,
    borderColor: 'rgba(200, 168, 78, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 95, 70, 0.3)',
  },
  beadCircle: {
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.secondary,
    ...SHADOWS.card,
  },
  countNumber: {
    fontSize: 54,
    fontWeight: '900',
    color: '#FFF',
    lineHeight: 60,
  },
  targetLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.secondary,
    letterSpacing: 0.8,
    marginTop: 2,
  },
  miniProgressBar: {
    width: 100,
    height: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: RADIUS.full,
    marginTop: 10,
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: '100%',
    backgroundColor: COLORS.secondary,
  },
  tapPrompt: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: 0.6,
    marginTop: 10,
  },
  lapsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: SPACING.md,
  },
  lapBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    gap: 6,
  },
  lapBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    gap: 4,
  },
  resetBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  statsCard: {
    marginHorizontal: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0A3B2E',
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statCol: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFF',
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.secondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 400,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textMain,
  },
  modalSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  customInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textMain,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  modalSaveBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
  },
  modalSaveText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
});
