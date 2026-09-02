import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  FlatList,
  StatusBar,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLORS, RADIUS, SPACING, SHADOWS } from '@/constants/theme';
import { QUIZ_CATEGORIES } from '@/constants/quizCategories';
import { useAuth } from '@/context/AuthContext';
import { goBackOrReplace } from '@/lib/navigation';
import { clearQuizCounts } from '@/lib/lmsHardening';

interface QuizDoc {
  id: string;
  question: string;
  options: string[];
  correct_answer: string;
  category: string;
  explanation?: string;
  difficulty?: string;
}

export default function AdminManageQuizzesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useAuth();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [questions, setQuestions] = useState<QuizDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Edit Modal State
  const [editingQuestion, setEditingQuestion] = useState<QuizDoc | null>(null);
  const [editQText, setEditQText] = useState('');
  const [editOptions, setEditOptions] = useState<string[]>(['', '', '', '']);
  const [editCorrect, setEditCorrect] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editExplanation, setEditExplanation] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      let q = collection(db, 'quizzes');
      let snap;
      if (selectedCategory && selectedCategory !== 'all') {
        const qRef = query(q, where('category', '==', selectedCategory));
        snap = await getDocs(qRef);
      } else {
        snap = await getDocs(q);
      }

      const list: QuizDoc[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          question: data.question || '',
          options: Array.isArray(data.options) ? data.options : [],
          correct_answer: data.correct_answer || data.correctAnswer || '',
          category: data.category || 'General',
          explanation: data.explanation || '',
          difficulty: data.difficulty || 'easy',
        });
      });
      setQuestions(list);
    } catch (err) {
      console.warn('Failed to load questions:', err);
      Alert.alert('Error', 'Could not load questions from Firestore.');
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const filteredQuestions = useMemo(() => {
    if (!search.trim()) return questions;
    const s = search.toLowerCase();
    return questions.filter(
      (q) =>
        q.question.toLowerCase().includes(s) ||
        q.category.toLowerCase().includes(s) ||
        q.options.some((opt) => opt.toLowerCase().includes(s))
    );
  }, [questions, search]);

  const handleDelete = (item: QuizDoc) => {
    Alert.alert(
      'Delete Question',
      `Are you sure you want to permanently delete this question from "${item.category}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'quizzes', item.id));
              await clearQuizCounts().catch(() => {});
              setQuestions((prev) => prev.filter((q) => q.id !== item.id));
              Alert.alert('Deleted', 'Question deleted successfully from Firestore.');
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete question.');
            }
          },
        },
      ]
    );
  };

  const handleBulkDeleteCategory = () => {
    if (selectedCategory === 'all') {
      Alert.alert('Select Category', 'Please select a specific category from the filter chips above to bulk delete.');
      return;
    }

    Alert.alert(
      'Bulk Delete All Questions',
      `WARNING: This will permanently delete all ${questions.length} questions under "${selectedCategory}". This cannot be undone!`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All Questions',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const batch = writeBatch(db);
              questions.forEach((q) => {
                batch.delete(doc(db, 'quizzes', q.id));
              });
              await batch.commit();
              await clearQuizCounts().catch(() => {});
              setQuestions([]);
              Alert.alert('Deleted!', `All questions under "${selectedCategory}" have been deleted.`);
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete all questions.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const openEditModal = (item: QuizDoc) => {
    setEditingQuestion(item);
    setEditQText(item.question);
    setEditOptions(item.options.length === 4 ? [...item.options] : [...item.options, '', '', '', ''].slice(0, 4));
    setEditCorrect(item.correct_answer);
    setEditCategory(item.category);
    setEditExplanation(item.explanation || '');
  };

  const saveEditModal = async () => {
    if (!editingQuestion) return;
    if (!editQText.trim()) {
      Alert.alert('Validation Error', 'Question cannot be empty.');
      return;
    }
    const cleanOpts = editOptions.map((o) => o.trim()).filter((o) => o.length > 0);
    if (cleanOpts.length < 2) {
      Alert.alert('Validation Error', 'At least 2 options are required.');
      return;
    }
    if (!editCorrect.trim() || !cleanOpts.includes(editCorrect.trim())) {
      Alert.alert('Validation Error', 'Correct answer must exactly match one of the active options.');
      return;
    }

    setSavingEdit(true);
    try {
      await updateDoc(doc(db, 'quizzes', editingQuestion.id), {
        question: editQText.trim(),
        options: cleanOpts,
        correct_answer: editCorrect.trim(),
        category: editCategory.trim() || 'General',
        explanation: editExplanation.trim(),
        updated_at: serverTimestamp(),
      });
      await clearQuizCounts().catch(() => {});
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === editingQuestion.id
            ? {
                ...q,
                question: editQText.trim(),
                options: cleanOpts,
                correct_answer: editCorrect.trim(),
                category: editCategory.trim() || 'General',
                explanation: editExplanation.trim(),
              }
            : q
        )
      );
      setEditingQuestion(null);
      Alert.alert('Updated! ✨', 'Question updated successfully in Firestore.');
    } catch (err: any) {
      Alert.alert('Update Error', err?.message || 'Failed to update question.');
    } finally {
      setSavingEdit(false);
    }
  };

  const renderQuestion = ({ item, index }: { item: QuizDoc; index: number }) => (
    <View style={styles.questionCard} testID={`admin-quiz-item-${item.id}`}>
      <View style={styles.qHeaderRow}>
        <View style={styles.badgeRow}>
          <Text style={styles.numBadge}>#{index + 1}</Text>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{item.category}</Text>
          </View>
        </View>
        <View style={styles.actionBtnsRow}>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => openEditModal(item)}
            accessibilityLabel="Edit question"
          >
            <Ionicons name="pencil" size={15} color="#005F46" />
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.delBtn}
            onPress={() => handleDelete(item)}
            accessibilityLabel="Delete question"
          >
            <Ionicons name="trash" size={15} color="#DC2626" />
            <Text style={styles.delBtnText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.questionText}>{item.question}</Text>

      {/* Options List */}
      <View style={styles.optionsContainer}>
        {item.options.map((opt, oIdx) => {
          const isCorrect = opt === item.correct_answer;
          return (
            <View key={oIdx} style={[styles.optRow, isCorrect && styles.optRowCorrect]}>
              <Ionicons
                name={isCorrect ? 'checkmark-circle' : 'ellipse-outline'}
                size={14}
                color={isCorrect ? '#059669' : '#94A3B8'}
              />
              <Text style={[styles.optText, isCorrect && styles.optTextCorrect]}>
                {opt} {isCorrect ? '(Correct Answer)' : ''}
              </Text>
            </View>
          );
        })}
      </View>

      {item.explanation ? (
        <View style={styles.explBox}>
          <Ionicons name="bulb-outline" size={13} color="#92400E" />
          <Text style={styles.explText}>{item.explanation}</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Top Navigation Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => goBackOrReplace(router, '/(tabs)/quiz')}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.textMain} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.topBarTitle}>Manage Quiz Question Bank</Text>
          <Text style={styles.topBarSubtitle}>
            {filteredQuestions.length} Questions Loaded from Firestore
          </Text>
        </View>
        <TouchableOpacity
          style={styles.aiMakerBtn}
          onPress={() => router.push('/admin/ai-quiz-maker' as any)}
          accessibilityLabel="AI Quiz Maker"
        >
          <Ionicons name="sparkles" size={16} color="#002E23" />
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchWrapper}>
        <Ionicons name="search" size={18} color="#64748B" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search questions by text or options..."
          placeholderTextColor="#94A3B8"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {/* Category Filter Chips */}
      <View style={styles.chipsSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
          <TouchableOpacity
            style={[styles.chip, selectedCategory === 'all' && styles.chipActive]}
            onPress={() => setSelectedCategory('all')}
          >
            <Text style={[styles.chipText, selectedCategory === 'all' && styles.chipTextActive]}>
              All Categories
            </Text>
          </TouchableOpacity>
          {QUIZ_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.chip, selectedCategory === cat && styles.chipActive]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={[styles.chipText, selectedCategory === cat && styles.chipTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Bulk Delete Bar (When specific category is chosen) */}
      {selectedCategory !== 'all' && questions.length > 0 && (
        <View style={styles.bulkActionBar}>
          <Text style={styles.bulkActionText}>
            Category: <Text style={{ fontWeight: '800' }}>{selectedCategory}</Text> ({questions.length} Qs)
          </Text>
          <TouchableOpacity style={styles.bulkDeleteBtn} onPress={handleBulkDeleteCategory}>
            <Ionicons name="trash-bin-outline" size={14} color="#DC2626" />
            <Text style={styles.bulkDeleteBtnText}>Delete All in {selectedCategory}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Question List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#002E23" />
          <Text style={styles.loadingText}>Fetching Questions from Firestore...</Text>
        </View>
      ) : filteredQuestions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={56} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>No Questions Found</Text>
          <Text style={styles.emptySubtitle}>
            {selectedCategory === 'all'
              ? 'No quiz questions exist in Firestore. Use AI Auto-Quiz Maker to generate them in seconds!'
              : `No questions found under "${selectedCategory}".`}
          </Text>
          <TouchableOpacity
            style={styles.createNowBtn}
            onPress={() => router.push('/admin/ai-quiz-maker' as any)}
          >
            <Ionicons name="sparkles" size={16} color="#002E23" />
            <Text style={styles.createNowBtnText}>Generate with AI Now</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredQuestions}
          keyExtractor={(item) => item.id}
          renderItem={renderQuestion}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Edit Question Modal */}
      <Modal visible={Boolean(editingQuestion)} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Question</Text>
              <TouchableOpacity onPress={() => setEditingQuestion(null)}>
                <Ionicons name="close" size={22} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 20 }}>
              <Text style={styles.modalLabel}>Question Text:</Text>
              <TextInput
                style={styles.modalInputArea}
                value={editQText}
                onChangeText={setEditQText}
                multiline
              />

              <Text style={styles.modalLabel}>Category / Masala:</Text>
              <TextInput
                style={styles.modalInput}
                value={editCategory}
                onChangeText={setEditCategory}
                placeholder="Category"
              />

              <Text style={styles.modalLabel}>Answer Options (Tap radio to mark as Correct):</Text>
              {editOptions.map((opt, idx) => {
                const isSelected = editCorrect === opt && opt.length > 0;
                return (
                  <View key={idx} style={[styles.modalOptRow, isSelected && styles.modalOptRowSelected]}>
                    <TouchableOpacity
                      style={[styles.modalRadio, isSelected && styles.modalRadioSelected]}
                      onPress={() => setEditCorrect(opt)}
                    >
                      {isSelected && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                    </TouchableOpacity>
                    <TextInput
                      style={styles.modalOptInput}
                      value={opt}
                      onChangeText={(txt) => {
                        const next = [...editOptions];
                        const old = next[idx];
                        next[idx] = txt;
                        setEditOptions(next);
                        if (editCorrect === old) setEditCorrect(txt);
                      }}
                      placeholder={`Option ${idx + 1}`}
                    />
                  </View>
                );
              })}

              <Text style={styles.modalLabel}>Explanation / Tafseeli Daleel:</Text>
              <TextInput
                style={styles.modalInputArea}
                value={editExplanation}
                onChangeText={setEditExplanation}
                multiline
                placeholder="Explanation reference from Quran/Hadith/Fiqh..."
              />

              <TouchableOpacity
                style={[styles.saveModalBtn, savingEdit && { opacity: 0.7 }]}
                onPress={saveEditModal}
                disabled={savingEdit}
              >
                {savingEdit ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveModalBtnText}>Save Changes to Firestore</Text>
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
    backgroundColor: '#F8FAFC',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.full,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  topBarSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  aiMakerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    paddingHorizontal: 12,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '500',
  },
  chipsSection: {
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
  },
  chipsScroll: {
    paddingHorizontal: SPACING.md,
    gap: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipActive: {
    backgroundColor: '#002E23',
    borderColor: '#002E23',
  },
  chipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  bulkActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    backgroundColor: '#FEF2F2',
    borderBottomWidth: 1,
    borderBottomColor: '#FEE2E2',
  },
  bulkActionText: {
    fontSize: 12,
    color: '#991B1B',
  },
  bulkDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  bulkDeleteBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  listContent: {
    padding: SPACING.md,
    gap: 12,
    paddingBottom: 40,
  },
  questionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
    ...SHADOWS.card,
  },
  qHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  numBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#002E23',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  categoryBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  actionBtnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.md,
  },
  editBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#005F46',
  },
  delBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.md,
  },
  delBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  questionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 20,
  },
  optionsContainer: {
    gap: 4,
    marginTop: 2,
  },
  optRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: RADIUS.sm,
  },
  optRowCorrect: {
    backgroundColor: '#F0FDF4',
  },
  optText: {
    fontSize: 12,
    color: '#475569',
  },
  optTextCorrect: {
    fontWeight: '700',
    color: '#059669',
  },
  explBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    backgroundColor: '#FEF3C7',
    padding: 6,
    borderRadius: RADIUS.sm,
    marginTop: 4,
  },
  explText: {
    flex: 1,
    fontSize: 11,
    color: '#92400E',
    lineHeight: 15,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  createNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#C8A84E',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
  },
  createNowBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#002E23',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    gap: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginTop: 6,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: RADIUS.md,
    padding: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  modalInputArea: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: RADIUS.md,
    padding: 8,
    fontSize: 13,
    color: '#0F172A',
    minHeight: 56,
  },
  modalOptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: RADIUS.md,
    paddingHorizontal: 8,
  },
  modalOptRowSelected: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  modalRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalRadioSelected: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  modalOptInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    paddingVertical: 6,
  },
  saveModalBtn: {
    backgroundColor: '#005F46',
    paddingVertical: 12,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    marginTop: 10,
  },
  saveModalBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
