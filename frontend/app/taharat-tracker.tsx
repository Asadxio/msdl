import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Platform,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING, SHADOWS } from '@/constants/theme';
import {
  CycleEntry,
  UserHabit,
  getCurrentPurityStatus,
  PurityCalculationResult,
} from '@/lib/taharatCalculator';
import {
  loadTaharatData,
  saveCycleEntry,
  endActiveCycle,
  deleteCycleEntry,
  updateQadhaFasts,
  loadTodayNamazRecord,
  toggleNamazPrayer,
  setGhuslReminderEnabled,
  DailyNamazRecord,
  NamazPrayerKey,
} from '@/lib/taharatStorage';
import {
  scheduleExpectedGhuslReminder,
  cancelGhuslReminder,
} from '@/lib/taharatNotifications';
import { goBackOrReplace } from '@/lib/navigation';

export default function TaharatTrackerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'status' | 'qadha' | 'masail'>('status');
  const [entries, setEntries] = useState<CycleEntry[]>([]);
  const [habit, setHabit] = useState<UserHabit>({ haizDays: 7, tuhrDays: 21, nifasDays: 40 });
  const [qadhaTotal, setQadhaTotal] = useState<number>(0);
  const [qadhaDone, setQadhaDone] = useState<number>(0);
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [ghuslReminderEnabled, setGhuslReminderState] = useState<boolean>(true);
  const [namazRecord, setNamazRecord] = useState<DailyNamazRecord>({
    date: '',
    fajr: false,
    dhuhr: false,
    asr: false,
    maghrib: false,
    isha: false,
  });

  // New Log Form State
  const [selectedType, setSelectedType] = useState<'haiz' | 'nifas' | 'istihaza'>('haiz');
  const [intensity, setIntensity] = useState<'light' | 'medium' | 'heavy'>('medium');
  const [notes, setNotes] = useState('');

  const refreshData = async () => {
    const [data, todayNamaz] = await Promise.all([
      loadTaharatData(),
      loadTodayNamazRecord(),
    ]);
    setEntries(data.entries);
    setHabit(data.habit);
    setQadhaTotal(data.qadhaFastsTotal);
    setQadhaDone(data.qadhaFastsCompleted);
    setGhuslReminderState(data.ghuslReminderEnabled);
    setNamazRecord(todayNamaz);
  };

  useEffect(() => {
    refreshData();
  }, []);

  const purityStatus: PurityCalculationResult = getCurrentPurityStatus(entries, habit);
  const activeCycle = entries.find((e) => !e.endDate);

  const handleTogglePrayer = async (prayer: NamazPrayerKey) => {
    const updated = await toggleNamazPrayer(prayer);
    setNamazRecord(updated);
  };

  const handleToggleGhuslReminder = async (val: boolean) => {
    setGhuslReminderState(val);
    await setGhuslReminderEnabled(val);
    if (!val) {
      await cancelGhuslReminder();
      Alert.alert('Ghusl Alert Disabled', 'Morning Ghusl reminder has been turned off.');
    } else if (activeCycle) {
      const habitDays = activeCycle.type === 'nifas' ? (habit.nifasDays || 40) : habit.haizDays;
      const scheduled = await scheduleExpectedGhuslReminder(activeCycle.startDate, habitDays, true);
      if (scheduled) {
        Alert.alert('Ghusl Alert Scheduled', 'Morning alert scheduled for 06:00 AM on your expected Paaki day.');
      }
    }
  };

  const handleStartCycle = async () => {
    const newEntry: CycleEntry = {
      id: 'cycle_' + Date.now(),
      startDate: new Date().toISOString(),
      type: selectedType,
      bleedingIntensity: intensity,
      notes: notes.trim() || undefined,
    };
    await saveCycleEntry(newEntry);

    // Schedule Ghusl reminder if enabled and applicable
    if (ghuslReminderEnabled && (selectedType === 'haiz' || selectedType === 'nifas')) {
      const habitDays = selectedType === 'nifas' ? (habit.nifasDays || 40) : habit.haizDays;
      await scheduleExpectedGhuslReminder(newEntry.startDate, habitDays, true);
    }

    setLogModalVisible(false);
    setNotes('');
    await refreshData();
    Alert.alert('Record Saved', 'Your Shariah cycle record has been logged successfully.');
  };

  const handleEndCycle = () => {
    if (!activeCycle) return;
    Alert.alert(
      'Bleeding Ceased / Ghusl Time',
      'Has the bleeding completely stopped? It is now time to perform Ghusl and resume Salah.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Bleeding Stopped',
          onPress: async () => {
            await endActiveCycle(activeCycle.id, new Date().toISOString());
            await cancelGhuslReminder();
            await refreshData();
            Alert.alert('Alhamdulillah', 'Purity period has commenced. Please perform Ghusl and resume prayers.');
          },
        },
      ]
    );
  };

  const handleDeleteEntry = (id: string) => {
    Alert.alert('Delete Record', 'Are you sure you want to delete this record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteCycleEntry(id);
          await refreshData();
        },
      },
    ]);
  };

  const handleIncrementQadhaDone = async () => {
    const nextDone = qadhaDone + 1;
    setQadhaDone(nextDone);
    await updateQadhaFasts(qadhaTotal, nextDone);
  };

  const handleAddQadhaTotal = async (count: number) => {
    const nextTotal = qadhaTotal + count;
    setQadhaTotal(nextTotal);
    await updateQadhaFasts(nextTotal, qadhaDone);
  };

  const getStateTheme = () => {
    switch (purityStatus.state) {
      case 'pure':
        return { bg: '#E8F5EE', border: '#10B981', text: '#005F46', icon: 'checkmark-circle' };
      case 'haiz':
        return { bg: '#FEE2E2', border: '#EF4444', text: '#B91C1C', icon: 'water' };
      case 'nifas':
        return { bg: '#FEF3C7', border: '#F59E0B', text: '#B45309', icon: 'heart' };
      case 'istihaza':
        return { bg: '#F3E8FF', border: '#8B5CF6', text: '#6D28D9', icon: 'medical' };
    }
  };

  const stateTheme = getStateTheme();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => goBackOrReplace(router, '/(tabs)')}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.arabicHeader}>Taharat & Purity Tracker</Text>
          <Text style={styles.headerSubtitle}>Women's Islamic Health & Fiqh Guide</Text>
        </View>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => setLogModalVisible(true)}
          accessibilityLabel="Add entry"
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Privacy Notice Banner */}
      <View style={styles.privacyBanner}>
        <Ionicons name="shield-checkmark" size={14} color="#C8A84E" />
        <Text style={styles.privacyBannerText}>
          100% Private & Stored only on your device (Phone).
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {[
          { id: 'status', label: 'Purity Status', icon: 'calendar-outline' },
          { id: 'qadha', label: 'Qaza Fasting', icon: 'moon-outline' },
          { id: 'masail', label: 'Fiqh Rules', icon: 'book-outline' },
        ].map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabBtn, isSelected && styles.tabBtnSelected]}
              onPress={() => setActiveTab(tab.id as any)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={tab.icon as any}
                size={14}
                color={isSelected ? '#002E23' : '#94A3B8'}
              />
              <Text style={[styles.tabBtnText, isSelected && styles.tabBtnTextSelected]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeTab === 'status' && (
          <>
            {/* Purity Status Hero Card */}
            <View style={[styles.statusCard, { borderColor: stateTheme.border, backgroundColor: stateTheme.bg }]}>
              <View style={styles.statusCardTop}>
                <View style={[styles.stateBadge, { backgroundColor: stateTheme.border }]}>
                  <Ionicons name={stateTheme.icon as any} size={14} color="#FFFFFF" />
                  <Text style={styles.stateBadgeText}>{purityStatus.stateLabel}</Text>
                </View>
                {activeCycle && (
                  <View style={styles.daysPill}>
                    <Text style={[styles.daysPillText, { color: stateTheme.text }]}>
                      Day: {purityStatus.activeCycleDays}
                    </Text>
                  </View>
                )}
              </View>

              <Text style={[styles.statusDesc, { color: stateTheme.text }]}>
                {purityStatus.description}
              </Text>

              {/* Ghusl Forecast */}
              {purityStatus.expectedGhuslDate && (
                <View style={styles.ghuslBox}>
                  <Ionicons name="water-outline" size={16} color="#005F46" />
                  <Text style={styles.ghuslText}>
                    Expected Ghusl Date: <Text style={{ fontWeight: '800' }}>{purityStatus.expectedGhuslDate}</Text>
                  </Text>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.statusActionsRow}>
                {activeCycle ? (
                  <TouchableOpacity
                    style={[styles.primaryActionBtn, { backgroundColor: '#005F46' }]}
                    onPress={handleEndCycle}
                    activeOpacity={0.88}
                  >
                    <Ionicons name="water" size={18} color="#FFFFFF" />
                    <Text style={styles.primaryActionBtnText}>Bleeding Stopped / Record Ghusl</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.primaryActionBtn, { backgroundColor: '#DC2626' }]}
                    onPress={() => setLogModalVisible(true)}
                    activeOpacity={0.88}
                  >
                    <Ionicons name="add-circle" size={18} color="#FFFFFF" />
                    <Text style={styles.primaryActionBtnText}>Log Period / Nifas Start</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Ghusl / Paaki Reminder Card */}
            <View style={styles.reminderCard}>
              <View style={styles.reminderCardLeft}>
                <View style={styles.reminderIconWrap}>
                  <Ionicons name="alarm-outline" size={22} color="#005F46" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reminderTitle}>Ghusl / Paaki Morning Alert</Text>
                  <Text style={styles.reminderSubtitle}>
                    {activeCycle && purityStatus.expectedGhuslDate
                      ? `Alert set for 06:00 AM on expected Paaki day (${purityStatus.expectedGhuslDate})`
                      : 'Notifies you at 06:00 AM on expected Paaki day so Salah is not missed.'}
                  </Text>
                </View>
              </View>
              <Switch
                value={ghuslReminderEnabled}
                onValueChange={handleToggleGhuslReminder}
                trackColor={{ false: '#CBD5E1', true: '#10B981' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Daily Namaz Checklist (During Paaki / Tuhr / Istihaza) OR Shariah Exemption (During Haiz / Nifas) */}
            {purityStatus.isSalahObligatory ? (
              <View style={styles.namazCard}>
                <View style={styles.namazCardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="sparkles" size={18} color="#005F46" />
                    <Text style={styles.namazCardTitle}>Daily Namaz Checklist (حسابِ نماز)</Text>
                  </View>
                  <View style={styles.namazBadge}>
                    <Text style={styles.namazBadgeText}>
                      {[
                        namazRecord.fajr,
                        namazRecord.dhuhr,
                        namazRecord.asr,
                        namazRecord.maghrib,
                        namazRecord.isha,
                      ].filter(Boolean).length} / 5 ادا
                    </Text>
                  </View>
                </View>
                <Text style={styles.namazCardSubtitle}>
                  آپ حالتِ طہر (پاکی) میں ہیں۔ پنج وقتہ نماز کی پابندی فرمائیں اور ادا کر کے نشان لگائیں:
                </Text>

                <View style={styles.namazRowGrid}>
                  {[
                    { key: 'fajr' as NamazPrayerKey, nameUrdu: 'فجر', nameEn: 'Fajr', icon: 'sunny-outline' },
                    { key: 'dhuhr' as NamazPrayerKey, nameUrdu: 'ظہر', nameEn: 'Dhuhr', icon: 'sunny' },
                    { key: 'asr' as NamazPrayerKey, nameUrdu: 'عصر', nameEn: 'Asr', icon: 'partly-sunny-outline' },
                    { key: 'maghrib' as NamazPrayerKey, nameUrdu: 'مغرب', nameEn: 'Maghrib', icon: 'cloudy-night-outline' },
                    { key: 'isha' as NamazPrayerKey, nameUrdu: 'عشاء', nameEn: 'Isha', icon: 'moon' },
                  ].map((p) => {
                    const done = namazRecord[p.key];
                    return (
                      <TouchableOpacity
                        key={p.key}
                        style={[styles.namazItemBtn, done && styles.namazItemBtnDone]}
                        onPress={() => handleTogglePrayer(p.key)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={done ? 'checkmark-circle' : ('radio-button-off-outline' as any)}
                          size={18}
                          color={done ? '#FFFFFF' : '#94A3B8'}
                        />
                        <Text style={[styles.namazItemNameUrdu, done && styles.namazItemNameUrduDone]}>
                          {p.nameUrdu}
                        </Text>
                        <Text style={[styles.namazItemNameEn, done && styles.namazItemNameEnDone]}>
                          {p.nameEn}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : (
              <View style={styles.shariahExemptCard}>
                <View style={styles.shariahExemptHeader}>
                  <Ionicons name="heart-outline" size={20} color="#B91C1C" />
                  <Text style={styles.shariahExemptTitle}>شرعی رخصت (Shariah Exemption)</Text>
                </View>
                <Text style={styles.shariahExemptDesc}>
                  حیض و نفاس کے ایام میں اللہ تعالیٰ کی طرف سے نماز اور تلاوت معاف ہے، اور ان نمازوں کی قضا بھی لازم نہیں۔ البتہ ذکر و اذکار، دعائیں اور استغفار جاری رکھیں۔
                </Text>
              </View>
            )}

            {/* Past History List */}
            <View style={styles.historySection}>
              <Text style={styles.sectionTitle}>Past Cycle Records:</Text>
              {entries.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="document-text-outline" size={32} color="#94A3B8" />
                  <Text style={styles.emptyText}>No past cycle records found</Text>
                </View>
              ) : (
                entries.map((entry) => {
                  const startStr = new Date(entry.startDate).toLocaleDateString('ur-PK', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  });
                  const endStr = entry.endDate
                    ? new Date(entry.endDate).toLocaleDateString('ur-PK', {
                        day: 'numeric',
                        month: 'short',
                      })
                    : 'Ongoing';

                  return (
                    <View key={entry.id} style={styles.historyCard}>
                      <View style={styles.historyLeft}>
                        <View style={styles.historyDot} />
                        <View>
                          <Text style={styles.historyType}>
                            {entry.type === 'haiz' ? 'Hayd (Menses)' : entry.type === 'nifas' ? 'Nifas (Postnatal)' : 'Istihadha (Irregular)'}
                          </Text>
                          <Text style={styles.historyDates}>
                            {startStr} to {endStr}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleDeleteEntry(entry.id)}
                        style={styles.deleteBtn}
                      >
                        <Ionicons name="trash-outline" size={16} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}

        {/* TAB 2: QADHA FASTS */}
        {activeTab === 'qadha' && (
          <View style={styles.qadhaSection}>
            <View style={styles.qadhaCard}>
              <Text style={styles.qadhaTitle}>Ramadan Missed Fasts (Qadha)</Text>
              <Text style={styles.qadhaSub}>
                Fasts missed due to Hayd or Nifas must be made up before the next Ramadan:
              </Text>

              <View style={styles.qadhaStatsGrid}>
                <View style={styles.qadhaStatBox}>
                  <Text style={styles.qadhaStatNum}>{qadhaTotal}</Text>
                  <Text style={styles.qadhaStatLabel}>Total Missed Fasts</Text>
                </View>
                <View style={[styles.qadhaStatBox, { borderColor: '#10B981', backgroundColor: '#E8F5EE' }]}>
                  <Text style={[styles.qadhaStatNum, { color: '#005F46' }]}>{qadhaDone}</Text>
                  <Text style={styles.qadhaStatLabel}>Completed Fasts</Text>
                </View>
                <View style={[styles.qadhaStatBox, { borderColor: '#EF4444', backgroundColor: '#FEE2E2' }]}>
                  <Text style={[styles.qadhaStatNum, { color: '#B91C1C' }]}>
                    {Math.max(0, qadhaTotal - qadhaDone)}
                  </Text>
                  <Text style={styles.qadhaStatLabel}>Remaining Fasts</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.markQadhaBtn}
                onPress={handleIncrementQadhaDone}
                disabled={qadhaDone >= qadhaTotal && qadhaTotal > 0}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark-done" size={18} color="#FFFFFF" />
                <Text style={styles.markQadhaBtnText}>Alhamdulillah! Completed 1 Fast ✓</Text>
              </TouchableOpacity>

              <View style={styles.addQadhaRow}>
                <Text style={styles.addQadhaLabel}>Log Additional Missed Fasts:</Text>
                <View style={styles.addChipsRow}>
                  {[1, 5, 7].map((num) => (
                    <TouchableOpacity
                      key={num}
                      style={styles.addChip}
                      onPress={() => handleAddQadhaTotal(num)}
                    >
                      <Text style={styles.addChipText}>+{num} Fasts</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>
        )}

        {/* TAB 3: MASAIL GUIDE */}
        {activeTab === 'masail' && (
          <View style={styles.masailSection}>
            {[
              {
                q: 'What is the minimum and maximum duration of Hayd (Menstruation)?',
                a: 'According to Hanafi jurisprudence, the minimum duration of Hayd is 3 days and 3 nights (72 complete hours), and the maximum duration is 10 days and 10 nights (240 hours). Any bleeding outside this duration is considered Istihadha (irregular bleeding).',
                ref: 'Bahishti Zewar / Al-Hidayah',
              },
              {
                q: 'What is the minimum period of purity (Tuhr) between two menstrual cycles?',
                a: 'The minimum valid period of purity (Tuhr) between two cycles is 15 complete days. If bleeding recurs before 15 days of purity have elapsed, it is classified as Istihadha.',
                ref: 'Nur al-Idah',
              },
              {
                q: 'What is the ruling for Salah during Istihadha (irregular bleeding)?',
                a: 'Istihadha is due to a medical condition and does not exempt one from Salah or fasting. The woman performs fresh Wudhu after the entry of each prayer time and offers her prayers normally.',
                ref: 'Mukhtasar al-Quduri',
              },
              {
                q: 'What is the maximum duration of Nifas (postnatal bleeding)?',
                a: 'The maximum duration of Nifas following childbirth is 40 days. There is no minimum limit. Once bleeding ceases or upon completing 40 days, Ghusl is obligatory and Salah resumes immediately.',
                ref: 'Radd al-Muhtar / Shami',
              },
            ].map((m, idx) => (
              <View key={idx} style={styles.masailCard}>
                <Text style={styles.masailQ}>Question: {m.q}</Text>
                <Text style={styles.masailA}>{m.a}</Text>
                <Text style={styles.masailRef}>Reference: {m.ref}</Text>
              </View>
            ))}

            {/* Ask Muftiah CTA */}
            <TouchableOpacity
              style={styles.askMuftiahCard}
              onPress={() => router.push('/fatawa' as any)}
              activeOpacity={0.88}
            >
              <Ionicons name="ribbon" size={24} color="#C8A84E" />
              <View style={{ flex: 1 }}>
                <Text style={styles.askMuftiahTitle}>Complex Question? Ask Dar-ul-Iftaa</Text>
                <Text style={styles.askMuftiahSub}>
                  Consult our certified female scholars in complete privacy.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#C8A84E" />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* NEW CYCLE MODAL */}
      <Modal visible={logModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Log New Cycle Entry</Text>
              <TouchableOpacity onPress={() => setLogModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Type Selector */}
            <Text style={styles.fieldLabel}>Select Cycle Type:</Text>
            <View style={styles.typeSelectorRow}>
              {[
                { id: 'haiz', label: 'Hayd (Menstruation)' },
                { id: 'nifas', label: 'Nifas (Postnatal)' },
                { id: 'istihaza', label: 'Istihadha (Irregular)' },
              ].map((t) => {
                const isSelected = selectedType === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.typeChip, isSelected && styles.typeChipSelected]}
                    onPress={() => setSelectedType(t.id as any)}
                  >
                    <Text style={[styles.typeChipText, isSelected && styles.typeChipTextSelected]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Intensity */}
            <Text style={styles.fieldLabel}>Flow Intensity:</Text>
            <View style={styles.typeSelectorRow}>
              {[
                { id: 'light', label: 'Light' },
                { id: 'medium', label: 'Medium' },
                { id: 'heavy', label: 'Heavy' },
              ].map((i) => {
                const isSelected = intensity === i.id;
                return (
                  <TouchableOpacity
                    key={i.id}
                    style={[styles.typeChip, isSelected && styles.typeChipSelected]}
                    onPress={() => setIntensity(i.id as any)}
                  >
                    <Text style={[styles.typeChipText, isSelected && styles.typeChipTextSelected]}>
                      {i.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Notes */}
            <Text style={styles.fieldLabel}>Additional Notes (Optional):</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Notes regarding timing, color, or details..."
              placeholderTextColor="#94A3B8"
              value={notes}
              onChangeText={setNotes}
            />

            <TouchableOpacity style={styles.submitBtn} onPress={handleStartCycle} activeOpacity={0.88}>
              <Text style={styles.submitBtnText}>Save Entry</Text>
            </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  arabicHeader: {
    fontSize: 13,
    color: '#C8A84E',
    fontWeight: '800',
    fontFamily: Platform.select({ ios: 'Geeza Pro', default: 'sans-serif' }),
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  privacyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(200, 168, 78, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: SPACING.md,
    gap: 6,
  },
  privacyBannerText: {
    fontSize: 11,
    color: '#FDE047',
    fontWeight: '700',
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: 6,
    marginHorizontal: SPACING.md,
    marginTop: 10,
    borderRadius: RADIUS.lg,
    gap: 6,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    gap: 5,
  },
  tabBtnSelected: {
    backgroundColor: '#C8A84E',
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  tabBtnTextSelected: {
    color: '#002E23',
    fontWeight: '800',
  },
  scrollContent: {
    padding: SPACING.md,
    gap: 14,
    paddingBottom: 40,
  },
  statusCard: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 2,
    gap: 12,
    ...SHADOWS.card,
  },
  statusCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    gap: 5,
  },
  stateBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  daysPill: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  daysPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  statusDesc: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  ghuslBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: RADIUS.md,
    gap: 8,
  },
  ghuslText: {
    fontSize: 11,
    color: '#005F46',
  },
  statusActionsRow: {
    marginTop: 4,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: RADIUS.lg,
    gap: 8,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  historySection: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DC2626',
  },
  historyType: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  historyDates: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  deleteBtn: {
    padding: 6,
  },
  qadhaSection: {
    gap: 12,
  },
  qadhaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    gap: 12,
    ...SHADOWS.card,
  },
  qadhaTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  qadhaSub: {
    fontSize: 11,
    color: '#64748B',
  },
  qadhaStatsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  qadhaStatBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: RADIUS.md,
    padding: 10,
    alignItems: 'center',
    gap: 4,
  },
  qadhaStatNum: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
  },
  qadhaStatLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'center',
  },
  markQadhaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
    gap: 8,
  },
  markQadhaBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  addQadhaRow: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
    gap: 8,
  },
  addQadhaLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  addChipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  addChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#005F46',
  },
  masailSection: {
    gap: 10,
  },
  masailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: 6,
  },
  masailQ: {
    fontSize: 13,
    fontWeight: '800',
    color: '#005F46',
  },
  masailA: {
    fontSize: 12,
    lineHeight: 19,
    color: '#334155',
  },
  masailRef: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  askMuftiahCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#003D2E',
    borderWidth: 1.5,
    borderColor: '#C8A84E',
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    gap: 12,
    marginTop: 6,
  },
  askMuftiahTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  askMuftiahSub: {
    fontSize: 10,
    color: '#C8A84E',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.lg,
    paddingBottom: Platform.OS === 'ios' ? 34 : SPACING.lg,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeChip: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: RADIUS.md,
    paddingVertical: 8,
    alignItems: 'center',
  },
  typeChipSelected: {
    backgroundColor: '#E8F5EE',
    borderColor: '#005F46',
  },
  typeChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  typeChipTextSelected: {
    color: '#005F46',
  },
  notesInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: RADIUS.md,
    padding: 10,
    fontSize: 12,
    color: '#0F172A',
  },
  submitBtn: {
    backgroundColor: '#005F46',
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  reminderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
    ...SHADOWS.card,
  },
  reminderCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  reminderIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F5EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  reminderSubtitle: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 14,
  },
  namazCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    gap: 10,
    ...SHADOWS.card,
  },
  namazCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  namazCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#005F46',
  },
  namazBadge: {
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  namazBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#005F46',
  },
  namazCardSubtitle: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 16,
  },
  namazRowGrid: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  namazItemBtn: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: RADIUS.lg,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  namazItemBtnDone: {
    backgroundColor: '#005F46',
    borderColor: '#005F46',
  },
  namazItemNameUrdu: {
    fontSize: 13,
    fontWeight: '900',
    color: '#1E293B',
  },
  namazItemNameUrduDone: {
    color: '#FFFFFF',
  },
  namazItemNameEn: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
  },
  namazItemNameEnDone: {
    color: '#A7F3D0',
  },
  shariahExemptCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1.5,
    borderColor: '#FECACA',
    gap: 8,
  },
  shariahExemptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shariahExemptTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#991B1B',
  },
  shariahExemptDesc: {
    fontSize: 11,
    color: '#7F1D1D',
    lineHeight: 17,
  },
});
