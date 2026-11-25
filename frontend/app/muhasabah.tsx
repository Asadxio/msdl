import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  DailyMuhasabahLog,
  MUHASABAH_HABITS,
  SadaqahEntry,
  addSadaqahEntry,
  calculateMuhasabahStreak,
  deleteSadaqahEntry,
  getTodayDateKey,
  loadAllMuhasabahLogs,
  loadSadaqahEntries,
  saveDailyMuhasabahLog,
} from '@/lib/muhasabahService';

type TabMode = 'muhasabah' | 'sadaqah';

const CATEGORIES: SadaqahEntry['recipientCategory'][] = [
  'Poor & Needy',
  'Masjid / Madrasa',
  'Family / Neighbors',
  'Water / Relief',
  'General Sadaqah',
];

export default function MuhasabahScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const [activeTab, setActiveTab] = useState<TabMode>('muhasabah');
  const [logs, setLogs] = useState<Record<string, DailyMuhasabahLog>>({});
  const [sadaqahList, setSadaqahList] = useState<SadaqahEntry[]>([]);

  const todayKey = useMemo(() => getTodayDateKey(), []);
  const todayLog: DailyMuhasabahLog = logs[todayKey] || {
    dateKey: todayKey,
    completedHabitIds: [],
    reflectionNote: '',
    updatedAt: Date.now(),
  };

  const [reflectionDraft, setReflectionDraft] = useState('');
  const [sadAmount, setSadAmount] = useState('');
  const [sadCurrency, setSadCurrency] = useState('INR');
  const [sadCat, setSadCat] = useState<SadaqahEntry['recipientCategory']>('Poor & Needy');
  const [sadNote, setSadNote] = useState('');

  useEffect(() => {
    loadAllMuhasabahLogs().then((loaded) => {
      setLogs(loaded);
      if (loaded[todayKey]?.reflectionNote) {
        setReflectionDraft(loaded[todayKey].reflectionNote);
      }
    });
    loadSadaqahEntries().then(setSadaqahList);
  }, [todayKey]);

  const streak = useMemo(() => calculateMuhasabahStreak(logs), [logs]);
  const totalSadaqah = useMemo(
    () => sadaqahList.reduce((acc, item) => acc + (Number(item.amount) || 0), 0),
    [sadaqahList]
  );

  const handleToggleHabit = async (habitId: string) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    const exists = todayLog.completedHabitIds.includes(habitId);
    const nextIds = exists
      ? todayLog.completedHabitIds.filter((x) => x !== habitId)
      : [...todayLog.completedHabitIds, habitId];

    const updated = await saveDailyMuhasabahLog({
      dateKey: todayKey,
      completedHabitIds: nextIds,
      reflectionNote: reflectionDraft,
      updatedAt: Date.now(),
    });
    setLogs(updated);
  };

  const handleSaveReflection = async () => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const updated = await saveDailyMuhasabahLog({
      dateKey: todayKey,
      completedHabitIds: todayLog.completedHabitIds,
      reflectionNote: reflectionDraft.trim(),
      updatedAt: Date.now(),
    });
    setLogs(updated);
    Alert.alert('Saved', 'Today’s Muhasabah reflection has been saved privately on your device.');
  };

  const handleAddSadaqah = async () => {
    const num = Number(sadAmount.replace(/,/g, '').trim());
    if (!Number.isFinite(num) || num <= 0) {
      Alert.alert('Enter Amount', 'Please enter a valid Sadaqah amount greater than 0.');
      return;
    }
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const next = await addSadaqahEntry({
      amount: Math.round(num * 100) / 100,
      currency: sadCurrency,
      recipientCategory: sadCat,
      intentionNote: sadNote.trim() || 'For the sake of Allah alone',
    });
    setSadaqahList(next);
    setSadAmount('');
    setSadNote('');
  };

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
          <Text style={styles.headerAr}>المُحَاسَبَةُ وَالصَّدَقَة</Text>
          <Text style={styles.headerTitle}>Muhasabah & Sadaqah</Text>
        </View>
        <View style={styles.streakBadge}>
          <Ionicons name="flame" size={14} color="#FDE047" />
          <Text style={styles.streakTxt}>{streak}d</Text>
        </View>
      </View>

      <View style={[styles.tabRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'muhasabah' && { backgroundColor: colors.primary }]}
          onPress={() => setActiveTab('muhasabah')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'muhasabah' ? '#FFFFFF' : colors.text }]}>
            Daily Muhasabah
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'sadaqah' && { backgroundColor: colors.primary }]}
          onPress={() => setActiveTab('sadaqah')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'sadaqah' ? '#FFFFFF' : colors.text }]}>
            Sadaqah Log ({sadaqahList.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'muhasabah' ? (
          <>
            <View style={[styles.heroCard, { backgroundColor: isDark ? '#064E3B' : '#045E44' }]}>
              <Text style={styles.heroEyebrow}>TODAY’S ACCOUNTABILITY • {todayKey}</Text>
              <Text style={styles.heroScore}>
                {todayLog.completedHabitIds.length} / {MUHASABAH_HABITS.length} Deeds Completed
              </Text>
              <Text style={styles.heroQuote}>
                “Take account of yourselves before you are taken to account.” — Umar ibn al-Khattab (RA)
              </Text>
            </View>

            {MUHASABAH_HABITS.map((h) => {
              const checked = todayLog.completedHabitIds.includes(h.id);
              return (
                <TouchableOpacity
                  key={h.id}
                  style={[
                    styles.habitRow,
                    {
                      backgroundColor: colors.surface,
                      borderColor: checked ? colors.gold : colors.border,
                    },
                  ]}
                  onPress={() => void handleToggleHabit(h.id)}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name={checked ? 'checkmark-circle' : 'ellipse-outline'}
                    size={24}
                    color={checked ? colors.primary : colors.textMuted}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.habitEn, { color: colors.text }]}>{h.labelEn}</Text>
                    <Text style={[styles.habitUr, { color: colors.goldText }]}>{h.labelUr}</Text>
                  </View>
                  <View style={[styles.catChip, { backgroundColor: colors.goldBg }]}>
                    <Text style={[styles.catChipTxt, { color: colors.goldText }]}>{h.category}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardLabel, { color: colors.text }]}>
                Evening Reflection & Repentance Note (Private)
              </Text>
              <TextInput
                style={[
                  styles.textArea,
                  { backgroundColor: isDark ? colors.surfaceAlt : colors.background, color: colors.text, borderColor: colors.border },
                ]}
                multiline
                placeholder="Write a personal reflection or Dua for tomorrow..."
                placeholderTextColor={colors.textMuted}
                value={reflectionDraft}
                onChangeText={setReflectionDraft}
              />
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                onPress={() => void handleSaveReflection()}
              >
                <Text style={styles.primaryBtnText}>Save Daily Reflection</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <View style={[styles.heroCard, { backgroundColor: isDark ? '#064E3B' : '#045E44' }]}>
              <Text style={styles.heroEyebrow}>CHARITY NEVER DECREASES WEALTH</Text>
              <Text style={styles.heroScore}>
                {sadCurrency} {totalSadaqah.toLocaleString()}
              </Text>
              <Text style={styles.heroQuote}>
                Logged privately in {sadaqahList.length} Sadaqah entries on this device
              </Text>
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardLabel, { color: colors.text }]}>Record Today’s Sadaqah / Lillah</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={[
                    styles.amountInput,
                    { backgroundColor: isDark ? colors.surfaceAlt : colors.background, color: colors.text, borderColor: colors.border },
                  ]}
                  keyboardType="decimal-pad"
                  placeholder="Amount (e.g. 100)"
                  placeholderTextColor={colors.textMuted}
                  value={sadAmount}
                  onChangeText={setSadAmount}
                />
                <View style={styles.currWrap}>
                  {(['INR', 'USD', 'PKR', 'SAR'] as const).map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[
                        styles.currPill,
                        { backgroundColor: sadCurrency === c ? colors.primary : colors.surfaceAlt },
                      ]}
                      onPress={() => setSadCurrency(c)}
                    >
                      <Text style={{ color: sadCurrency === c ? '#FFFFFF' : colors.text, fontSize: 11, fontWeight: '800' }}>
                        {c}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {CATEGORIES.map((c) => {
                  const sel = sadCat === c;
                  return (
                    <TouchableOpacity
                      key={c}
                      style={[
                        styles.filterChip,
                        { backgroundColor: sel ? colors.primary : colors.background, borderColor: sel ? colors.gold : colors.border },
                      ]}
                      onPress={() => setSadCat(c)}
                    >
                      <Text style={{ fontSize: 11.5, fontWeight: '700', color: sel ? '#FFFFFF' : colors.text }}>
                        {c}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TextInput
                style={[
                  styles.noteInput,
                  { backgroundColor: isDark ? colors.surfaceAlt : colors.background, color: colors.text, borderColor: colors.border },
                ]}
                placeholder="Intention / Recipient note (optional)"
                placeholderTextColor={colors.textMuted}
                value={sadNote}
                onChangeText={setSadNote}
              />

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                onPress={() => void handleAddSadaqah()}
              >
                <Ionicons name="heart" size={16} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>Log Sadaqah</Text>
              </TouchableOpacity>
            </View>

            {sadaqahList.map((item) => (
              <View
                key={item.id}
                style={[styles.logRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.logAmt, { color: colors.primary }]}>
                    {item.currency} {item.amount.toLocaleString()} • {item.recipientCategory}
                  </Text>
                  <Text style={[styles.logNote, { color: colors.text }]}>{item.intentionNote}</Text>
                  <Text style={[styles.logDate, { color: colors.textMuted }]}>
                    {new Date(item.dateIso).toLocaleDateString()}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => void deleteSadaqahEntry(item.id).then(setSadaqahList)}>
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                </TouchableOpacity>
              </View>
            ))}
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
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  streakTxt: { color: '#FDE047', fontWeight: '800', fontSize: 12 },
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
  heroCard: { borderRadius: 20, padding: 16, gap: 4 },
  heroEyebrow: { color: '#E5C378', fontSize: 10.5, fontWeight: '800', letterSpacing: 1 },
  heroScore: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', marginTop: 2 },
  heroQuote: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontStyle: 'italic', marginTop: 2 },
  habitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
  },
  habitEn: { fontSize: 13.5, fontWeight: '800' },
  habitUr: { fontSize: 12, fontWeight: '600', textAlign: 'right', marginTop: 2 },
  catChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  catChipTxt: { fontSize: 10, fontWeight: '800' },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    ...SHADOWS.card,
  },
  cardLabel: { fontSize: 14, fontWeight: '800' },
  textArea: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: 13,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 46,
    borderRadius: RADIUS.md,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  amountInput: { flex: 1, borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: 12, minHeight: 44, fontSize: 14, fontWeight: '700' },
  currWrap: { flexDirection: 'row', gap: 4 },
  currPill: { paddingHorizontal: 8, paddingVertical: 8, borderRadius: 10 },
  filterChip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: RADIUS.full, borderWidth: 1 },
  noteInput: { borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: 12, minHeight: 42, fontSize: 13 },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
  },
  logAmt: { fontSize: 14, fontWeight: '800' },
  logNote: { fontSize: 12.5, marginTop: 2 },
  logDate: { fontSize: 11, marginTop: 2 },
});
