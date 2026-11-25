import React, { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { goBackOrReplace } from '@/lib/navigation';
import {
  RITUAL_STEPS,
  SAI_LAP_LABELS,
  TAWAF_ROUND_LABELS,
  loadTawafSaiState,
  saveTawafSaiState,
} from '@/lib/umrahHajjService';

type MainTab = 'guide' | 'counter';
type RitualFilter = 'Umrah' | 'Hajj' | 'Madinah';

export default function UmrahHajjScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const [mainTab, setMainTab] = useState<MainTab>('guide');
  const [ritualFilter, setRitualFilter] = useState<RitualFilter>('Umrah');
  const [counterMode, setCounterMode] = useState<'tawaf' | 'sai'>('tawaf');
  const [completedRounds, setCompletedRounds] = useState<number>(0);

  useEffect(() => {
    loadTawafSaiState().then((st) => {
      setCounterMode(st.mode);
      setCompletedRounds(st.completedRounds);
    });
  }, []);

  const filteredSteps = useMemo(
    () => RITUAL_STEPS.filter((s) => s.ritual === ritualFilter),
    [ritualFilter]
  );

  const persistCounter = (mode: 'tawaf' | 'sai', rounds: number) => {
    setCounterMode(mode);
    setCompletedRounds(rounds);
    void saveTawafSaiState({ mode, completedRounds: rounds, updatedAt: Date.now() });
  };

  const handleStepRound = (delta: number) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const next = Math.max(0, Math.min(7, completedRounds + delta));
    persistCounter(counterMode, next);
  };

  const roundLabels = counterMode === 'tawaf' ? TAWAF_ROUND_LABELS : SAI_LAP_LABELS;
  const activeIndex = Math.min(6, completedRounds);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { backgroundColor: colors.primaryDeep }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => goBackOrReplace(router, '/more')}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerAr}>مَنَاسِكُ الْعُمْرَةِ وَالْحَجّ</Text>
          <Text style={styles.headerTitle}>Umrah & Hajj Guide</Text>
        </View>
        <View style={{ width: 42 }} />
      </View>

      <View style={[styles.tabRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tabBtn, mainTab === 'guide' && { backgroundColor: colors.primary }]}
          onPress={() => setMainTab('guide')}
        >
          <Text style={[styles.tabText, { color: mainTab === 'guide' ? '#FFFFFF' : colors.text }]}>
            Step-by-Step Guide
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, mainTab === 'counter' && { backgroundColor: colors.primary }]}
          onPress={() => setMainTab('counter')}
        >
          <Text style={[styles.tabText, { color: mainTab === 'counter' ? '#FFFFFF' : colors.text }]}>
            Tawaf & Sa’i Counter
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        {mainTab === 'guide' ? (
          <>
            <View style={styles.filterRow}>
              {(['Umrah', 'Hajj', 'Madinah'] as const).map((rf) => {
                const active = ritualFilter === rf;
                return (
                  <TouchableOpacity
                    key={rf}
                    style={[
                      styles.filterPill,
                      {
                        backgroundColor: active ? colors.primary : colors.surface,
                        borderColor: active ? colors.gold : colors.border,
                      },
                    ]}
                    onPress={() => setRitualFilter(rf)}
                  >
                    <Text style={[styles.filterText, { color: active ? '#FFFFFF' : colors.text }]}>
                      {rf === 'Madinah' ? 'Madinah Ziyarat' : `${rf} Steps`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {filteredSteps.map((step) => (
              <View
                key={step.id}
                style={[styles.stepCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.stepTop}>
                  <View style={[styles.stepBadge, { backgroundColor: colors.goldBg }]}>
                    <Text style={[styles.stepBadgeText, { color: colors.goldText }]}>
                      {step.dayBadge ? `${step.dayBadge}` : `Step ${step.stepNumber}`}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.stepTitleEn, { color: colors.text }]}>{step.titleEn}</Text>
                <Text style={[styles.stepTitleUr, { color: colors.primary }]}>{step.titleUr}</Text>

                <View
                  style={[
                    styles.duaBox,
                    { backgroundColor: isDark ? colors.surfaceAlt : '#FAF7EE', borderColor: colors.goldBorder },
                  ]}
                >
                  <Text style={[styles.duaAr, { color: colors.text }]}>{step.arabicDua}</Text>
                  <Text style={[styles.duaTrans, { color: colors.goldText }]}>{step.transliteration}</Text>
                  <Text style={[styles.duaUr, { color: colors.primary }]}>{step.translationUr}</Text>
                  <Text style={[styles.duaEn, { color: colors.textSecondary }]}>{step.translationEn}</Text>
                </View>

                <Text style={[styles.instructions, { color: colors.text }]}>{step.instructions}</Text>
              </View>
            ))}
          </>
        ) : (
          <>
            <View style={styles.filterRow}>
              {(['tawaf', 'sai'] as const).map((m) => {
                const active = counterMode === m;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.filterPill,
                      {
                        backgroundColor: active ? colors.primary : colors.surface,
                        borderColor: active ? colors.gold : colors.border,
                      },
                    ]}
                    onPress={() => persistCounter(m, 0)}
                  >
                    <Text style={[styles.filterText, { color: active ? '#FFFFFF' : colors.text }]}>
                      {m === 'tawaf' ? 'Tawaf (Kaaba 7 Rounds)' : 'Sa’i (Safa ↔ Marwah 7 Laps)'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={[styles.counterHero, { backgroundColor: isDark ? '#064E3B' : '#045E44' }]}>
              <Text style={styles.counterLabel}>
                {counterMode === 'tawaf' ? 'TAWAF CIRCUIT TRACKER' : 'SA’I LAP TRACKER'}
              </Text>
              <Text style={styles.counterNum}>{completedRounds} / 7</Text>
              <Text style={styles.counterDesc}>
                {completedRounds === 7
                  ? counterMode === 'tawaf'
                    ? 'Tawaf Complete! Proceed for 2 Rakaat behind Maqam Ibrahim.'
                    : 'Sa’i Complete at Marwah! Proceed to Halq or Taqsir.'
                  : roundLabels[activeIndex]}
              </Text>

              <View style={styles.counterBtnsRow}>
                <TouchableOpacity
                  style={styles.counterActionBtn}
                  onPress={() => handleStepRound(-1)}
                  disabled={completedRounds <= 0}
                >
                  <Ionicons name="remove" size={22} color="#FFFFFF" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.counterPlusBtn}
                  onPress={() => handleStepRound(1)}
                  disabled={completedRounds >= 7}
                >
                  <Text style={styles.counterPlusText}>
                    {completedRounds >= 7 ? 'Completed ✓' : 'Complete Round +1'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.counterActionBtn}
                  onPress={() => persistCounter(counterMode, 0)}
                >
                  <Ionicons name="refresh" size={20} color="#FDE047" />
                </TouchableOpacity>
              </View>
            </View>

            {roundLabels.map((lbl, idx) => {
              const done = idx < completedRounds;
              const current = idx === completedRounds && completedRounds < 7;
              return (
                <View
                  key={lbl}
                  style={[
                    styles.roundRow,
                    {
                      backgroundColor: colors.surface,
                      borderColor: current ? colors.gold : colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name={done ? 'checkmark-circle' : current ? 'radio-button-on' : 'ellipse-outline'}
                    size={22}
                    color={done ? colors.primary : current ? colors.gold : colors.textMuted}
                  />
                  <Text style={[styles.roundText, { color: colors.text }]}>{lbl}</Text>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerAr: { fontSize: 12, fontWeight: '700', color: '#E5C378' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#FFFFFF' },
  tabRow: {
    flexDirection: 'row',
    margin: SPACING.md,
    marginBottom: 8,
    padding: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    gap: 4,
  },
  tabBtn: { flex: 1, paddingVertical: 9, borderRadius: RADIUS.full, alignItems: 'center' },
  tabText: { fontSize: 13, fontWeight: '800' },
  scrollContent: { paddingHorizontal: SPACING.md, gap: 10 },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterPill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    alignItems: 'center',
  },
  filterText: { fontSize: 12, fontWeight: '800' },
  stepCard: { borderRadius: 20, borderWidth: 1, padding: 15, gap: 8, ...SHADOWS.card },
  stepTop: { flexDirection: 'row', alignItems: 'center' },
  stepBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  stepBadgeText: { fontSize: 11, fontWeight: '800' },
  stepTitleEn: { fontSize: 16, fontWeight: '900' },
  stepTitleUr: { fontSize: 13.5, fontWeight: '700', textAlign: 'right' },
  duaBox: { borderRadius: 14, borderWidth: 1, padding: 12, gap: 5 },
  duaAr: { fontSize: 20, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl', lineHeight: 34 },
  duaTrans: { fontSize: 12.5, fontStyle: 'italic', fontWeight: '600' },
  duaUr: { fontSize: 13, fontWeight: '700', textAlign: 'right', lineHeight: 22 },
  duaEn: { fontSize: 12.5, lineHeight: 18 },
  instructions: { fontSize: 13, lineHeight: 19, fontWeight: '500' },
  counterHero: { borderRadius: 24, padding: 20, alignItems: 'center', gap: 8 },
  counterLabel: { color: '#E5C378', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  counterNum: { color: '#FFFFFF', fontSize: 52, fontWeight: '900' },
  counterDesc: { color: '#D1FAE5', fontSize: 13.5, fontWeight: '700', textAlign: 'center' },
  counterBtnsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  counterActionBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterPlusBtn: {
    paddingHorizontal: 20,
    minHeight: 46,
    borderRadius: 23,
    backgroundColor: '#C6A15B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterPlusText: { color: '#043C32', fontSize: 14, fontWeight: '900' },
  roundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
  },
  roundText: { fontSize: 13.5, fontWeight: '700', flex: 1 },
});
