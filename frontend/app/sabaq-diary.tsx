import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { collection, query, where, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLORS, RADIUS, SPACING, SHADOWS, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useActiveOrganization } from '@/lib/tenantContext';
import { goBackOrReplace } from '@/lib/navigation';
import {
  SabaqDiaryEntry,
  SabaqGrade,
  SABAQ_GRADE_CONFIG,
  recordSabaqEntry,
  subscribeToStudentSabaqDiary,
  formatSabaqDiaryForWhatsApp,
  getCachedStudentSabaqDiary,
  flushOfflineSabaqQueue,
  getOfflineSabaqQueueCount,
} from '@/lib/sabaqDiary';

const GRADES: SabaqGrade[] = ['Mumtaz', 'Jayyid Jiddan', 'Jayyid', 'Maqbool', 'Doharayein'];

export default function SabaqDiaryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();
  const { activeOrgId, activeOrg } = useActiveOrganization();

  const isTeacherOrAdmin =
    profile?.role === 'teacher' ||
    profile?.role === 'assistant_teacher' ||
    profile?.role === 'admin' ||
    profile?.role === 'super_admin';

  const [entries, setEntries] = useState<SabaqDiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);

  // Halqa Roster state for Teacher (Ghalati 1 Fix: 1-Tap Student Picker)
  type StudentRosterItem = {
    id: string;
    name: string;
    email?: string;
  };
  const [rosterStudents, setRosterStudents] = useState<StudentRosterItem[]>([]);
  const [searchRosterQuery, setSearchRosterQuery] = useState('');

  // Form state for Recording Entry
  const [studentName, setStudentName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [entryStatus, setEntryStatus] = useState<'present' | 'absent' | 'leave'>('present');

  // Sabaq Form
  const [sabaqText, setSabaqText] = useState('');
  const [sabaqGrade, setSabaqGrade] = useState<SabaqGrade>('Mumtaz');
  const [sabaqMistakes, setSabaqMistakes] = useState('0');

  // Sabqi Form
  const [sabqiText, setSabqiText] = useState('');
  const [sabqiGrade, setSabqiGrade] = useState<SabaqGrade>('Mumtaz');
  const [sabqiMistakes, setSabqiMistakes] = useState('0');

  // Manzil Form
  const [manzilText, setManzilText] = useState('');
  const [manzilJuz, setManzilJuz] = useState('30');
  const [manzilGrade, setManzilGrade] = useState<SabaqGrade>('Mumtaz');
  const [manzilMistakes, setManzilMistakes] = useState('0');

  const [teacherNotes, setTeacherNotes] = useState('');

  // Target student ID to query (if student, their own uid; if teacher, target student)
  const targetStudentId = isTeacherOrAdmin ? (studentId.trim() || user?.uid || '') : (user?.uid || '');

  // Roster fetching for teachers & admins
  useEffect(() => {
    if (!isTeacherOrAdmin) return;
    const isDefault = activeOrgId === 'mslb-main' || !activeOrgId;
    const q = isDefault
      ? query(collection(db, 'users'), where('role', '==', 'student'), limit(300))
      : query(collection(db, 'users'), where('role', '==', 'student'), where('organization_id', '==', activeOrgId), limit(300));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: StudentRosterItem[] = [];
        snap.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            name: data.name || data.displayName || 'طالبہ (Student)',
            email: data.email || '',
          });
        });
        list.sort((a, b) => a.name.localeCompare(b.name));
        setRosterStudents(list);
        if (list.length > 0 && !studentId) {
          setStudentId(list[0].id);
          setStudentName(list[0].name);
        }
      },
      (err) => {
        console.warn('[SabaqDiary] Error fetching roster students:', err);
      }
    );

    return () => unsub();
  }, [isTeacherOrAdmin, activeOrgId]);

  // Subscribe to student's diary & manage offline cache
  useEffect(() => {
    // 1. Immediately load local offline cache so screen is instant (0 ms latency)
    if (targetStudentId) {
      getCachedStudentSabaqDiary(targetStudentId).then((cached) => {
        if (cached && cached.length > 0) {
          setEntries(cached);
          setLoading(false);
        }
      });
    }

    // 2. Check offline queue and auto-flush if online
    getOfflineSabaqQueueCount().then(setOfflineQueueCount);
    flushOfflineSabaqQueue().then(({ synced }) => {
      if (synced > 0) {
        getOfflineSabaqQueueCount().then(setOfflineQueueCount);
      }
    });

    if (!targetStudentId) return;
    setLoading(true);
    const unsub = subscribeToStudentSabaqDiary(
      targetStudentId,
      (data) => {
        setEntries(data);
        setLoading(false);
      },
      activeOrgId
    );

    return () => unsub();
  }, [targetStudentId, activeOrgId]);

  const todayEntry = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return entries.find((e) => e.date === todayStr) || entries[0] || null;
  }, [entries]);

  const handleOpenModal = () => {
    setStudentName(isTeacherOrAdmin ? '' : profile?.name || 'Taliba');
    setStudentId(isTeacherOrAdmin ? '' : user?.uid || '');
    setEntryDate(new Date().toISOString().slice(0, 10));
    setEntryStatus('present');
    setSabaqText('');
    setSabaqGrade('Mumtaz');
    setSabaqMistakes('0');
    setSabqiText('');
    setSabqiGrade('Mumtaz');
    setSabqiMistakes('0');
    setManzilText('');
    setManzilJuz('30');
    setManzilGrade('Mumtaz');
    setManzilMistakes('0');
    setTeacherNotes('');
    setModalVisible(true);
  };

  const handleSaveEntry = async () => {
    const finalStudentId = studentId.trim() || user?.uid || '';
    const finalStudentName = studentName.trim() || profile?.name || 'Taliba';

    if (!finalStudentName) {
      Alert.alert('Required', 'Please enter student name.');
      return;
    }
    if (!sabaqText.trim() && !sabqiText.trim() && !manzilText.trim()) {
      Alert.alert('Required', 'Please fill in at least one portion (Sabaq, Sabqi, or Manzil).');
      return;
    }

    setSaving(true);
    try {
      const docId = await recordSabaqEntry({
        studentId: finalStudentId,
        studentName: finalStudentName,
        teacherId: user?.uid || 'teacher',
        teacherName: profile?.name || 'Ustaadha',
        organizationId: activeOrgId,
        institutionName: activeOrg?.name,
        date: entryDate,
        status: entryStatus,
        sabaq: {
          text: sabaqText.trim(),
          grade: sabaqGrade,
          mistakes: parseInt(sabaqMistakes, 10) || 0,
        },
        sabqi: {
          text: sabqiText.trim(),
          grade: sabqiGrade,
          mistakes: parseInt(sabqiMistakes, 10) || 0,
        },
        manzil: {
          text: manzilText.trim(),
          juz: parseInt(manzilJuz, 10) || undefined,
          grade: manzilGrade,
          mistakes: parseInt(manzilMistakes, 10) || 0,
        },
        teacherNotes,
      });

      setModalVisible(false);

      const savedEntry: SabaqDiaryEntry = {
        id: docId,
        organization_id: activeOrgId,
        institution_name: activeOrg?.name || 'Madrasa',
        student_id: finalStudentId,
        student_name: finalStudentName,
        teacher_id: user?.uid || 'teacher',
        teacher_name: profile?.name || 'Ustaadha',
        date: entryDate,
        status: entryStatus,
        sabaq: { text: sabaqText.trim(), grade: sabaqGrade, mistakes: parseInt(sabaqMistakes, 10) || 0 },
        sabqi: { text: sabqiText.trim(), grade: sabqiGrade, mistakes: parseInt(sabqiMistakes, 10) || 0 },
        manzil: { text: manzilText.trim(), juz: parseInt(manzilJuz, 10) || undefined, grade: manzilGrade, mistakes: parseInt(manzilMistakes, 10) || 0 },
        teacher_notes: teacherNotes,
      };

      Alert.alert(
        'Sabaq Recorded',
        'Today\'s Sabaq diary entry has been saved successfully.',
        [
          { text: 'Done', style: 'cancel' },
          {
            text: 'Share WhatsApp Report',
            onPress: () => handleShareWhatsApp(savedEntry),
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to record Sabaq.');
    } finally {
      setSaving(false);
    }
  };

  const handleShareWhatsApp = async (entry: SabaqDiaryEntry) => {
    const orgTitle = activeOrg?.name || 'Madrasatu-s-Salikat Lil Banat';
    const message = formatSabaqDiaryForWhatsApp(entry, orgTitle);
    const url = `whatsapp://send?text=${encodeURIComponent(message)}`;

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        await Clipboard.setStringAsync(message);
        Alert.alert(
          'Copied to Clipboard',
          'WhatsApp report text has been copied to your clipboard. You can paste it into any chat.'
        );
      }
    } catch {
      await Clipboard.setStringAsync(message);
      Alert.alert('Report Copied', 'Report has been copied to clipboard.');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => goBackOrReplace(router, '/more')}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.arabicHeader}>سَبَق ، سَبْقِی ، مَنْزِل</Text>
          <Text style={styles.headerTitle}>Hifz & Dars Daily Evaluation Diary</Text>
        </View>
        {isTeacherOrAdmin ? (
          <TouchableOpacity
            style={styles.recordBtn}
            onPress={handleOpenModal}
            accessibilityLabel="Record Sabaq"
          >
            <Ionicons name="add-circle" size={20} color="#FFFFFF" />
            <Text style={styles.recordBtnText}>New</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* Institution Context Banner */}
      <View style={styles.institutionBanner}>
        <Ionicons name="business" size={14} color="#059669" />
        <Text style={styles.institutionBannerText} numberOfLines={1}>
          Campus Diary: {activeOrg?.name || 'Madrasa'}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACING.md, paddingBottom: SPACING.xl * 2 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Halqa Student Selector Bar (Ghalati 1 Fix: 1-Tap Student Switcher) */}
        {isTeacherOrAdmin && rosterStudents.length > 0 && (
          <View style={styles.halqaCard}>
            <View style={styles.halqaHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="people" size={15} color="#005F46" />
                <Text style={styles.halqaTitle}>Madrasa Halqa Talibat ({rosterStudents.length})</Text>
              </View>
              <Text style={styles.halqaSub}>1-Tap switch student</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.halqaScrollRow}>
              {rosterStudents.map((st) => {
                const isSelected = targetStudentId === st.id;
                return (
                  <TouchableOpacity
                    key={st.id}
                    style={[styles.halqaChip, isSelected && styles.halqaChipSelected]}
                    onPress={() => {
                      setStudentId(st.id);
                      setStudentName(st.name);
                    }}
                  >
                    <View style={[styles.halqaAvatar, isSelected && styles.halqaAvatarSelected]}>
                      <Text style={[styles.halqaAvatarText, isSelected && styles.halqaAvatarTextSelected]}>
                        {st.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[styles.halqaName, isSelected && styles.halqaNameSelected]} numberOfLines={1}>
                      {st.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Islamic Purpose Banner */}
        <View style={styles.purposeCard}>
          <Ionicons name="ribbon-outline" size={24} color="#C8A84E" />
          <View style={{ flex: 1 }}>
            <Text style={styles.purposeTitle}>The Sacred Daily Routine</Text>
            <Text style={styles.purposeDesc}>
              Daily new recitation (نیا سبق), recent revision (سبقی), and complete cycle recitation (منزل) to protect and preserve the Holy Quran.
            </Text>
          </View>
        </View>

        {/* Loading Indicator */}
        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={{ marginTop: 10, color: COLORS.textMuted }}>Loading diary entries...</Text>
          </View>
        ) : entries.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="journal-outline" size={48} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No Sabaq Entries Yet</Text>
            <Text style={styles.emptyDesc}>
              {isTeacherOrAdmin
                ? 'Tap "+ New" above to record today\'s Sabaq, Sabqi, and Manzil for a student.'
                : 'Your teacher has not recorded an entry for today yet. Entries will appear here once graded.'}
            </Text>
            {isTeacherOrAdmin && (
              <TouchableOpacity style={styles.emptyActionBtn} onPress={handleOpenModal}>
                <Ionicons name="add" size={18} color="#FFFFFF" />
                <Text style={styles.emptyActionText}>Record Today's Entry</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            {/* LATEST / TODAY'S EVALUATION CARD */}
            {todayEntry && (
              <View style={styles.todayCard}>
                <View style={styles.todayCardHeader}>
                  <View>
                    <Text style={styles.todayBadge}>TODAY'S EVALUATION</Text>
                    <Text style={styles.todayStudentName}>{todayEntry.student_name}</Text>
                    <Text style={styles.todayDateText}>
                      📅 {todayEntry.date} • {todayEntry.status === 'present' ? '✅ حاضر (Present)' : '❌ غیر حاضر'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.whatsAppShareBtn}
                    onPress={() => handleShareWhatsApp(todayEntry)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
                    <Text style={styles.whatsAppBtnText}>WhatsApp Report</Text>
                  </TouchableOpacity>
                </View>

                {/* 1. SABAQ (New Lesson) */}
                <View style={styles.sectionRow}>
                  <View style={styles.sectionIconBox}>
                    <Text style={styles.sectionIconText}>📖</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.sectionTitleRow}>
                      <Text style={styles.sectionLabel}>نیا سبق (Sabaq - New Lesson)</Text>
                      <View
                        style={[
                          styles.gradeBadge,
                          { backgroundColor: SABAQ_GRADE_CONFIG[todayEntry.sabaq.grade]?.bg || '#ECFDF5' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.gradeBadgeText,
                            { color: SABAQ_GRADE_CONFIG[todayEntry.sabaq.grade]?.color || '#059669' },
                          ]}
                        >
                          {SABAQ_GRADE_CONFIG[todayEntry.sabaq.grade]?.arabic} ({todayEntry.sabaq.grade})
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.portionText}>{todayEntry.sabaq.text || 'N/A'}</Text>
                    {todayEntry.sabaq.mistakes !== undefined && (
                      <Text style={styles.mistakesText}>Attkiyan / Ghalatiyan: {todayEntry.sabaq.mistakes}</Text>
                    )}
                  </View>
                </View>

                {/* 2. SABQI (Recent Lessons) */}
                <View style={styles.sectionRow}>
                  <View style={styles.sectionIconBox}>
                    <Text style={styles.sectionIconText}>🔁</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.sectionTitleRow}>
                      <Text style={styles.sectionLabel}>سبقی (Sabqi - Recent Revision)</Text>
                      <View
                        style={[
                          styles.gradeBadge,
                          { backgroundColor: SABAQ_GRADE_CONFIG[todayEntry.sabqi.grade]?.bg || '#EFF6FF' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.gradeBadgeText,
                            { color: SABAQ_GRADE_CONFIG[todayEntry.sabqi.grade]?.color || '#2563EB' },
                          ]}
                        >
                          {SABAQ_GRADE_CONFIG[todayEntry.sabqi.grade]?.arabic} ({todayEntry.sabqi.grade})
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.portionText}>{todayEntry.sabqi.text || 'N/A'}</Text>
                    {todayEntry.sabqi.mistakes !== undefined && (
                      <Text style={styles.mistakesText}>Attkiyan / Ghalatiyan: {todayEntry.sabqi.mistakes}</Text>
                    )}
                  </View>
                </View>

                {/* 3. MANZIL (Cycle Revision) */}
                <View style={styles.sectionRow}>
                  <View style={styles.sectionIconBox}>
                    <Text style={styles.sectionIconText}>🌟</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.sectionTitleRow}>
                      <Text style={styles.sectionLabel}>منزل / دور (Manzil - Daily 1 Juz)</Text>
                      <View
                        style={[
                          styles.gradeBadge,
                          { backgroundColor: SABAQ_GRADE_CONFIG[todayEntry.manzil.grade]?.bg || '#FFFBEB' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.gradeBadgeText,
                            { color: SABAQ_GRADE_CONFIG[todayEntry.manzil.grade]?.color || '#D97706' },
                          ]}
                        >
                          {SABAQ_GRADE_CONFIG[todayEntry.manzil.grade]?.arabic} ({todayEntry.manzil.grade})
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.portionText}>
                      {todayEntry.manzil.text || 'N/A'} {todayEntry.manzil.juz ? `(Juz ${todayEntry.manzil.juz})` : ''}
                    </Text>
                    {todayEntry.manzil.mistakes !== undefined && (
                      <Text style={styles.mistakesText}>Attkiyan / Ghalatiyan: {todayEntry.manzil.mistakes}</Text>
                    )}
                  </View>
                </View>

                {/* Teacher Remarks */}
                {todayEntry.teacher_notes ? (
                  <View style={styles.teacherNotesBox}>
                    <Ionicons name="chatbubble-ellipses" size={16} color="#059669" />
                    <Text style={styles.teacherNotesText}>
                      <Text style={{ fontWeight: '700' }}>Ustaadha Remarks: </Text>
                      {todayEntry.teacher_notes}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.todayCardFooter}>
                  <Text style={styles.footerTeacherName}>Evaluated by: {todayEntry.teacher_name}</Text>
                </View>
              </View>
            )}

            {/* PREVIOUS ENTRIES TIMELINE */}
            <Text style={styles.historyHeading}>Past Diary History ({entries.length})</Text>
            {entries.slice(1).map((item) => (
              <View key={item.id} style={styles.historyCard}>
                <View style={styles.historyCardHeader}>
                  <Text style={styles.historyDate}>{item.date}</Text>
                  <TouchableOpacity
                    style={styles.historyShareBtn}
                    onPress={() => handleShareWhatsApp(item)}
                  >
                    <Ionicons name="logo-whatsapp" size={14} color="#16A34A" />
                    <Text style={styles.historyShareText}>Share</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.historyGradesRow}>
                  <View style={styles.historyGradeItem}>
                    <Text style={styles.historyGradeTitle}>Sabaq</Text>
                    <Text style={styles.historyGradeValue}>{item.sabaq.grade}</Text>
                  </View>
                  <View style={styles.historyGradeItem}>
                    <Text style={styles.historyGradeTitle}>Sabqi</Text>
                    <Text style={styles.historyGradeValue}>{item.sabqi.grade}</Text>
                  </View>
                  <View style={styles.historyGradeItem}>
                    <Text style={styles.historyGradeTitle}>Manzil</Text>
                    <Text style={styles.historyGradeValue}>{item.manzil.grade}</Text>
                  </View>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* RECORD ENTRY MODAL */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Record Daily Sabaq (نیا سبق)</Text>
                <Text style={styles.modalSubtitle}>{activeOrg?.name || 'Madrasa Campus'}</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: SPACING.md }} showsVerticalScrollIndicator={false}>
              {/* Student Selection (Ghalati 1 Fix: 1-Tap Student Selector, NO manual UID typing!) */}
              <Text style={styles.inputLabel}>طالبہ کا انتخاب (Select Taliba) *</Text>
              {isTeacherOrAdmin && rosterStudents.length > 0 ? (
                <View style={styles.studentPickerCard}>
                  <View style={styles.studentSearchBox}>
                    <Ionicons name="search" size={14} color="#059669" />
                    <TextInput
                      style={styles.studentSearchInput}
                      placeholder="Search student by name..."
                      placeholderTextColor="#94A3B8"
                      value={searchRosterQuery}
                      onChangeText={setSearchRosterQuery}
                    />
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.studentChipsPickerRow}
                  >
                    {rosterStudents
                      .filter((st) => !searchRosterQuery || st.name.toLowerCase().includes(searchRosterQuery.toLowerCase()))
                      .map((st) => {
                        const isSelected = studentId === st.id;
                        return (
                          <TouchableOpacity
                            key={st.id}
                            style={[styles.pickerStudentChip, isSelected && styles.pickerStudentChipSelected]}
                            onPress={() => {
                              setStudentId(st.id);
                              setStudentName(st.name);
                            }}
                          >
                            <View style={[styles.pickerStudentAvatar, isSelected && styles.pickerStudentAvatarSelected]}>
                              <Text style={[styles.pickerStudentAvatarText, isSelected && styles.pickerStudentAvatarTextSelected]}>
                                {st.name.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                            <Text style={[styles.pickerStudentChipName, isSelected && styles.pickerStudentChipNameSelected]}>
                              {st.name}
                            </Text>
                            {isSelected && <Ionicons name="checkmark-circle" size={14} color="#059669" />}
                          </TouchableOpacity>
                        );
                      })}
                  </ScrollView>
                </View>
              ) : null}

              {/* Selected Student Confirmation Pill */}
              <View style={styles.selectedStudentDisplayPill}>
                <Ionicons name="person" size={14} color="#059669" />
                <Text style={styles.selectedStudentDisplayText}>
                  Selected: <Text style={{ fontWeight: '800' }}>{studentName || 'Select a student above'}</Text>
                </Text>
              </View>

              {/* Date & Attendance */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={entryDate}
                    onChangeText={setEntryDate}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Attendance</Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                    {(['present', 'absent', 'leave'] as const).map((st) => (
                      <TouchableOpacity
                        key={st}
                        style={[styles.statusChip, entryStatus === st && styles.statusChipActive]}
                        onPress={() => setEntryStatus(st)}
                      >
                        <Text style={[styles.statusChipText, entryStatus === st && styles.statusChipTextActive]}>
                          {st === 'present' ? 'Present' : st === 'absent' ? 'Absent' : 'Leave'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {/* 1. SABAQ (New Lesson) */}
              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>1. 📖 Sabaq (Daily New Lesson / نیا سبق)</Text>
                <TextInput
                  style={styles.textInput}
                  value={sabaqText}
                  onChangeText={setSabaqText}
                  placeholder="e.g. Surah Al-Baqarah Ayah 1-25 (or Page 4)"
                />
                <Text style={styles.gradeSelectLabel}>Grade:</Text>
                <View style={styles.gradeChipsRow}>
                  {GRADES.map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[styles.gradeChip, sabaqGrade === g && styles.gradeChipActive]}
                      onPress={() => setSabaqGrade(g)}
                    >
                      <Text style={[styles.gradeChipText, sabaqGrade === g && styles.gradeChipTextActive]}>
                        {g}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.gradeSelectLabel}>Attkiyan / Ghalatiyan:</Text>
                <TextInput
                  style={[styles.textInput, { width: 90 }]}
                  value={sabaqMistakes}
                  onChangeText={setSabaqMistakes}
                  keyboardType="numeric"
                />
              </View>

              {/* 2. SABQI (Recent Lessons Revision) */}
              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>2. 🔁 Sabqi (Recent Lessons / پچھلا سبق)</Text>
                <TextInput
                  style={styles.textInput}
                  value={sabqiText}
                  onChangeText={setSabqiText}
                  placeholder="e.g. Last 5 Pages (Surah Al-Fatiha to Ayah 50)"
                />
                <Text style={styles.gradeSelectLabel}>Grade:</Text>
                <View style={styles.gradeChipsRow}>
                  {GRADES.map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[styles.gradeChip, sabqiGrade === g && styles.gradeChipActive]}
                      onPress={() => setSabqiGrade(g)}
                    >
                      <Text style={[styles.gradeChipText, sabqiGrade === g && styles.gradeChipTextActive]}>
                        {g}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.gradeSelectLabel}>Attkiyan / Ghalatiyan:</Text>
                <TextInput
                  style={[styles.textInput, { width: 90 }]}
                  value={sabqiMistakes}
                  onChangeText={setSabqiMistakes}
                  keyboardType="numeric"
                />
              </View>

              {/* 3. MANZIL (Cycle Revision) */}
              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>3. 🌟 Manzil / Daur (Daily 1 Juz Revision / منزل)</Text>
                <TextInput
                  style={styles.textInput}
                  value={manzilText}
                  onChangeText={setManzilText}
                  placeholder="e.g. 1st Half of Juz 30 (Amma)"
                />
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.gradeSelectLabel}>Juz Number (1-30):</Text>
                    <TextInput
                      style={[styles.textInput, { width: 90 }]}
                      value={manzilJuz}
                      onChangeText={setManzilJuz}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.gradeSelectLabel}>Attkiyan / Ghalatiyan:</Text>
                    <TextInput
                      style={[styles.textInput, { width: 90 }]}
                      value={manzilMistakes}
                      onChangeText={setManzilMistakes}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
                <Text style={styles.gradeSelectLabel}>Grade:</Text>
                <View style={styles.gradeChipsRow}>
                  {GRADES.map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[styles.gradeChip, manzilGrade === g && styles.gradeChipActive]}
                      onPress={() => setManzilGrade(g)}
                    >
                      <Text style={[styles.gradeChipText, manzilGrade === g && styles.gradeChipTextActive]}>
                        {g}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Teacher Remarks & Notes */}
              <Text style={styles.inputLabel}>Ustaadha Remarks / Dua</Text>
              <TextInput
                style={[styles.textInput, { height: 75, textAlignVertical: 'top' }]}
                value={teacherNotes}
                onChangeText={setTeacherNotes}
                placeholder="e.g. ماشاءاللہ بہت اچھے مخارج کے ساتھ پڑھا۔ حفظ مزید پختہ ہو رہا ہے۔"
                multiline
              />

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                onPress={handleSaveEntry}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-done" size={20} color="#FFFFFF" />
                    <Text style={styles.saveBtnText}>Save & Generate Report</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: SPACING.xs,
  },
  arabicHeader: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FDE68A',
    fontFamily: Platform.OS === 'ios' ? 'Geeza Pro' : 'serif',
  },
  headerTitle: {
    fontSize: 11,
    color: '#E2E8F0',
    fontWeight: '600',
  },
  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
  },
  recordBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  institutionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderBottomWidth: 1,
    borderBottomColor: '#D1FAE5',
    paddingHorizontal: SPACING.md,
    paddingVertical: 7,
    gap: 6,
  },
  institutionBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
    flex: 1,
  },
  purposeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFBEB',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: SPACING.md,
  },
  purposeTitle: {
    ...TYPOGRAPHY.heading,
    fontSize: 13,
    color: '#92400E',
    fontWeight: '800',
  },
  purposeDesc: {
    ...TYPOGRAPHY.body,
    fontSize: 11,
    color: '#B45309',
    marginTop: 2,
    lineHeight: 16,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    marginTop: SPACING.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    ...TYPOGRAPHY.heading,
    fontSize: 16,
    color: COLORS.text,
    marginTop: SPACING.sm,
  },
  emptyDesc: {
    ...TYPOGRAPHY.body,
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    marginTop: SPACING.md,
  },
  emptyActionText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  todayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.card,
    marginBottom: SPACING.lg,
  },
  todayCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  todayBadge: {
    fontSize: 10,
    fontWeight: '900',
    color: '#059669',
    letterSpacing: 0.8,
  },
  todayStudentName: {
    ...TYPOGRAPHY.heading,
    fontSize: 17,
    color: COLORS.text,
    fontWeight: '800',
    marginTop: 2,
  },
  todayDateText: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  whatsAppShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#25D366',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
  },
  whatsAppBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.lg,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  sectionIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionIconText: {
    fontSize: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.text,
  },
  portionText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '700',
    marginTop: 3,
  },
  mistakesText: {
    fontSize: 11,
    color: '#DC2626',
    marginTop: 2,
    fontWeight: '600',
  },
  gradeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  gradeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  teacherNotesBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: RADIUS.md,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  teacherNotesText: {
    fontSize: 12,
    color: '#065F46',
    flex: 1,
    lineHeight: 18,
  },
  todayCardFooter: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  footerTeacherName: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  historyHeading: {
    ...TYPOGRAPHY.heading,
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '800',
    marginBottom: 8,
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 6,
  },
  historyDate: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  historyShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  historyShareText: {
    fontSize: 11,
    color: '#16A34A',
    fontWeight: '700',
  },
  historyGradesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  historyGradeItem: {
    alignItems: 'center',
  },
  historyGradeTitle: {
    fontSize: 10,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
  },
  historyGradeValue: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    ...TYPOGRAPHY.heading,
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 8,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: COLORS.text,
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusChipActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#10B981',
  },
  statusChipText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  statusChipTextActive: {
    color: '#065F46',
    fontWeight: '800',
  },
  formSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.lg,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  formSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 6,
  },
  gradeSelectLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 6,
    marginBottom: 3,
    fontWeight: '600',
  },
  gradeChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  gradeChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  gradeChipActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  gradeChipText: {
    fontSize: 11,
    color: COLORS.text,
    fontWeight: '700',
  },
  gradeChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    marginTop: 16,
    marginBottom: 20,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  // Halqa & Student Picker Styles (Ghalati 1)
  halqaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8E4',
    ...SHADOWS.card,
  },
  halqaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  halqaTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#12332A',
  },
  halqaSub: {
    fontSize: 10.5,
    color: '#059669',
    fontWeight: '600',
  },
  halqaScrollRow: {
    gap: 8,
    paddingVertical: 2,
  },
  halqaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  halqaChipSelected: {
    backgroundColor: '#005F46',
    borderColor: '#005F46',
  },
  halqaAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  halqaAvatarSelected: {
    backgroundColor: '#0B6B53',
  },
  halqaAvatarText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#005F46',
  },
  halqaAvatarTextSelected: {
    color: '#FFFFFF',
  },
  halqaName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#12332A',
  },
  halqaNameSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  studentPickerCard: {
    backgroundColor: '#F8FAF9',
    borderRadius: RADIUS.md,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8E4',
    marginBottom: 8,
  },
  studentSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.md,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E2E8E4',
    marginBottom: 6,
  },
  studentSearchInput: {
    flex: 1,
    fontSize: 12,
    color: '#12332A',
    paddingVertical: 2,
  },
  studentChipsPickerRow: {
    gap: 6,
    paddingVertical: 2,
  },
  pickerStudentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  pickerStudentChipSelected: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669',
  },
  pickerStudentAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerStudentAvatarSelected: {
    backgroundColor: '#059669',
  },
  pickerStudentAvatarText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  pickerStudentAvatarTextSelected: {
    color: '#FFFFFF',
  },
  pickerStudentChipName: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#334155',
  },
  pickerStudentChipNameSelected: {
    color: '#065F46',
    fontWeight: '800',
  },
  selectedStudentDisplayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: 10,
  },
  selectedStudentDisplayText: {
    fontSize: 12,
    color: '#065F46',
  },
});
