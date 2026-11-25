import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useGlobalAudio } from '@/context/GlobalAudioContext';
import { goBackOrReplace } from '@/lib/navigation';
import {
  getSalahSteps,
  getSalahStep,
  getPreferredFiqh,
  setPreferredFiqh,
  getCompletedSalahSteps,
  markSalahStepCompleted,
} from '@/lib/salahGuideService';
import { FiqhSchool, SalahStep } from '@/types/islamic';

interface RakahRow {
  prayer: string;
  prayerUr: string;
  total: number;
  breakdown: string;
  details: { label: string; count: number; type: string }[];
}

const RAKAH_TABLE: RakahRow[] = [
  {
    prayer: 'Fajr',
    prayerUr: 'فجر',
    total: 4,
    breakdown: '2 Sunnah + 2 Fard',
    details: [
      { label: 'سنت مؤکدہ', count: 2, type: 'sunnah' },
      { label: 'فرض', count: 2, type: 'fard' },
    ],
  },
  {
    prayer: 'Dhuhr',
    prayerUr: 'ظہر',
    total: 12,
    breakdown: '4 Sunnah + 4 Fard + 2 Sunnah + 2 Nafl',
    details: [
      { label: 'سنت مؤکدہ', count: 4, type: 'sunnah' },
      { label: 'فرض', count: 4, type: 'fard' },
      { label: 'سنت مؤکدہ', count: 2, type: 'sunnah' },
      { label: 'نفل', count: 2, type: 'nafl' },
    ],
  },
  {
    prayer: 'Asr',
    prayerUr: 'عصر',
    total: 8,
    breakdown: '4 Sunnah (Ghair Muakkadah) + 4 Fard',
    details: [
      { label: 'سنت غیر مؤکدہ', count: 4, type: 'sunnah_ghair' },
      { label: 'فرض', count: 4, type: 'fard' },
    ],
  },
  {
    prayer: 'Maghrib',
    prayerUr: 'مغرب',
    total: 7,
    breakdown: '3 Fard + 2 Sunnah + 2 Nafl',
    details: [
      { label: 'فرض', count: 3, type: 'fard' },
      { label: 'سنت مؤکدہ', count: 2, type: 'sunnah' },
      { label: 'نفل', count: 2, type: 'nafl' },
    ],
  },
  {
    prayer: 'Isha',
    prayerUr: 'عشاء',
    total: 17,
    breakdown: '4 Sunnah + 4 Fard + 2 Sunnah + 2 Nafl + 3 Witr + 2 Nafl',
    details: [
      { label: 'سنت', count: 4, type: 'sunnah_ghair' },
      { label: 'فرض', count: 4, type: 'fard' },
      { label: 'سنت مؤکدہ', count: 2, type: 'sunnah' },
      { label: 'نفل', count: 2, type: 'nafl' },
      { label: 'وتر واجب', count: 3, type: 'witr' },
      { label: 'نفل', count: 2, type: 'nafl' },
    ],
  },
  {
    prayer: 'Jummah',
    prayerUr: 'جمعۃ المبارک',
    total: 14,
    breakdown: '4 Sunnah + 2 Fard + 4 Sunnah + 2 Sunnah + 2 Nafl',
    details: [
      { label: 'سنت مؤکدہ', count: 4, type: 'sunnah' },
      { label: 'فرض', count: 2, type: 'fard' },
      { label: 'سنت مؤکدہ', count: 4, type: 'sunnah' },
      { label: 'سنت', count: 2, type: 'sunnah' },
      { label: 'نفل', count: 2, type: 'nafl' },
    ],
  },
];

export default function SalahGuideScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { playTrack, pauseTrack, currentTrack, isPlaying } = useGlobalAudio();
  const { width } = useWindowDimensions();

  const [activeTab, setActiveTab] = useState<'steps' | 'rakah'>('steps');
  const [steps, setSteps] = useState<SalahStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [fiqh, setFiqh] = useState<FiqhSchool>('hanafi');
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [autoAdvance, setAutoAdvance] = useState(false);

  const horizontalScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const list = getSalahSteps();
    setSteps(list);
    getPreferredFiqh().then(setFiqh);
    getCompletedSalahSteps().then(setCompletedSteps);
  }, []);

  const currentStep = steps[currentStepIndex] || steps[0];
  const isCurrentPlaying =
    currentStep ? currentTrack?.id === `salah-${currentStep.stepNumber}` && isPlaying : false;

  const handleSelectFiqh = async (newFiqh: FiqhSchool) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    setFiqh(newFiqh);
    await setPreferredFiqh(newFiqh);
  };

  const handleStepChange = (index: number) => {
    if (index < 0 || index >= steps.length) return;
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    setCurrentStepIndex(index);
  };

  const handleTogglePlay = () => {
    if (!currentStep) return;

    if (isCurrentPlaying) {
      pauseTrack();
    } else {
      playTrack({
        id: `salah-${currentStep.stepNumber}`,
        titleEn: `Step ${currentStep.stepNumber}: ${currentStep.stepNameEn}`,
        subtitle: currentStep.urduTranslation || currentStep.instructionsEn,
        audioUrl: currentStep.audioUrl || '',
        category: 'salah',
        arabicTitle: currentStep.arabicText,
      });
    }
  };

  const handleMarkCompleted = async () => {
    if (!currentStep) return;
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    const updated = await markSalahStepCompleted(currentStep.stepNumber);
    setCompletedSteps(updated);
  };

  const getPostureIcon = (posture: SalahStep['posture']) => {
    switch (posture) {
      case 'standing':
        return 'body-outline';
      case 'bowing':
        return 'fitness-outline';
      case 'prostrating':
        return 'earth-outline';
      case 'sitting':
        return 'square-outline';
      default:
        return 'body-outline';
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => goBackOrReplace(router, '/more')}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.emerald} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitleEn}>Salah Guide & Audio</Text>
          <Text style={styles.headerTitleUr}>رہنمائے نماز • قدم بہ قدم تصویری و صوتی رہنمائی</Text>
        </View>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.push('/azaan-audio' as any)}
          accessibilityRole="button"
          accessibilityLabel="Azaan Audio"
        >
          <Ionicons name="notifications-outline" size={24} color={COLORS.gold} />
        </TouchableOpacity>
      </View>

      {/* Main Mode Segmented Tabs */}
      <View style={styles.modeTabs}>
        <TouchableOpacity
          style={[styles.modeTab, activeTab === 'steps' && styles.modeTabActive]}
          onPress={() => setActiveTab('steps')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'steps' }}
        >
          <Ionicons
            name="walk-outline"
            size={18}
            color={activeTab === 'steps' ? COLORS.white : COLORS.textSecondary}
          />
          <Text style={[styles.modeTabText, activeTab === 'steps' && styles.modeTabTextActive]}>
            نماز کا طریقہ (14 Steps)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeTab, activeTab === 'rakah' && styles.modeTabActive]}
          onPress={() => setActiveTab('rakah')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'rakah' }}
        >
          <Ionicons
            name="calculator-outline"
            size={18}
            color={activeTab === 'rakah' ? COLORS.white : COLORS.textSecondary}
          />
          <Text style={[styles.modeTabText, activeTab === 'rakah' && styles.modeTabTextActive]}>
            رکعات گائیڈ (Rak'ah Table)
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'rakah' ? (
        /* Rak'ah Calculator / Table View */
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.rakahHeader}>
            <Text style={styles.rakahTitle}>پانچوں وقت کی نمازوں کی رکعات</Text>
            <Text style={styles.rakahSubtitle}>
              Complete breakdown of Fard, Sunnah Mu'akkadah, Wajib, and Nafl prayers
            </Text>
          </View>

          {RAKAH_TABLE.map((row) => (
            <View key={row.prayer} style={styles.rakahCard}>
              <View style={styles.rakahCardHeader}>
                <View style={styles.prayerTitleWrap}>
                  <Text style={styles.prayerNameEn}>{row.prayer}</Text>
                  <Text style={styles.prayerNameUr}>{row.prayerUr}</Text>
                </View>
                <View style={styles.totalBadge}>
                  <Text style={styles.totalBadgeText}>{row.total} رکعات Total</Text>
                </View>
              </View>

              <Text style={styles.breakdownSummary}>{row.breakdown}</Text>

              <View style={styles.chipsRow}>
                {row.details.map((item, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.detailChip,
                      item.type === 'fard'
                        ? styles.chipFard
                        : item.type === 'witr'
                        ? styles.chipWitr
                        : styles.chipSunnah,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        item.type === 'fard'
                          ? styles.chipTextFard
                          : item.type === 'witr'
                          ? styles.chipTextWitr
                          : styles.chipTextSunnah,
                      ]}
                    >
                      {item.count} {item.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        /* Step-by-Step Interactive Guide View */
        <View style={{ flex: 1 }}>
          {/* Fiqh Switcher Bar */}
          <View style={styles.fiqhBar}>
            <Text style={styles.fiqhLabel}>فقہی مسلک منتخب کریں:</Text>
            <View style={styles.fiqhPills}>
              <TouchableOpacity
                style={[styles.fiqhPill, fiqh === 'hanafi' && styles.fiqhPillActive]}
                onPress={() => handleSelectFiqh('hanafi')}
                accessibilityRole="button"
                accessibilityLabel="Hanafi Fiqh"
              >
                <Text style={[styles.fiqhPillText, fiqh === 'hanafi' && styles.fiqhPillTextActive]}>
                  فقہ حنفی (Hanafi)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.fiqhPill, fiqh === 'shafii' && styles.fiqhPillActive]}
                onPress={() => handleSelectFiqh('shafii')}
                accessibilityRole="button"
                accessibilityLabel="Shafi'i and General Sunnah"
              >
                <Text style={[styles.fiqhPillText, fiqh === 'shafii' && styles.fiqhPillTextActive]}>
                  شافعی / جمہور (Shafi'i)
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Horizontal Step Chips Navigator */}
          <View style={styles.chipsBar}>
            <ScrollView
              ref={horizontalScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsScroll}
            >
              {steps.map((st, idx) => {
                const isSelected = idx === currentStepIndex;
                const isDone = completedSteps.includes(st.stepNumber);
                return (
                  <TouchableOpacity
                    key={st.id}
                    style={[
                      styles.stepChip,
                      isSelected && styles.stepChipSelected,
                      isDone && !isSelected && styles.stepChipDone,
                    ]}
                    onPress={() => handleStepChange(idx)}
                    accessibilityRole="button"
                    accessibilityLabel={`Step ${st.stepNumber}: ${st.stepNameEn}`}
                  >
                    <Text
                      style={[
                        styles.stepChipNumber,
                        isSelected && styles.stepChipTextSelected,
                        isDone && !isSelected && styles.stepChipTextDone,
                      ]}
                    >
                      {st.stepNumber}
                    </Text>
                    <Text
                      style={[
                        styles.stepChipTitle,
                        isSelected && styles.stepChipTextSelected,
                        isDone && !isSelected && styles.stepChipTextDone,
                      ]}
                    >
                      {st.stepNameUr.split(' ')[0]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Current Step Detail Card */}
          {currentStep && (
            <ScrollView contentContainerStyle={styles.scrollContent}>
              <View style={styles.stepCard}>
                {/* Step Header */}
                <View style={styles.stepHeaderRow}>
                  <View style={styles.postureBadge}>
                    <Ionicons
                      name={getPostureIcon(currentStep.posture)}
                      size={18}
                      color={COLORS.emerald}
                    />
                    <Text style={styles.postureText}>
                      Step {currentStep.stepNumber} of 14 • {currentStep.posture.toUpperCase()}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.completeBadge,
                      completedSteps.includes(currentStep.stepNumber) && styles.completeBadgeDone,
                    ]}
                    onPress={handleMarkCompleted}
                    accessibilityRole="button"
                    accessibilityLabel="Mark step as learned"
                  >
                    <Ionicons
                      name={
                        completedSteps.includes(currentStep.stepNumber)
                          ? 'checkmark-circle'
                          : 'checkmark-circle-outline'
                      }
                      size={18}
                      color={
                        completedSteps.includes(currentStep.stepNumber) ? COLORS.emerald : COLORS.textTertiary
                      }
                    />
                    <Text
                      style={[
                        styles.completeBadgeText,
                        completedSteps.includes(currentStep.stepNumber) && styles.completeBadgeTextDone,
                      ]}
                    >
                      {completedSteps.includes(currentStep.stepNumber) ? 'مکمل شدہ' : 'یاد کیا؟'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Step Titles */}
                <Text style={styles.stepNameEn}>{currentStep.stepNameEn}</Text>
                <Text style={styles.stepNameUr}>{currentStep.stepNameUr}</Text>

                {/* Arabic Text Display */}
                <View style={styles.arabicBox}>
                  <Text style={styles.stepArabic}>{currentStep.arabicText}</Text>
                </View>

                {/* Transliteration */}
                <View style={styles.translitWrap}>
                  <Text style={styles.translitLabel}>تلفظ (Transliteration):</Text>
                  <Text style={styles.translitText}>{currentStep.transliteration}</Text>
                </View>

                {/* Translations */}
                <View style={styles.transCard}>
                  <View style={styles.transItem}>
                    <Text style={styles.transLabelEn}>English Meaning:</Text>
                    <Text style={styles.transBodyEn}>{currentStep.englishTranslation}</Text>
                  </View>
                  <View style={styles.transDivider} />
                  <View style={styles.transItem}>
                    <Text style={styles.transLabelUr}>اردو ترجمہ:</Text>
                    <Text style={styles.transBodyUr}>{currentStep.urduTranslation}</Text>
                  </View>
                </View>

                {/* Step Instructions */}
                <View style={styles.instructionBox}>
                  <View style={styles.instHeader}>
                    <Ionicons name="information-circle" size={18} color={COLORS.emerald} />
                    <Text style={styles.instTitle}>نماز میں طریقہ و ہدایات (How to perform)</Text>
                  </View>
                  <Text style={styles.instUr}>{currentStep.instructionsUr}</Text>
                  <Text style={styles.instEn}>{currentStep.instructionsEn}</Text>
                </View>

                {/* Fiqh Guidance Difference */}
                {currentStep.fiqhGuidance && (
                  <View style={styles.fiqhGuidanceBox}>
                    <View style={styles.fiqhGuidanceHeader}>
                      <Ionicons name="bookmarks" size={18} color={COLORS.gold} />
                      <Text style={styles.fiqhGuidanceTitle}>فقہی تطبیق • Fiqh Distinction</Text>
                    </View>

                    <View
                      style={[
                        styles.fiqhSpecRow,
                        fiqh === 'hanafi' && styles.fiqhSpecRowHighlighted,
                      ]}
                    >
                      <Text style={styles.fiqhSpecTag}>فقہ حنفی:</Text>
                      <Text style={styles.fiqhSpecText}>{currentStep.fiqhGuidance.hanafi}</Text>
                    </View>

                    <View
                      style={[
                        styles.fiqhSpecRow,
                        fiqh === 'shafii' && styles.fiqhSpecRowHighlighted,
                      ]}
                    >
                      <Text style={styles.fiqhSpecTag}>فقہ شافعی و جمہور:</Text>
                      <Text style={styles.fiqhSpecText}>{currentStep.fiqhGuidance.shafii}</Text>
                    </View>
                  </View>
                )}

                {/* Audio Recitation Player Bar */}
                <View style={styles.audioBar}>
                  <TouchableOpacity
                    style={[styles.playBtn, isCurrentPlaying && styles.playBtnActive]}
                    onPress={handleTogglePlay}
                    accessibilityRole="button"
                    accessibilityLabel={isCurrentPlaying ? 'Pause recitation' : 'Play recitation audio'}
                  >
                    <Ionicons
                      name={isCurrentPlaying ? 'pause' : 'play'}
                      size={24}
                      color={COLORS.white}
                    />
                    <Text style={styles.playBtnText}>
                      {isCurrentPlaying ? 'تلاوت روکیں' : 'صوتی تلاوت سنیں (Audio)'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.autoAdvanceBtn, autoAdvance && styles.autoAdvanceBtnActive]}
                    onPress={() => setAutoAdvance(!autoAdvance)}
                    accessibilityRole="button"
                    accessibilityLabel="Toggle autoplay full prayer"
                  >
                    <Ionicons
                      name="repeat"
                      size={18}
                      color={autoAdvance ? COLORS.white : COLORS.textSecondary}
                    />
                    <Text
                      style={[
                        styles.autoAdvanceText,
                        autoAdvance && styles.autoAdvanceTextActive,
                      ]}
                    >
                      خودکار تسلسل
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Bottom Step Navigation Bar */}
                <View style={styles.navBottomRow}>
                  <TouchableOpacity
                    style={[styles.stepNavBtn, currentStepIndex <= 0 && styles.stepNavBtnDisabled]}
                    onPress={() => handleStepChange(currentStepIndex - 1)}
                    disabled={currentStepIndex <= 0}
                    accessibilityRole="button"
                    accessibilityLabel="Previous Step"
                  >
                    <Ionicons
                      name="chevron-back"
                      size={20}
                      color={currentStepIndex <= 0 ? COLORS.textTertiary : COLORS.emerald}
                    />
                    <Text
                      style={[
                        styles.stepNavBtnText,
                        currentStepIndex <= 0 && styles.stepNavBtnTextDisabled,
                      ]}
                    >
                      پچھلا مرحلہ
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.stepNavBtn,
                      currentStepIndex >= steps.length - 1 && styles.stepNavBtnDisabled,
                    ]}
                    onPress={() => handleStepChange(currentStepIndex + 1)}
                    disabled={currentStepIndex >= steps.length - 1}
                    accessibilityRole="button"
                    accessibilityLabel="Next Step"
                  >
                    <Text
                      style={[
                        styles.stepNavBtnText,
                        currentStepIndex >= steps.length - 1 && styles.stepNavBtnTextDisabled,
                      ]}
                    >
                      اگلا مرحلہ
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={currentStepIndex >= steps.length - 1 ? COLORS.textTertiary : COLORS.emerald}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: '#EAEFF2',
  },
  headerBtn: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitleEn: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F291E',
  },
  headerTitleUr: {
    fontSize: 12,
    color: COLORS.gold,
    fontWeight: '600',
    marginTop: 2,
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#EAEFF2',
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: RADIUS.md,
    backgroundColor: '#F0F4F6',
    gap: 6,
  },
  modeTabActive: {
    backgroundColor: COLORS.emerald,
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  modeTabTextActive: {
    color: COLORS.white,
  },
  fiqhBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: '#FEF9C3',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE047',
  },
  fiqhLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#854D0E',
  },
  fiqhPills: {
    flexDirection: 'row',
    gap: 6,
  },
  fiqhPill: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  fiqhPillActive: {
    backgroundColor: COLORS.emerald,
    borderColor: COLORS.emerald,
  },
  fiqhPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  fiqhPillTextActive: {
    color: COLORS.white,
  },
  chipsBar: {
    backgroundColor: COLORS.white,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#EAEFF2',
  },
  chipsScroll: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  stepChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: '#F1F5F9',
    gap: 6,
  },
  stepChipSelected: {
    backgroundColor: COLORS.emerald,
  },
  stepChipDone: {
    backgroundColor: '#E8F5E9',
  },
  stepChipNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  stepChipTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  stepChipTextSelected: {
    color: COLORS.white,
  },
  stepChipTextDone: {
    color: COLORS.emerald,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl * 2,
  },
  stepCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.sm,
  },
  stepHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  postureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  postureText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.emerald,
  },
  completeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  completeBadgeDone: {
    backgroundColor: '#E8F5E9',
    borderColor: '#C8E6C9',
  },
  completeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textTertiary,
  },
  completeBadgeTextDone: {
    color: COLORS.emerald,
  },
  stepNameEn: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F291E',
  },
  stepNameUr: {
    fontSize: 14,
    color: COLORS.gold,
    fontWeight: '600',
    marginTop: 2,
    marginBottom: SPACING.md,
  },
  arabicBox: {
    backgroundColor: '#F8FAF9',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderRightWidth: 4,
    borderRightColor: COLORS.gold,
    marginBottom: SPACING.md,
  },
  stepArabic: {
    fontSize: 22,
    lineHeight: 44,
    color: '#0F291E',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  translitWrap: {
    marginBottom: SPACING.md,
  },
  translitLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 2,
  },
  translitText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#334155',
    lineHeight: 22,
  },
  transCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  transItem: {
    marginBottom: 4,
  },
  transLabelEn: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.emerald,
    marginBottom: 2,
  },
  transBodyEn: {
    fontSize: 13,
    color: '#1E293B',
    lineHeight: 20,
  },
  transDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: SPACING.sm,
  },
  transLabelUr: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.gold,
    marginBottom: 2,
    textAlign: 'right',
  },
  transBodyUr: {
    fontSize: 14,
    color: '#1E293B',
    lineHeight: 24,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  instructionBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  instHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  instTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  instUr: {
    fontSize: 13,
    color: '#14532D',
    lineHeight: 22,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: 6,
  },
  instEn: {
    fontSize: 12,
    color: '#166534',
    lineHeight: 18,
  },
  fiqhGuidanceBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  fiqhGuidanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  fiqhGuidanceTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  fiqhSpecRow: {
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    marginBottom: 4,
  },
  fiqhSpecRowHighlighted: {
    backgroundColor: 'rgba(200, 168, 78, 0.15)',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.gold,
  },
  fiqhSpecTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 2,
  },
  fiqhSpecText: {
    fontSize: 12,
    color: '#78350F',
    lineHeight: 18,
  },
  audioBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  playBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.emerald,
    minHeight: 48,
    borderRadius: RADIUS.md,
    gap: 8,
  },
  playBtnActive: {
    backgroundColor: '#DC2626',
  },
  playBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },
  autoAdvanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    minHeight: 48,
    borderRadius: RADIUS.md,
    backgroundColor: '#F1F5F9',
    gap: 6,
  },
  autoAdvanceBtnActive: {
    backgroundColor: COLORS.gold,
  },
  autoAdvanceText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  autoAdvanceTextActive: {
    color: COLORS.white,
  },
  navBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: SPACING.md,
  },
  stepNavBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: RADIUS.md,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  stepNavBtnDisabled: {
    opacity: 0.4,
  },
  stepNavBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.emerald,
  },
  stepNavBtnTextDisabled: {
    color: COLORS.textTertiary,
  },
  rakahHeader: {
    marginBottom: SPACING.lg,
  },
  rakahTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F291E',
  },
  rakahSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  rakahCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.sm,
  },
  rakahCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  prayerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  prayerNameEn: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F291E',
  },
  prayerNameUr: {
    fontSize: 14,
    color: COLORS.gold,
    fontWeight: '700',
  },
  totalBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  totalBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.emerald,
  },
  breakdownSummary: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: SPACING.sm,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  detailChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  chipFard: {
    backgroundColor: '#DCFCE7',
  },
  chipSunnah: {
    backgroundColor: '#FEF9C3',
  },
  chipWitr: {
    backgroundColor: '#E0E7FF',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  chipTextFard: {
    color: '#166534',
  },
  chipTextSunnah: {
    color: '#854D0E',
  },
  chipTextWitr: {
    color: '#3730A3',
  },
});
