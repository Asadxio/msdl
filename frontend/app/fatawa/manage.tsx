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
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING, SHADOWS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import {
  FATAWA_CATEGORIES,
  FatawaCategoryKey,
  FatawaQuestion,
  TeacherFatawaFilter,
  answerFatawaQuestion,
  subscribeToQuestionsForTeacher,
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

  const [questions, setQuestions] = useState<FatawaQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<TeacherFatawaFilter>('pending');
  const [categoryFilter, setCategoryFilter] = useState<FatawaCategoryKey | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Counts
  const [pendingCount, setPendingCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Answering Modal State
  const [selectedQ, setSelectedQ] = useState<FatawaQuestion | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [refKitab, setRefKitab] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    // Subscribe to all questions to compute dynamic badge counts and filter smoothly
    const unsub = subscribeToQuestionsForTeacher({ status: 'all' }, (data) => {
      setQuestions(data);
      const pending = data.filter((q) => q.status === 'pending').length;
      const answered = data.filter((q) => q.status === 'answered').length;
      setPendingCount(pending);
      setAnsweredCount(answered);
      setTotalCount(data.length);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleOpenAnswer = (q: FatawaQuestion) => {
    setSelectedQ(q);
    setAnswerText(q.answer || '');
    setRefKitab(q.reference_kitab || '');
    setIsPublic(Boolean(q.is_public));
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

  // Filter inquiries based on current filters
  const displayedQuestions = questions.filter((q) => {
    // 1. Status Filter
    if (statusFilter !== 'all' && q.status !== statusFilter) {
      return false;
    }

    // 2. Category Filter
    if (categoryFilter !== 'all' && q.category !== categoryFilter) {
      return false;
    }

    // 3. Search Query
    if (searchQuery.trim()) {
      const queryLower = searchQuery.toLowerCase().trim();
      const matchTitle = (q.title || '').toLowerCase().includes(queryLower);
      const matchQuestion = (q.question || '').toLowerCase().includes(queryLower);
      const matchStudent = (q.student_name || '').toLowerCase().includes(queryLower);
      const matchAnswer = (q.answer || '').toLowerCase().includes(queryLower);
      if (!matchTitle && !matchQuestion && !matchStudent && !matchAnswer) {
        return false;
      }
    }

    return true;
  });

  const categoriesList = (Object.keys(FATAWA_CATEGORIES) as FatawaCategoryKey[]);

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
          <Text style={styles.headerTitle}>Ustaadha Masail & Fatawa Console</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Filter Tabs: Pending (Default), Answered, All */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabButton, statusFilter === 'pending' && styles.activeTabButton]}
          onPress={() => setStatusFilter('pending')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="hourglass-outline"
            size={14}
            color={statusFilter === 'pending' ? '#FFFFFF' : '#94A3B8'}
          />
          <Text style={[styles.tabText, statusFilter === 'pending' && styles.activeTabText]}>
            Pending
          </Text>
          {pendingCount > 0 && (
            <View style={[styles.tabBadge, statusFilter === 'pending' && styles.activeTabBadge]}>
              <Text style={[styles.tabBadgeText, statusFilter === 'pending' && styles.activeTabBadgeText]}>
                {pendingCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, statusFilter === 'answered' && styles.activeTabButton]}
          onPress={() => setStatusFilter('answered')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="checkmark-circle-outline"
            size={14}
            color={statusFilter === 'answered' ? '#FFFFFF' : '#94A3B8'}
          />
          <Text style={[styles.tabText, statusFilter === 'answered' && styles.activeTabText]}>
            Answered
          </Text>
          <View style={[styles.tabBadge, statusFilter === 'answered' && styles.activeTabBadge]}>
            <Text style={[styles.tabBadgeText, statusFilter === 'answered' && styles.activeTabBadgeText]}>
              {answeredCount}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, statusFilter === 'all' && styles.activeTabButton]}
          onPress={() => setStatusFilter('all')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="list-outline"
            size={14}
            color={statusFilter === 'all' ? '#FFFFFF' : '#94A3B8'}
          />
          <Text style={[styles.tabText, statusFilter === 'all' && styles.activeTabText]}>
            All
          </Text>
          <View style={[styles.tabBadge, statusFilter === 'all' && styles.activeTabBadge]}>
            <Text style={[styles.tabBadgeText, statusFilter === 'all' && styles.activeTabBadgeText]}>
              {totalCount}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color="#94A3B8" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by title, question, or student name..."
          placeholderTextColor="#64748B"
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {/* Category Chips Scroll */}
      <View style={styles.categoryChipsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryChipsScroll}>
          <TouchableOpacity
            style={[styles.catChip, categoryFilter === 'all' && styles.activeCatChip]}
            onPress={() => setCategoryFilter('all')}
          >
            <Text style={[styles.catChipText, categoryFilter === 'all' && styles.activeCatChipText]}>
              All Topics
            </Text>
          </TouchableOpacity>

          {categoriesList.map((key) => {
            const item = FATAWA_CATEGORIES[key];
            const isSelected = categoryFilter === key;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.catChip, isSelected && styles.activeCatChip]}
                onPress={() => setCategoryFilter(key)}
              >
                <Ionicons
                  name={item.icon as any}
                  size={12}
                  color={isSelected ? '#FFFFFF' : '#CBD5E1'}
                />
                <Text style={[styles.catChipText, isSelected && styles.activeCatChipText]}>
                  {item.arabicTitle}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Inquiries List */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading inquiries...</Text>
          </View>
        ) : displayedQuestions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name={statusFilter === 'pending' ? 'checkmark-done-circle-outline' : 'search-outline'}
              size={54}
              color={statusFilter === 'pending' ? '#007A58' : '#64748B'}
            />
            <Text style={styles.emptyTitle}>
              {statusFilter === 'pending'
                ? 'No Pending Inquiries ✓'
                : 'No Inquiries Found'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {statusFilter === 'pending'
                ? 'MashaAllah! All incoming questions have been addressed.'
                : 'Try adjusting your search criteria or category filter.'}
            </Text>
          </View>
        ) : (
          displayedQuestions.map((q) => {
            const cat = FATAWA_CATEGORIES[q.category] || FATAWA_CATEGORIES.general;
            const isAnswered = q.status === 'answered';

            return (
              <View key={q.id} style={styles.questionCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.categoryBadge}>
                    <Ionicons name={cat.icon as any} size={14} color={COLORS.primary} />
                    <Text style={styles.categoryBadgeText}>{cat.arabicTitle}</Text>
                  </View>

                  <View style={styles.headerRightWrap}>
                    <View
                      style={[
                        styles.statusPill,
                        isAnswered ? styles.statusPillAnswered : styles.statusPillPending,
                      ]}
                    >
                      <Ionicons
                        name={isAnswered ? 'checkmark-circle' : 'hourglass'}
                        size={11}
                        color={isAnswered ? '#007A58' : '#C8A84E'}
                      />
                      <Text
                        style={[
                          styles.statusPillText,
                          isAnswered ? styles.statusPillTextAnswered : styles.statusPillTextPending,
                        ]}
                      >
                        {isAnswered ? 'Answered' : 'Pending'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.studentInfoRow}>
                  <Ionicons name="person-outline" size={13} color="#64748B" />
                  <Text style={styles.studentBadge}>Taliba: {q.student_name}</Text>
                </View>

                <Text style={styles.cardTitle}>{q.title}</Text>
                <Text style={styles.cardBody}>{q.question}</Text>

                {/* If already answered, show scholars answer snapshot */}
                {isAnswered && q.answer && (
                  <View style={styles.answeredBox}>
                    <View style={styles.answeredHeader}>
                      <Ionicons name="shield-checkmark" size={14} color="#005F46" />
                      <Text style={styles.answeredByText}>
                        Answered by: {q.answered_by_name || 'Muftiah'}
                      </Text>
                    </View>
                    <Text style={styles.answeredContent} numberOfLines={3}>
                      {q.answer}
                    </Text>
                    {q.reference_kitab && (
                      <Text style={styles.answeredReference}>
                        Reference: {q.reference_kitab}
                      </Text>
                    )}
                  </View>
                )}

                {/* Action button */}
                <TouchableOpacity
                  style={[styles.answerBtn, isAnswered && styles.editAnswerBtn]}
                  onPress={() => handleOpenAnswer(q)}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name={isAnswered ? 'create-outline' : 'pencil'}
                    size={16}
                    color={'#FFFFFF'}
                  />
                  <Text style={styles.answerBtnText}>
                    {isAnswered ? 'Update Ruling / Answer' : 'Draft Scholarly Answer'}
                  </Text>
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
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoidingWrap}
          >
            <View style={[styles.modalCard, { paddingBottom: Math.max(SPACING.lg, insets.bottom + 12) }]}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalArabicTitle}>SCHOLARLY RULING & VERDICT</Text>
                  <Text style={styles.modalTitle}>Compose Shariah Verdict</Text>
                </View>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => setSelectedQ(null)}
                  accessibilityLabel="Close dialog"
                >
                  <Ionicons name="close" size={22} color="#64748B" />
                </TouchableOpacity>
              </View>

              {selectedQ && (
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.modalScroll}
                  keyboardShouldPersistTaps="handled"
                >
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
          </KeyboardAvoidingView>
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
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: RADIUS.md,
    padding: 4,
    marginHorizontal: SPACING.md,
    marginTop: 8,
    gap: 6,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    gap: 6,
  },
  activeTabButton: {
    backgroundColor: '#005F46',
    borderWidth: 1,
    borderColor: '#C8A84E',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  activeTabText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  tabBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: RADIUS.full,
  },
  activeTabBadge: {
    backgroundColor: '#C8A84E',
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  activeTabBadgeText: {
    color: '#002E23',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: RADIUS.md,
    marginHorizontal: SPACING.md,
    marginTop: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 38,
    color: '#FFFFFF',
    fontSize: 13,
  },
  categoryChipsWrapper: {
    marginVertical: 8,
  },
  categoryChipsScroll: {
    paddingHorizontal: SPACING.md,
    gap: 6,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  activeCatChip: {
    backgroundColor: '#005F46',
    borderColor: '#C8A84E',
  },
  catChipText: {
    fontSize: 11,
    color: '#CBD5E1',
    fontWeight: '600',
  },
  activeCatChipText: {
    color: '#FFFFFF',
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
  headerRightWrap: {
    flexDirection: 'row',
    alignItems: 'center',
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
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  statusPillPending: {
    backgroundColor: '#FEF3C7',
  },
  statusPillAnswered: {
    backgroundColor: '#E8F5EE',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusPillTextPending: {
    color: '#B45309',
  },
  statusPillTextAnswered: {
    color: '#007A58',
  },
  studentInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
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
  answeredBox: {
    backgroundColor: '#F0FDF4',
    borderLeftWidth: 3,
    borderLeftColor: '#007A58',
    borderRadius: RADIUS.sm,
    padding: 10,
    gap: 4,
    marginVertical: 4,
  },
  answeredHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  answeredByText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#005F46',
  },
  answeredContent: {
    fontSize: 12,
    color: '#1E293B',
    lineHeight: 17,
  },
  answeredReference: {
    fontSize: 10,
    color: '#64748B',
    fontStyle: 'italic',
    marginTop: 2,
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
  editAnswerBtn: {
    backgroundColor: '#047857',
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
  keyboardAvoidingWrap: {
    width: '100%',
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
