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
  loadCustomDhikrs,
  addCustomDhikr,
  deleteCustomDhikr,
  type TasbeehStats,
  type CustomDhikrItem,
} from '@/lib/tasbeehStorage';

export interface DhikrPreset {
  id: string;
  arabic: string;
  transliteration: string;
  meaning: string;
  target: number;
  virtue?: string;
  isCustom?: boolean;
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

  // 9.3 Custom Dhikr Creation Modal State
  const [customDhikrs, setCustomDhikrs] = useState<CustomDhikrItem[]>([]);
  const [showAddDhikrModal, setShowAddDhikrModal] = useState<boolean>(false);
  const [newArabicText, setNewArabicText] = useState<string>('');
  const [newNameText, setNewNameText] = useState<string>('');
  const [newMeaningText, setNewMeaningText] = useState<string>('');
  const [newTargetText, setNewTargetText] = useState<string>('100');

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
    dailyHistory: {},
  });

  // Animation Refs
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rippleAnim = useRef(new Animated.Value(0)).current;
  const celebrateAnim = useRef(new Animated.Value(0)).current;

  // Load Initial Stats & Custom Dhikrs
  useEffect(() => {
    loadTasbeehStats().then((s) => setStats(s));
    loadCustomDhikrs().then((d) => setCustomDhikrs(d));
  }, []);

  // Combined Presets: Custom Dhikrs + Built-in Presets
  const allPresets = useMemo(() => {
    const customPresetItems: DhikrPreset[] = customDhikrs.map((d) => ({
      id: d.id,
      arabic: d.arabic,
      transliteration: d.transliteration,
      meaning: d.meaning,
      target: d.target,
      virtue: d.virtue || 'Personal Custom Dhikr',
      isCustom: true,
    }));
    return [...customPresetItems, ...DHIKR_PRESETS];
  }, [customDhikrs]);

  const activePreset = useMemo(() => {
    return allPresets.find((p) => p.id === selectedPresetId) || allPresets[0];
  }, [selectedPresetId, allPresets]);

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

  // 9.1 Multi-burst celebratory haptic vibration on target reached
  const triggerCelebrationVibration = () => {
    if (Platform.OS !== 'web' && hapticsMode !== 'off') {
      // Stage 1: Notification Success pattern
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      // Stage 2: Heavy pulse
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      }, 120);
      // Stage 3: Celebratory final pulse
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }, 250);
    }

    // Visual celebration animation
    celebrateAnim.setValue(0);
    Animated.sequence([
      Animated.timing(celebrateAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(celebrateAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  };

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
        // 9.1 Target reached special multi-burst haptic vibration
        triggerCelebrationVibration();

        if (selectedPresetId === 'fatima') {
          if (fatimaStep < 2) {
            setFatimaStep((step) => step + 1);
            return 0;
          } else {
            // Full 100 complete
            setFatimaStep(0);
            setLaps((l) => l + 1);
            recordTasbeehLap();
            Alert.alert('ماشاءاللہ! 🌟', 'تسبیحِ فاطمہ کے ۱۰۰ اذکار مکمل ہو گئے!');
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

  const handleCreateCustomDhikr = async () => {
    const trimmedArabic = newArabicText.trim();
    const trimmedName = newNameText.trim();
    const trimmedMeaning = newMeaningText.trim();
    const parsedTarget = parseInt(newTargetText, 10);

    if (!trimmedArabic && !trimmedName) {
      Alert.alert('Missing Input', 'Please provide either Arabic/Urdu text or a name for the Dhikr.');
      return;
    }
    if (isNaN(parsedTarget) || parsedTarget <= 0 || parsedTarget > 99999) {
      Alert.alert('Invalid Target', 'Please enter a valid target number (1 - 99,999).');
      return;
    }

    try {
      const updatedList = await addCustomDhikr({
        arabic: trimmedArabic || trimmedName,
        transliteration: trimmedName || trimmedArabic,
        meaning: trimmedMeaning || 'Personal Dhikr',
        target: parsedTarget,
        virtue: 'Custom Daily Azkar',
      });
      setCustomDhikrs(updatedList);
      setShowAddDhikrModal(false);
      setNewArabicText('');
      setNewNameText('');
      setNewMeaningText('');
      setNewTargetText('100');

      // Automatically select the new dhikr
      if (updatedList.length > 0) {
        setSelectedPresetId(updatedList[0].id);
        setCount(0);
      }
      Alert.alert('Dhikr Added', 'Aapka zikr kamyabi se shamil kar diya gaya hai.');
    } catch (e) {
      Alert.alert('Error', 'Could not add Dhikr. Please try again.');
    }
  };

  const handleDeleteCustomDhikr = (id: string, name: string) => {
    Alert.alert('Delete Dhikr', `Do you want to remove "${name}" from your custom Dhikrs?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const updated = await deleteCustomDhikr(id);
          setCustomDhikrs(updated);
          if (selectedPresetId === id) {
            setSelectedPresetId('fatima');
            setFatimaStep(0);
            setCount(0);
          }
        },
      },
    ]);
  };

  // 9.2 Compute 7-day daily history data
  const past7DaysData = useMemo(() => {
    const days: { dateStr: string; label: string; count: number }[] = [];
    const today = new Date();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayLabel = i === 0 ? 'Today' : dayNames[d.getDay()];
      const count = stats.dailyHistory?.[dateStr] || (i === 0 ? stats.todayCount || 0 : 0);
      days.push({ dateStr, label: dayLabel, count });
    }

    const maxCount = Math.max(...days.map((d) => d.count), 1);
    return { days, maxCount };
  }, [stats.dailyHistory, stats.todayCount]);

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
          {/* ─── Dhikr Preset Selector Strip (Includes 9.3 Custom Dhikrs) ─── */}
          <View style={styles.presetSection}>
            <View style={styles.presetHeaderRow}>
              <Text style={styles.sectionHeader}>SELECT DHIKR PRESET</Text>
              <TouchableOpacity
                style={styles.addCustomDhikrBtn}
                onPress={() => setShowAddDhikrModal(true)}
              >
                <Ionicons name="add-circle" size={14} color="#C8A84E" />
                <Text style={styles.addCustomDhikrText}>+ Apna Dhikr Jodein</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.presetScroll}
            >
              {allPresets.map((preset) => {
                const isSelected = selectedPresetId === preset.id;
                const isCustomItem = !!preset.isCustom;
                return (
                  <TouchableOpacity
                    key={preset.id}
                    style={[styles.presetCard, isSelected && styles.presetCardActive]}
                    onPress={() => handleSelectPreset(preset)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.presetInnerTop}>
                      <Text style={[styles.presetArabic, isSelected && styles.presetArabicActive]}>
                        {preset.arabic}
                      </Text>
                      {isCustomItem && (
                        <TouchableOpacity
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          onPress={() => handleDeleteCustomDhikr(preset.id, preset.transliteration)}
                          style={styles.customTrashBtn}
                        >
                          <Ionicons name="trash-outline" size={12} color="#EF4444" />
                        </TouchableOpacity>
                      )}
                    </View>
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
          {/* 9.1 Celebration Halo Overlay when Target reached */}
          <Animated.View
            style={[
              styles.celebrateGlow,
              {
                opacity: celebrateAnim,
                transform: [
                  {
                    scale: celebrateAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.15],
                    }),
                  },
                ],
              },
            ]}
          />

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

      {/* ─── 9.2 Bottom 7-Day Stats & Streak Dashboard ─── */}
      {!fullScreenMode && (
        <View style={[styles.statsContainer, { marginBottom: insets.bottom + 8 }]}>
          {/* 7-Day Bar Chart Strip */}
          <View style={styles.chartContainer}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>📊 7-Day Dhikr Activity</Text>
              <Text style={styles.chartSub}>Pichle 7 dino ki tauseeq</Text>
            </View>
            <View style={styles.chartRow}>
              {past7DaysData.days.map((d, index) => {
                const heightPct = Math.max(8, Math.round((d.count / past7DaysData.maxCount) * 100));
                const isToday = index === 6;
                return (
                  <View key={d.dateStr} style={styles.chartBarCol}>
                    <Text style={styles.barCountText}>
                      {d.count > 0 ? (d.count > 999 ? `${(d.count / 1000).toFixed(1)}k` : d.count) : ''}
                    </Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          { height: `${heightPct}%` },
                          isToday && styles.barFillToday,
                        ]}
                      />
                    </View>
                    <Text style={[styles.barLabel, isToday && styles.barLabelToday]}>
                      {d.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Today & Lifetime Stats Cards */}
          <View style={styles.statsCard}>
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
        </View>
      )}

      {/* ─── Custom Target Modal (Simple count edit) ─── */}
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

      {/* ─── 9.3 Add Custom Dhikr Modal ─── */}
      <Modal visible={showAddDhikrModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>+ Naya Dhikr Shamil Karein</Text>
            <Text style={styles.modalSub}>Apna pasandeeda wazeefa ya zikr target ke sath add karein:</Text>

            <Text style={styles.inputLabel}>ARABIC / URDU TEXT</Text>
            <TextInput
              style={styles.textModalInput}
              value={newArabicText}
              onChangeText={setNewArabicText}
              placeholder="مثال: حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ"
              placeholderTextColor="#94A3B8"
              textAlign="right"
            />

            <Text style={styles.inputLabel}>NAME / TRANSLITERATION</Text>
            <TextInput
              style={styles.textModalInput}
              value={newNameText}
              onChangeText={setNewNameText}
              placeholder="Hasbunallahu Wa Ni'mal Wakeel"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.inputLabel}>MEANING / FAZEELAT (OPTIONAL)</Text>
            <TextInput
              style={styles.textModalInput}
              value={newMeaningText}
              onChangeText={setNewMeaningText}
              placeholder="Allah hamare liye kafi hai"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.inputLabel}>TARGET COUNT</Text>
            <TextInput
              style={styles.targetInput}
              keyboardType="number-pad"
              value={newTargetText}
              onChangeText={setNewTargetText}
              placeholder="100"
              placeholderTextColor="#94A3B8"
              maxLength={5}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowAddDhikrModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleCreateCustomDhikr}
              >
                <Text style={styles.modalSaveText}>Save Dhikr</Text>
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
  presetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    marginBottom: 6,
  },
  addCustomDhikrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(200,168,78,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(200,168,78,0.3)',
  },
  addCustomDhikrText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#C8A84E',
  },
  presetInnerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  customTrashBtn: {
    padding: 2,
  },
  celebrateGlow: {
    position: 'absolute',
    width: 270,
    height: 270,
    borderRadius: 135,
    borderWidth: 4,
    borderColor: '#FFD700',
    backgroundColor: 'rgba(200,168,78,0.25)',
  },
  statsContainer: {
    marginHorizontal: SPACING.md,
    gap: 8,
  },
  chartContainer: {
    backgroundColor: 'rgba(0,35,26,0.9)',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(200,168,78,0.2)',
    padding: 10,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  chartTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFF',
  },
  chartSub: {
    fontSize: 9,
    color: '#94A3B8',
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 70,
    paddingTop: 8,
  },
  chartBarCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barCountText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#C8A84E',
    marginBottom: 2,
  },
  barTrack: {
    width: 14,
    height: 42,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    backgroundColor: 'rgba(200,168,78,0.5)',
    borderRadius: 4,
  },
  barFillToday: {
    backgroundColor: '#C8A84E',
  },
  barLabel: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 3,
  },
  barLabelToday: {
    color: '#C8A84E',
    fontWeight: '800',
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#C8A84E',
    marginBottom: 4,
    marginTop: 8,
    letterSpacing: 0.5,
  },
  textModalInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(200,168,78,0.4)',
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#FFF',
  },
});
