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
} from '@/lib/taharatStorage';
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

  // New Log Form State
  const [selectedType, setSelectedType] = useState<'haiz' | 'nifas' | 'istihaza'>('haiz');
  const [intensity, setIntensity] = useState<'light' | 'medium' | 'heavy'>('medium');
  const [notes, setNotes] = useState('');

  const refreshData = async () => {
    const data = await loadTaharatData();
    setEntries(data.entries);
    setHabit(data.habit);
    setQadhaTotal(data.qadhaFastsTotal);
    setQadhaDone(data.qadhaFastsCompleted);
  };

  useEffect(() => {
    refreshData();
  }, []);

  const purityStatus: PurityCalculationResult = getCurrentPurityStatus(entries, habit);
  const activeCycle = entries.find((e) => !e.endDate);

  const handleStartCycle = async () => {
    const newEntry: CycleEntry = {
      id: 'cycle_' + Date.now(),
      startDate: new Date().toISOString(),
      type: selectedType,
      bleedingIntensity: intensity,
      notes: notes.trim() || undefined,
    };
    await saveCycleEntry(newEntry);
    setLogModalVisible(false);
    setNotes('');
    await refreshData();
    Alert.alert('رجوع ہو گیا', 'نیا شرعی ریکارڈ درج کر دیا گیا ہے۔');
  };

  const handleEndCycle = () => {
    if (!activeCycle) return;
    Alert.alert(
      'خون رک گیا / غسل کا وقت',
      'کیا خون مکمل طور پر بند ہو چکا ہے؟ اب غسل فرما کر نماز بحال کرنے کا وقت ہے۔',
      [
        { text: 'منسوخ', style: 'cancel' },
        {
          text: 'ہاں، خون بند ہو گیا',
          onPress: async () => {
            await endActiveCycle(activeCycle.id, new Date().toISOString());
            await refreshData();
            Alert.alert('الحمد للہ', 'طہارت کا وقت شروع ہو چکا ہے۔ برائے مہربانی غسل فرما کر نماز ادا فرمائیں۔');
          },
        },
      ]
    );
  };

  const handleDeleteEntry = (id: string) => {
    Alert.alert('حذف کریں', 'کیا آپ یہ ریکارڈ حذف کرنا چاہتی ہیں؟', [
      { text: 'منسوخ', style: 'cancel' },
      {
        text: 'حذف کریں',
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
          <Text style={styles.arabicHeader}>طَہَارَت وَ خَوَاتِین کِے مَسَائِل</Text>
          <Text style={styles.headerSubtitle}>Women's Purity & Taharat Tracker</Text>
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
          یہ ڈیٹا ۱۰۰٪ پرائیویٹ ہے اور صرف آپ کے اپنے فون میں محفوظ ہے۔
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {[
          { id: 'status', label: 'طہارت و ایام', icon: 'calendar-outline' },
          { id: 'qadha', label: 'قضائے صوم (روزے)', icon: 'moon-outline' },
          { id: 'masail', label: 'فقہی رہنمائی', icon: 'book-outline' },
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
                      دن: {purityStatus.activeCycleDays}
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
                    عادت کے مطابق متوقع غسل: <Text style={{ fontWeight: '800' }}>{purityStatus.expectedGhuslDate}</Text>
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
                    <Text style={styles.primaryActionBtnText}>خون رک گیا / غسل کا اندراج کریں</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.primaryActionBtn, { backgroundColor: '#DC2626' }]}
                    onPress={() => setLogModalVisible(true)}
                    activeOpacity={0.88}
                  >
                    <Ionicons name="add-circle" size={18} color="#FFFFFF" />
                    <Text style={styles.primaryActionBtnText}>حیض / نفاس کے آغاز کا اندراج</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Past History List */}
            <View style={styles.historySection}>
              <Text style={styles.sectionTitle}>ماضی کے شرعی ریکارڈز:</Text>
              {entries.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="document-text-outline" size={32} color="#94A3B8" />
                  <Text style={styles.emptyText}>کوئی سابقہ ریکارڈ موجود نہیں ہے۔</Text>
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
                    : 'جاری ہے';

                  return (
                    <View key={entry.id} style={styles.historyCard}>
                      <View style={styles.historyLeft}>
                        <View style={styles.historyDot} />
                        <View>
                          <Text style={styles.historyType}>
                            {entry.type === 'haiz' ? 'حیض' : entry.type === 'nifas' ? 'نفاس' : 'استحاضہ'}
                          </Text>
                          <Text style={styles.historyDates}>
                            {startStr} تا {endStr}
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
              <Text style={styles.qadhaTitle}>رمضان المبارک کے قضاء روزے</Text>
              <Text style={styles.qadhaSub}>
                حیض یا نفاس کی وجہ سے چھوٹے ہوئے روزوں کی قضاء فرض ہے:
              </Text>

              <View style={styles.qadhaStatsGrid}>
                <View style={styles.qadhaStatBox}>
                  <Text style={styles.qadhaStatNum}>{qadhaTotal}</Text>
                  <Text style={styles.qadhaStatLabel}>کل چھوٹے ہوئے روزے</Text>
                </View>
                <View style={[styles.qadhaStatBox, { borderColor: '#10B981', backgroundColor: '#E8F5EE' }]}>
                  <Text style={[styles.qadhaStatNum, { color: '#005F46' }]}>{qadhaDone}</Text>
                  <Text style={styles.qadhaStatLabel}>ادا شدہ قضاء روزے</Text>
                </View>
                <View style={[styles.qadhaStatBox, { borderColor: '#EF4444', backgroundColor: '#FEE2E2' }]}>
                  <Text style={[styles.qadhaStatNum, { color: '#B91C1C' }]}>
                    {Math.max(0, qadhaTotal - qadhaDone)}
                  </Text>
                  <Text style={styles.qadhaStatLabel}>باقی قضاء روزے</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.markQadhaBtn}
                onPress={handleIncrementQadhaDone}
                disabled={qadhaDone >= qadhaTotal && qadhaTotal > 0}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark-done" size={18} color="#FFFFFF" />
                <Text style={styles.markQadhaBtnText}>ماشاءاللہ! ۱ قضاء روزہ ادا ہو گیا</Text>
              </TouchableOpacity>

              <View style={styles.addQadhaRow}>
                <Text style={styles.addQadhaLabel}>نئے قضاء روزے شامل کریں:</Text>
                <View style={styles.addChipsRow}>
                  {[1, 5, 7].map((num) => (
                    <TouchableOpacity
                      key={num}
                      style={styles.addChip}
                      onPress={() => handleAddQadhaTotal(num)}
                    >
                      <Text style={styles.addChipText}>+{num} روزے</Text>
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
                q: 'حیض کی کم از کم اور زیادہ سے زیادہ مدت کیا ہے؟',
                a: 'فقہ حنفی کے مطابق حیض کی کم از کم مدت ۳ دن اور ۳ راتیں (پورے ۷۲ گھنٹے) ہیں، اور زیادہ سے زیادہ مدت ۱۰ دن اور ۱۰ راتیں (۲۴۰ گھنٹے) ہیں۔',
                ref: 'بہشتی زیور / الہدایۃ',
              },
              {
                q: 'دو حیض کے درمیان پاکی (طہر) کا کم از کم وقفہ کتنا ہے؟',
                a: 'دو حیض کے درمیان کم از کم ۱۵ دن کی پاکی کا ہونا ضروری ہے۔ اگر ۱۵ دن سے پہلے خون آ جائے تو وہ استحاضہ شمار ہوگا۔',
                ref: 'نور الایضاح',
              },
              {
                q: 'حالتِ استحاضہ میں نماز کا کیا طریقہ ہے؟',
                a: 'استحاضہ بیماری کا خون ہے جس میں نماز اور روزہ معاف نہیں ہے۔ ہر نماز کے وقت کے داخل ہونے کے بعد نیا وضو فرما کر نماز ادا کی جائے گی۔',
                ref: 'قدوری',
              },
              {
                q: 'نفاس کی زیادہ سے زیادہ مدت کیا ہے؟',
                a: 'بچے کی ولادت کے بعد نفاس کی زیادہ سے زیادہ مدت ۴۰ دن ہے، کم کی کوئی حد نہیں ہے۔ ۴۰ دن مکمل ہوتے ہی غسل فرض ہو جاتا ہے۔',
                ref: 'رد المحتار / شامی',
              },
            ].map((m, idx) => (
              <View key={idx} style={styles.masailCard}>
                <Text style={styles.masailQ}>سوال: {m.q}</Text>
                <Text style={styles.masailA}>{m.a}</Text>
                <Text style={styles.masailRef}>حوالہ: {m.ref}</Text>
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
                <Text style={styles.askMuftiahTitle}>پیچیدہ مسئلہ؟ دار الافتاء سے پوچھیں</Text>
                <Text style={styles.askMuftiahSub}>
                  سینئر مفتیہ صاحبہ سے مکمل پردے میں اپنا سوال پوچھیں۔
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
              <Text style={styles.modalTitle}>نیا شرعی اندراج درج کریں</Text>
              <TouchableOpacity onPress={() => setLogModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Type Selector */}
            <Text style={styles.fieldLabel}>قسم منتخب فرمائیں:</Text>
            <View style={styles.typeSelectorRow}>
              {[
                { id: 'haiz', label: 'حیض (Menses)' },
                { id: 'nifas', label: 'نفاس (Post-natal)' },
                { id: 'istihaza', label: 'استحاضہ (Irregular)' },
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
            <Text style={styles.fieldLabel}>خون کا بہاؤ (Flow Intensity):</Text>
            <View style={styles.typeSelectorRow}>
              {[
                { id: 'light', label: 'ہلکا (Light)' },
                { id: 'medium', label: 'درمیانہ (Medium)' },
                { id: 'heavy', label: 'زیادہ (Heavy)' },
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
            <Text style={styles.fieldLabel}>اضافی نوٹس (اختیاری):</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="وقت یا رنگ سے متعلق کوئی یادداشت..."
              placeholderTextColor="#94A3B8"
              value={notes}
              onChangeText={setNotes}
            />

            <TouchableOpacity style={styles.submitBtn} onPress={handleStartCycle} activeOpacity={0.88}>
              <Text style={styles.submitBtnText}>محفوظ کریں (Save Entry)</Text>
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
});
