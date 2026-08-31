import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
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
  queueTasbeehTap,
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
  const [fatimaStep, setFatimaStep] = useState<number>(0); // 0: SubhanAllah, 1: Alhamdulillah, 2: Allahu Akbar
  const [customTarget, setCustomTarget] = useState<number>(100);
  const [customTargetInput, setCustomTargetInput] = useState<string>('100');
  const [showCustomModal, setShowCustomModal] = useState<boolean>(false);

  // Counter State
  const [count, setCount] = useState<number>(0);
  const [laps, setLaps] = useState<number>(0);
  const [hapticsMode, setHapticsMode] = useState<'light' | 'medium' | 'off'>('light');
  const [fullScreenMode, setFullScreenMode] = useState<boolean>(false);

  // Statistics
  const [stats, setStats] = useState<TasbeehStats>({
    todayCount: 0,
    lifetimeCount: 0,
    lastActiveDate: new Date().toISOString().slice(0, 10),
    streakDays: 1,
    lapsCompleted: 0,
  });

  // Animation Refs
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rippleAnim = useRef(new Animated.Value(0)).current;

  // Load Initial Stats
  useEffect(() => {
    loadTasbeehStats().then((s) => setStats(s));
  }, []);

  const activePreset = useMemo(() => {
    return DHIKR_PRESETS.find((p) => p.id === selectedPresetId) || DHIKR_PRESETS[0];
  }, [selectedPresetId]);

  // Current display details
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

  // Ultra-Fast Zero-Lag Tap Handler
  const handleFastTap = useCallback(() => {
    // 1. Instant Haptic Trigger
    if (hapticsMode !== 'off' && Platform.OS !== 'web') {
      const style =
        hapticsMode === 'medium'
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light;
      Haptics.impactAsync(style).catch(() => {});
    }

    // 2. Micro Pulse Animation (non-blocking)
    scaleAnim.setValue(0.95);
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start();

    // 3. Instant In-Memory Buffered Stat Update
    const updatedStats = queueTasbeehTap(1);
    setStats(updatedStats);

    // 4. Functional Count State Update
    setCount((prevCount) => {
      const nextCount = prevCount + 1;
      const target = currentDhikrInfo.target;

      if (nextCount >= target) {
        // Target achieved!
        if (hapticsMode !== 'off' && Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }

        if (selectedPresetId === 'fatima') {
          if (fatimaStep < 2) {
            setFatimaStep((step) => step + 1);
            return 0;
          } else {
            // Full 100 complete
            setFatimaStep(0);
            setLaps((l) => l + 1);
            recordTasbeehLap();
            Alert.alert('MashaAllah! 🌟', 'Completed full Tasbeeh-e-Fatima (100 Azkar)!');
            return 0;
          }
        } else {
          setLaps((l) => l + 1);
          recordTasbeehLap();
          return 0;
        }
      }

      return nextCount;
    });
  }, [hapticsMode, currentDhikrInfo.target, selectedPresetId, fatimaStep, scaleAnim]);

  // Manual Decrement (-1)
  const handleDecrement = () => {
    if (count > 0) {
      setCount((prev) => prev - 1);
      if (hapticsMode !== 'off' && Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    }
  };

  // Reset current counter
  const handleResetCounter = () => {
    Alert.alert('Reset Counter', 'Do you want to reset current session count to 0?', [
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

  const handleSelectPreset = (preset: DhikrPreset) => {
    if (preset.id === 'custom') {
      setShowCustomModal(true);
    } else {
      setSelectedPresetId(preset.id);
      setFatimaStep(0);
      setCount(0);
    }
  };

  const handleSaveCustomTarget = () => {
    const parsed = parseInt(customTargetInput, 10);
    if (isNaN(parsed) || parsed <= 0 || parsed > 99999) {
      Alert.alert('Invalid Target', 'Please enter a target number between 1 and 99,999.');
      return;
    }
    setCustomTarget(parsed);
    setSelectedPresetId('custom');
    setCount(0);
    setShowCustomModal(false);
  };

  // Target progress percentage (0 to 100)
  const progressPct = Math.min(
    100,
    Math.round((count / (currentDhikrInfo.target || 1)) * 100)
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#003D2E" />

      {/* ─── Top Header Bar ─── */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => goBackOrReplace(router, '/(tabs)')}
        >
          <Ionicons name="chevron-back" size={24} color="#C8A84E" />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Digital Smart Tasbeeh</Text>
          <Text style={styles.headerSub}>مِصْبَحَة الأَذْكَارِ الذَّكِيَّة</Text>
        </View>

        {/* Full Screen Mode Toggle */}
        <TouchableOpacity
          style={[styles.headerBtn, fullScreenMode && styles.headerBtnActive]}
          onPress={() => setFullScreenMode(!fullScreenMode)}
        >
          <Ionicons
            name={fullScreenMode ? 'scan' : 'expand'}
            size={20}
            color={fullScreenMode ? '#003D2E' : '#C8A84E'}
          />
        </TouchableOpacity>
      </View>

      {!fullScreenMode && (
        <>
          {/* ─── Dhikr Preset Selector Strip ─── */}
          <View style={styles.presetSection}>
            <Text style={styles.sectionHeader}>SELECT DHIKR PRESET</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.presetScroll}
            >
              {DHIKR_PRESETS.map((preset) => {
                const isSelected = selectedPresetId === preset.id;
                return (
                  <TouchableOpacity
                    key={preset.id}
                    style={[styles.presetCard, isSelected && styles.presetCardActive]}
                    onPress={() => handleSelectPreset(preset)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.presetArabic, isSelected && styles.presetArabicActive]}>
                      {preset.arabic}
                    </Text>
                    <Text style={[styles.presetTitle, isSelected && styles.presetTitleActive]}>
                      {preset.transliteration} ({preset.id === 'custom' ? customTarget : preset.target})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* ─── Active Dhikr Meaning Banner ─── */}
          <View style={styles.dhikrBanner}>
            <Text style={styles.bannerArabic}>{currentDhikrInfo.arabic}</Text>
            <Text style={styles.bannerTransliteration}>{currentDhikrInfo.transliteration}</Text>
            <Text style={styles.bannerMeaning}>"{currentDhikrInfo.meaning}"</Text>

            {activePreset.virtue ? (
              <View style={styles.virtuePill}>
                <Ionicons name="sparkles" size={13} color="#C8A84E" />
                <Text style={styles.virtueText}>{activePreset.virtue}</Text>
              </View>
            ) : null}
          </View>
        </>
      )}

      {/* ─── Main Interactive Counter Zone (Ultra-Fast Response) ─── */}
      <View style={styles.counterZone}>
        {/* Progress Bar Strip */}
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progressPct}%` }]} />
        </View>

        {/* Fast Pressable Arena */}
        <Pressable
          style={styles.pressableArena}
          onPress={handleFastTap}
          android_disableSound={false}
        >
          <Animated.View
            style={[
              styles.beadCircleOuter,
              { transform: [{ scale: scaleAnim }] },
            ]}
          >
            <View style={styles.beadCircleInner}>
              <Text style={styles.counterDigits}>{count}</Text>
              <Text style={styles.counterTargetLabel}>
                TARGET: {currentDhikrInfo.target} ({progressPct}%)
              </Text>
              <Text style={styles.tapPrompt}>⚡ TAP ANYWHERE TO COUNT</Text>
            </View>
          </Animated.View>
        </Pressable>

        {/* Counter Helper Controls */}
        <View style={styles.counterControls}>
          <TouchableOpacity style={styles.controlBtn} onPress={handleDecrement}>
            <Ionicons name="remove" size={20} color="#C8A84E" />
            <Text style={styles.controlBtnText}>-1 Undo</Text>
          </TouchableOpacity>

          <View style={styles.lapBadge}>
            <Ionicons name="sync" size={14} color="#C8A84E" />
            <Text style={styles.lapText}>Rounds: {laps}</Text>
          </View>

          <TouchableOpacity style={styles.controlBtn} onPress={handleResetCounter}>
            <Ionicons name="refresh" size={18} color="#EF4444" />
            <Text style={[styles.controlBtnText, { color: '#EF4444' }]}>Reset</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── Bottom Daily Stats & Streak Footer ─── */}
      {!fullScreenMode && (
        <View style={[styles.statsCard, { marginBottom: insets.bottom + 8 }]}>
          <View style={styles.statCol}>
            <Text style={styles.statNumber}>{stats.todayCount}</Text>
            <Text style={styles.statLabel}>Today's Dhikr</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <Text style={[styles.statNumber, { color: '#C8A84E' }]}>
              {stats.streakDays} Days
            </Text>
            <Text style={styles.statLabel}>Daily Streak 🔥</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <Text style={styles.statNumber}>{stats.lifetimeCount}</Text>
            <Text style={styles.statLabel}>Lifetime Total</Text>
          </View>
        </View>
      )}

      {/* ─── Custom Target Modal ─── */}
      <Modal visible={showCustomModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set Custom Target</Text>
            <Text style={styles.modalSub}>Enter the number of Dhikr recitations you want to complete:</Text>

            <TextInput
              style={styles.targetInput}
              keyboardType="number-pad"
              value={customTargetInput}
              onChangeText={setCustomTargetInput}
              placeholder="e.g. 100, 313, 1000"
              placeholderTextColor="#94A3B8"
              maxLength={5}
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
                onPress={handleSaveCustomTarget}
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
    backgroundColor: '#002E23',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: '#00261D',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(200,168,78,0.2)',
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnActive: {
    backgroundColor: '#C8A84E',
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFF',
  },
  headerSub: {
    fontSize: 11,
    color: '#C8A84E',
    fontWeight: '700',
  },
  presetSection: {
    paddingVertical: 8,
    backgroundColor: '#002B20',
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: '#C8A84E',
    letterSpacing: 0.8,
    paddingHorizontal: SPACING.md,
    marginBottom: 6,
  },
  presetScroll: {
    paddingHorizontal: SPACING.md,
    gap: 8,
  },
  presetCard: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(200,168,78,0.2)',
    alignItems: 'center',
  },
  presetCardActive: {
    backgroundColor: '#004D3A',
    borderColor: '#C8A84E',
  },
  presetArabic: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  presetArabicActive: {
    color: '#C8A84E',
  },
  presetTitle: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  presetTitleActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  dhikrBanner: {
    marginHorizontal: SPACING.md,
    marginTop: 8,
    padding: SPACING.md,
    backgroundColor: 'rgba(0,40,30,0.8)',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(200,168,78,0.3)',
    alignItems: 'center',
  },
  bannerArabic: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFF',
    textAlign: 'center',
  },
  bannerTransliteration: {
    fontSize: 14,
    fontWeight: '700',
    color: '#C8A84E',
    marginTop: 4,
  },
  bannerMeaning: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#CBD5E1',
    textAlign: 'center',
    marginTop: 2,
  },
  virtuePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(200,168,78,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    marginTop: 8,
  },
  virtueText: {
    fontSize: 10,
    color: '#F1F5F9',
    fontWeight: '600',
  },
  counterZone: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  progressBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#C8A84E',
    borderRadius: 3,
  },
  pressableArena: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  beadCircleOuter: {
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 6,
    borderColor: '#C8A84E',
    backgroundColor: '#004735',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.card,
  },
  beadCircleInner: {
    width: 210,
    height: 210,
    borderRadius: 105,
    borderWidth: 2,
    borderColor: 'rgba(200,168,78,0.4)',
    backgroundColor: '#003A2B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterDigits: {
    fontSize: 72,
    fontWeight: '900',
    color: '#FFF',
    lineHeight: 76,
  },
  counterTargetLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#C8A84E',
    marginTop: 4,
    letterSpacing: 1,
  },
  tapPrompt: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '700',
    marginTop: 8,
    letterSpacing: 0.5,
  },
  counterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 18,
    paddingHorizontal: 8,
  },
  controlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  controlBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C8A84E',
  },
  lapBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#004D3A',
    borderWidth: 1,
    borderColor: '#C8A84E',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  lapText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFF',
  },
  statsCard: {
    flexDirection: 'row',
    marginHorizontal: SPACING.md,
    backgroundColor: 'rgba(0,35,26,0.9)',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(200,168,78,0.2)',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFF',
  },
  statLabel: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#003A2B',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#C8A84E',
    padding: SPACING.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
  },
  modalSub: {
    fontSize: 12,
    color: '#CBD5E1',
    marginTop: 4,
    marginBottom: 16,
  },
  targetInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: '#C8A84E',
    borderRadius: RADIUS.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    color: '#FFF',
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#94A3B8',
    fontWeight: '700',
  },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    backgroundColor: '#005F46',
    borderWidth: 1,
    borderColor: '#C8A84E',
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#FFF',
    fontWeight: '800',
  },
});
