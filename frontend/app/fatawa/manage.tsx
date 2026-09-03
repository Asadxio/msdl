import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING, SHADOWS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import {
  FATAWA_CATEGORIES,
  FatawaQuestion,
  answerFatawaQuestion,
  subscribeToPendingQuestionsForTeacher,
} from '@/lib/fatawa';
import { goBackOrReplace } from '@/lib/navigation';

export default function TeacherFatawaManageScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();

  const isTeacherOrAdmin =
    profile?.role === 'teacher' ||
    profile?.role === 'admin' ||
    profile?.role === 'super_admin';

  const [pendingQuestions, setPendingQuestions] = useState<FatawaQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  // Answering Modal State
  const [selectedQ, setSelectedQ] = useState<FatawaQuestion | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [refKitab, setRefKitab] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToPendingQuestionsForTeacher((data) => {
      setPendingQuestions(data);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleOpenAnswer = (q: FatawaQuestion) => {
    setSelectedQ(q);
    setAnswerText('');
    setRefKitab('');
    setIsPublic(false);
  };

  const handleAnswerSubmit = async () => {
    if (!selectedQ || !user?.uid) return;
    if (!answerText.trim() || answerText.trim().length < 5) {
      Alert.alert('Incomplete', 'Please provide a detailed scholarly answer.');
      return;
    }

    setSubmitting(true);
    try {
      await answerFatawaQuestion({
        questionId: selectedQ.id,
        teacherUid: user.uid,
        teacherName: profile?.name || 'Ustaadha / Muftiah',
        answer: answerText,
        referenceKitab: refKitab,
        isPublic,
      });

      setSelectedQ(null);
      Alert.alert('Fatwa Published', 'The answer has been dispatched to the student successfully.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to submit fatwa.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isTeacherOrAdmin) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="lock-closed-outline" size={48} color="#94A3B8" />
        <Text style={styles.notFoundText}>This portal is restricted to authorized faculty scholars only.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => goBackOrReplace(router, '/fatawa')}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => goBackOrReplace(router, '/fatawa')}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={'#FFFFFF'} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.arabicHeader}>FACULTY DAR-UL-IFTAA DESK</Text>
          <Text style={styles.headerTitle}>Ustaadha Masail Console</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.statsBanner}>
        <Ionicons name="mail-unread-outline" size={18} color="#C8A84E" />
        <Text style={styles.statsText}>
          Pending Inquiries: {pendingQuestions.length}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading inquiries...</Text>
          </View>
        ) : pendingQuestions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-done-circle-outline" size={54} color="#007A58" />
            <Text style={styles.emptyTitle}>All Inquiries Answered ✓</Text>
            <Text style={styles.emptySubtitle}>
              There are currently no unanswered questions pending.
            </Text>
          </View>
        ) : (
          pendingQuestions.map((q) => {
            const cat = FATAWA_CATEGORIES[q.category] || FATAWA_CATEGORIES.general;

            return (
              <View key={q.id} style={styles.questionCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.categoryBadge}>
                    <Ionicons name={cat.icon as any} size={14} color={COLORS.primary} />
                    <Text style={styles.categoryBadgeText}>{cat.arabicTitle}</Text>
                  </View>
                  <Text style={styles.studentBadge}>Inquirer: {q.student_name}</Text>
                </View>

                <Text style={styles.cardTitle}>{q.title}</Text>
                <Text style={styles.cardBody}>{q.question}</Text>

                <TouchableOpacity
                  style={styles.answerBtn}
                  onPress={() => handleOpenAnswer(q)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="pencil" size={16} color={'#FFFFFF'} />
                  <Text style={styles.answerBtnText}>Draft Answer</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Answer Modal */}
      <Modal
        visible={Boolean(selectedQ)}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedQ(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalArabicTitle}>SCHOLARLY RULING & VERDICT</Text>
                <Text style={styles.modalTitle}>Compose Shariah Verdict</Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setSelectedQ(null)}
              >
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            {selectedQ && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
                {/* Question Snapshot */}
                <View style={styles.qSnapshot}>
                  <Text style={styles.qSnapshotTitle}>{selectedQ.title}</Text>
                  <Text style={styles.qSnapshotBody}>{selectedQ.question}</Text>
                </View>

                {/* Answer Input */}
                <Text style={styles.inputLabel}>Scholarly Verdict / Guidance:</Text>
                <TextInput
                  style={styles.textAreaInput}
                  placeholder="In the Name of Allah... The Answer & Guidance:"
                  placeholderTextColor="#94A3B8"
                  value={answerText}
                  onChangeText={setAnswerText}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                />

                {/* Reference Input */}
                <Text style={styles.inputLabel}>Juristic Reference (Kitab / Page):</Text>
                <TextInput
                  style={styles.titleInput}
                  placeholder="e.g. Bahishti Zewar Part 2 / Fatawa Shami Vol 1"
                  placeholderTextColor="#94A3B8"
                  value={refKitab}
                  onChangeText={setRefKitab}
                />

                {/* Public Toggle */}
                <View style={styles.toggleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.toggleTitle}>Publish to Public Library</Text>
                    <Text style={styles.toggleSub}>
                      Student identity is kept completely private and masked.
                    </Text>
                  </View>
                  <Switch
                    value={isPublic}
                    onValueChange={setIsPublic}
                    trackColor={{ false: '#CBD5E1', true: '#005F46' }}
                    thumbColor={isPublic ? '#C8A84E' : '#F1F5F9'}
                  />
                </View>

                {/* Submit Answer Button */}
                <TouchableOpacity
                  style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                  onPress={handleAnswerSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color={'#FFFFFF'} />
                  ) : (
                    <>
                      <Ionicons name="checkmark-done" size={18} color={'#FFFFFF'} />
                      <Text style={styles.submitBtnText}>Authenticate & Dispatch Fatwa</Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
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
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  notFoundText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  backBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  arabicHeader: {
    fontSize: 14,
    color: '#C8A84E',
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  statsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(200, 168, 78, 0.16)',
    borderWidth: 1,
    borderColor: '#C8A84E',
    marginHorizontal: SPACING.md,
    marginVertical: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    gap: 8,
  },
  statsText: {
    fontSize: 12,
    color: '#C8A84E',
    fontWeight: '700',
  },
  scrollContent: {
    padding: SPACING.md,
    gap: 10,
    paddingBottom: 40,
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  questionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: 14,
    gap: 8,
    ...SHADOWS.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  studentBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardBody: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
  },
  answerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#005F46',
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    gap: 6,
    marginTop: 4,
  },
  answerBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalArabicTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#005F46',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    gap: 12,
    paddingBottom: 24,
  },
  qSnapshot: {
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#C8A84E',
    gap: 4,
  },
  qSnapshotTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  qSnapshotBody: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  titleInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  textAreaInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
    minHeight: 130,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  toggleSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#005F46',
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    gap: 8,
    marginTop: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
