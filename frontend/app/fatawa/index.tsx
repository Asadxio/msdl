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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING, SHADOWS, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import {
  FATAWA_CATEGORIES,
  FatawaCategoryKey,
  FatawaQuestion,
  askFatawaQuestion,
  subscribeToMyQuestions,
  subscribeToPublicFatawa,
} from '@/lib/fatawa';
import { goBackOrReplace } from '@/lib/navigation';

export default function DarUlIftaaScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();

  const isTeacherOrAdmin =
    profile?.role === 'teacher' ||
    profile?.role === 'admin' ||
    profile?.role === 'super_admin';

  const [activeTab, setActiveTab] = useState<'my_questions' | 'public_library'>('my_questions');
  const [selectedCategory, setSelectedCategory] = useState<FatawaCategoryKey | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [myQuestions, setMyQuestions] = useState<FatawaQuestion[]>([]);
  const [publicFatawa, setPublicFatawa] = useState<FatawaQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [askCategory, setAskCategory] = useState<FatawaCategoryKey>('taharat');
  const [askTitle, setAskTitle] = useState('');
  const [askQuestion, setAskQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Subscribe to questions
  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    const unsubMy = subscribeToMyQuestions(user.uid, (data) => {
      setMyQuestions(data);
      setLoading(false);
    });

    return () => unsubMy();
  }, [user?.uid]);

  useEffect(() => {
    setLoading(true);
    const unsubPub = subscribeToPublicFatawa(selectedCategory, (data) => {
      setPublicFatawa(data);
      setLoading(false);
    });

    return () => unsubPub();
  }, [selectedCategory]);

  const handleAskSubmit = async () => {
    if (!user?.uid) {
      Alert.alert('Error', 'Please sign in to ask a question.');
      return;
    }
    if (!askTitle.trim() || askTitle.trim().length < 3) {
      Alert.alert('Incomplete', 'Please enter a short title for your question.');
      return;
    }
    if (!askQuestion.trim() || askQuestion.trim().length < 10) {
      Alert.alert('Incomplete', 'Please write your question in detail (at least 10 characters).');
      return;
    }

    setSubmitting(true);
    try {
      await askFatawaQuestion({
        userId: user.uid,
        userName: profile?.name || 'Taliba',
        category: askCategory,
        title: askTitle,
        question: askQuestion,
      });

      setAskTitle('');
      setAskQuestion('');
      setModalVisible(false);
      Alert.alert(
        'Question Submitted',
        'Your question has been received by Dar-ul-Iftaa. Certified scholars will provide guidance shortly.'
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not submit your question.');
    } finally {
      setSubmitting(false);
    }
  };

  const categoriesList = useMemo(() => Object.values(FATAWA_CATEGORIES), []);

  const filteredMyQuestions = useMemo(() => {
    if (!searchQuery.trim()) return myQuestions;
    const q = searchQuery.toLowerCase().trim();
    return myQuestions.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.question.toLowerCase().includes(q) ||
        (item.answer && item.answer.toLowerCase().includes(q))
    );
  }, [myQuestions, searchQuery]);

  const filteredPublicFatawa = useMemo(() => {
    if (!searchQuery.trim()) return publicFatawa;
    const q = searchQuery.toLowerCase().trim();
    return publicFatawa.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.question.toLowerCase().includes(q) ||
        (item.answer && item.answer.toLowerCase().includes(q)) ||
        (item.reference_kitab && item.reference_kitab.toLowerCase().includes(q))
    );
  }, [publicFatawa, searchQuery]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => goBackOrReplace(router, '/(tabs)')}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.arabicHeader}>Dar-ul-Iftaa & Masail</Text>
          <Text style={styles.headerTitle}>Private Islamic Guidance & Fatwa Library</Text>
        </View>
        {isTeacherOrAdmin ? (
          <TouchableOpacity
            style={styles.teacherPortalBtn}
            onPress={() => router.push('/fatawa/manage' as any)}
            accessibilityLabel="Teacher Console"
          >
            <Ionicons name="shield-checkmark" size={18} color="#C8A84E" />
            <Text style={styles.teacherBtnText}>Portal</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* Purdah Banner */}
      <View style={styles.purdahBanner}>
        <Ionicons name="lock-closed" size={16} color="#005F46" />
        <Text style={styles.purdahBannerText}>
          100% Confidential & Private — Your questions are reviewed only by authorized scholars.
        </Text>
      </View>

      {/* Search Input Bar */}
      <View style={styles.searchBarWrap}>
        <Ionicons name="search-outline" size={18} color="#64748B" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search Masail (e.g. Wudu, Namaz, Roza)..."
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'my_questions' && styles.tabButtonActive]}
          onPress={() => setActiveTab('my_questions')}
        >
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={18}
            color={activeTab === 'my_questions' ? COLORS.primary : '#64748B'}
          />
          <Text
            style={[styles.tabText, activeTab === 'my_questions' && styles.tabTextActive]}
          >
            My Questions ({myQuestions.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'public_library' && styles.tabButtonActive]}
          onPress={() => setActiveTab('public_library')}
        >
          <Ionicons
            name="library-outline"
            size={18}
            color={activeTab === 'public_library' ? COLORS.primary : '#64748B'}
          />
          <Text
            style={[styles.tabText, activeTab === 'public_library' && styles.tabTextActive]}
          >
            Public Fatwa Library
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'public_library' && (
          <View style={styles.categoryFilterWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
              <TouchableOpacity
                style={[styles.categoryChip, selectedCategory === 'all' && styles.categoryChipActive]}
                onPress={() => setSelectedCategory('all')}
              >
                <Text style={[styles.chipText, selectedCategory === 'all' && styles.chipTextActive]}>
                  All Topics
                </Text>
              </TouchableOpacity>
              {categoriesList.map((cat) => (
                <TouchableOpacity
                  key={cat.key}
                  style={[styles.categoryChip, selectedCategory === cat.key && styles.categoryChipActive]}
                  onPress={() => setSelectedCategory(cat.key)}
                >
                  <Text style={[styles.chipText, selectedCategory === cat.key && styles.chipTextActive]}>
                    {cat.arabicTitle}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading rulings...</Text>
          </View>
        ) : activeTab === 'my_questions' ? (
          filteredMyQuestions.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="chatbubbles-outline" size={48} color="#94A3B8" />
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'No question found' : 'No questions asked yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? 'Try searching with different keywords.'
                  : 'If you have any questions regarding Taharat, Namaz, Roza or daily Islamic life, ask directly to authorized scholars below.'}
              </Text>
              {!searchQuery && (
                <TouchableOpacity
                  style={styles.emptyActionBtn}
                  onPress={() => setModalVisible(true)}
                >
                  <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.emptyActionText}>Ask New Question</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filteredMyQuestions.map((q) => {
              const cat = FATAWA_CATEGORIES[q.category] || FATAWA_CATEGORIES.general;
              const isAnswered = q.status === 'answered';

              return (
                <TouchableOpacity
                  key={q.id}
                  style={styles.questionCard}
                  onPress={() => router.push(/fatawa/ as any)}
                  activeOpacity={0.8}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.categoryBadge}>
                      <Ionicons name={cat.icon as any} size={14} color={COLORS.primary} />
                      <Text style={styles.categoryBadgeText}>{cat.arabicTitle}</Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        isAnswered ? styles.statusAnswered : styles.statusPending,
                      ]}
                    >
                      <Ionicons
                        name={isAnswered ? 'checkmark-circle' : 'time-outline'}
                        size={12}
                        color={isAnswered ? '#007A58' : '#B45309'}
                      />
                      <Text
                        style={[
                          styles.statusText,
                          isAnswered ? styles.statusTextAnswered : styles.statusTextPending,
                        ]}
                      >
                        {isAnswered ? 'Answered' : 'Under Review'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.cardTitle}>{q.title}</Text>
                  <Text style={styles.cardSnippet} numberOfLines={2}>
                    {q.question}
                  </Text>

                  {isAnswered && (
                    <View style={styles.answerPreviewBox}>
                      <Text style={styles.answerLabel}>Answer Summary ({q.answered_by_name || 'Faculty'}):</Text>
                      <Text style={styles.answerSnippet} numberOfLines={2}>
                        {q.answer}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )
        ) : (
          filteredPublicFatawa.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="book-outline" size={48} color="#94A3B8" />
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'No rulings found matching your search' : 'No rulings available in this category yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                Select another category or modify your search keywords.
              </Text>
            </View>
          ) : (
            filteredPublicFatawa.map((q) => {
              const cat = FATAWA_CATEGORIES[q.category] || FATAWA_CATEGORIES.general;

              return (
                <TouchableOpacity
                  key={q.id}
                  style={styles.questionCard}
                  onPress={() => router.push(/fatawa/ as any)}
                  activeOpacity={0.8}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.categoryBadge}>
                      <Ionicons name={cat.icon as any} size={14} color={COLORS.primary} />
                      <Text style={styles.categoryBadgeText}>{cat.arabicTitle}</Text>
                    </View>
                    <Text style={styles.referenceBadge}>
                      {q.reference_kitab || 'Fiqh Reference'}
                    </Text>
                  </View>

                  <Text style={styles.cardTitle}>{q.title}</Text>
                  <Text style={styles.cardSnippet} numberOfLines={2}>
                    {q.question}
                  </Text>

                  <View style={styles.answerPreviewBox}>
                    <Text style={styles.answerLabel}>Shariah Ruling & Answer:</Text>
                    <Text style={styles.answerSnippet} numberOfLines={3}>
                      {q.answer}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )
        )}
      </ScrollView>

      {/* Floating Ask Button */}
      <TouchableOpacity
        style={styles.floatingAskBtn}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.85}
        accessibilityLabel="Ask a question"
      >
        <Ionicons name="add" size={24} color="#FFFFFF" />
        <Text style={styles.floatingAskText}>Ask Question (+)</Text>
      </TouchableOpacity>

      {/* Ask Question Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalArabicTitle}>DAR-UL-IFTAA CONSULTATION</Text>
                <Text style={styles.modalTitle}>Submit Your Fiqh Question</Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
              {/* Category Picker */}
              <Text style={styles.inputLabel}>Select Category:</Text>
              <View style={styles.catGrid}>
                {categoriesList.map((cat) => {
                  const selected = askCategory === cat.key;
                  return (
                    <TouchableOpacity
                      key={cat.key}
                      style={[styles.catGridItem, selected && styles.catGridItemSelected]}
                      onPress={() => setAskCategory(cat.key)}
                    >
                      <Ionicons
                        name={cat.icon as any}
                        size={16}
                        color={selected ? '#FFFFFF' : COLORS.primary}
                      />
                      <Text
                        style={[styles.catGridText, selected && styles.catGridTextSelected]}
                      >
                        {cat.arabicTitle}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Title Input */}
              <Text style={styles.inputLabel}>Question Title:</Text>
              <TextInput
                style={styles.titleInput}
                placeholder="e.g. Ruling regarding doubt during Salah"
                placeholderTextColor="#94A3B8"
                value={askTitle}
                onChangeText={setAskTitle}
                maxLength={80}
              />

              {/* Detail Input */}
              <Text style={styles.inputLabel}>Detailed Question:</Text>
              <TextInput
                style={styles.textAreaInput}
                placeholder="Please describe your question in detail..."
                placeholderTextColor="#94A3B8"
                value={askQuestion}
                onChangeText={setAskQuestion}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />

              {/* Privacy Notice */}
              <View style={styles.modalPurdahNotice}>
                <Ionicons name="shield-checkmark" size={16} color="#005F46" />
                <Text style={styles.modalPurdahText}>
                  Your inquiry is delivered directly to certified scholars. Your details are kept strictly confidential.
                </Text>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={handleAskSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="paper-plane" size={18} color="#FFFFFF" />
                    <Text style={styles.submitBtnText}>Submit to Dar-ul-Iftaa</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
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
    fontSize: 16,
    color: '#C8A84E',
    fontWeight: '800',
    fontFamily: Platform.select({ ios: 'Geeza Pro', default: 'sans-serif' }),
  },
  headerTitle: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  teacherPortalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(200, 168, 78, 0.18)',
    borderWidth: 1,
    borderColor: '#C8A84E',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  teacherBtnText: {
    color: '#C8A84E',
    fontSize: 11,
    fontWeight: '700',
  },
  purdahBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5EE',
    marginHorizontal: SPACING.md,
    marginVertical: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    gap: 8,
  },
  purdahBannerText: {
    fontSize: 11,
    color: '#005F46',
    fontWeight: '600',
    flex: 1,
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: SPACING.md,
    marginVertical: 4,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 12,
    color: '#0F172A',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: SPACING.md,
    marginTop: 4,
    borderRadius: RADIUS.lg,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: '#E8F5EE',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  categoryFilterWrap: {
    marginBottom: 8,
  },
  chipScroll: {
    gap: 6,
    paddingVertical: 4,
  },
  categoryChip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryChipActive: {
    backgroundColor: '#005F46',
    borderColor: '#005F46',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 100,
    gap: 10,
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
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    marginTop: 8,
  },
  emptyActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  questionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: 14,
    gap: 6,
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
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusAnswered: {
    backgroundColor: '#DCFCE7',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusTextPending: {
    color: '#B45309',
  },
  statusTextAnswered: {
    color: '#007A58',
  },
  referenceBadge: {
    fontSize: 10,
    color: '#C8A84E',
    fontWeight: '700',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardSnippet: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  answerPreviewBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#005F46',
    gap: 2,
    marginTop: 4,
  },
  answerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#005F46',
  },
  answerSnippet: {
    fontSize: 11,
    color: '#334155',
    lineHeight: 16,
  },
  floatingAskBtn: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#C8A84E',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: RADIUS.full,
    gap: 6,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
  },
  floatingAskText: {
    color: '#002E23',
    fontSize: 13,
    fontWeight: '800',
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
    maxHeight: '85%',
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
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catGridItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
    gap: 6,
  },
  catGridItemSelected: {
    backgroundColor: '#005F46',
    borderColor: '#005F46',
  },
  catGridText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  catGridTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
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
    minHeight: 110,
  },
  modalPurdahNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5EE',
    padding: 10,
    borderRadius: RADIUS.md,
    gap: 8,
  },
  modalPurdahText: {
    fontSize: 11,
    color: '#005F46',
    fontWeight: '600',
    flex: 1,
    lineHeight: 16,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    gap: 8,
    marginTop: 6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
