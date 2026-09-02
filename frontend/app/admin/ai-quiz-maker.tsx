import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { COLORS, RADIUS, SPACING, SHADOWS } from '@/constants/theme';
import { QUIZ_CATEGORIES } from '@/constants/quizCategories';
import {
  GeneratedQuestion,
  generateAiQuiz,
  publishGeneratedQuiz,
  formatQuizAsPrintableExam,
} from '@/lib/aiQuizGenerator';
import { goBackOrReplace } from '@/lib/navigation';

export default function AiQuizMakerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [category, setCategory] = useState('Wudu');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [language, setLanguage] = useState<'both' | 'english' | 'urdu'>('both');
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const results = await generateAiQuiz({
        category,
        count: questionCount,
        difficulty,
        language,
      });
      setQuestions(results);
    } catch {
      Alert.alert('Error', 'Could not generate quiz. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateQuestionText = (index: number, newText: string) => {
    setQuestions((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], question: newText };
      return updated;
    });
  };

  const handleUpdateOption = (qIdx: number, oIdx: number, newOptionText: string) => {
    setQuestions((prev) => {
      const updated = [...prev];
      const oldOpt = updated[qIdx].options[oIdx];
      const nextOpts = [...updated[qIdx].options];
      nextOpts[oIdx] = newOptionText;

      let nextCorrect = updated[qIdx].correct_answer;
      if (nextCorrect === oldOpt) {
        nextCorrect = newOptionText;
      }

      updated[qIdx] = {
        ...updated[qIdx],
        options: nextOpts,
        correct_answer: nextCorrect,
      };
      return updated;
    });
  };

  const handleSelectCorrectAnswer = (qIdx: number, selectedOpt: string) => {
    setQuestions((prev) => {
      const updated = [...prev];
      updated[qIdx] = { ...updated[qIdx], correct_answer: selectedOpt };
      return updated;
    });
  };

  const handleDeleteQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handlePublish = async () => {
    if (questions.length === 0) return;

    setPublishing(true);
    try {
      const result = await publishGeneratedQuiz(questions);
      Alert.alert(
        'Published to Firestore! ✨',
        `MashaAllah! ${result.count} questions have been saved to Firestore under "${category}" and are now live for all students in the Quiz section.`,
        [
          {
            text: 'Go to Quiz Tab',
            onPress: () => goBackOrReplace(router, '/(tabs)/quiz'),
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Publish Error', err?.message || 'Failed to publish quiz to Firestore.');
    } finally {
      setPublishing(false);
    }
  };

  const handleCopyExamPaper = async () => {
    if (questions.length === 0) return;
    const text = formatQuizAsPrintableExam(questions, category);
    await Clipboard.setStringAsync(text);
    Alert.alert('Paper Copied!', 'Exam paper with Answer Key has been copied to your clipboard. You can paste it in WhatsApp or print it.');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => goBackOrReplace(router, '/(tabs)/quiz')}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitleMain}>AI Auto-Quiz & Exam Maker</Text>
          <Text style={styles.headerSubtitle}>مُؤَلِّفُ الامْتِحَانَاتِ بِالذَّكَاءِ الاصْطِنَاعِي</Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Step 1: Configuration Card */}
        <View style={styles.configCard}>
          <View style={styles.stepHeaderRow}>
            <View style={styles.stepNumCircle}>
              <Text style={styles.stepNumText}>1</Text>
            </View>
            <Text style={styles.sectionHeading}>Configure Quiz Topic & Preferences</Text>
          </View>

          {/* Language Selection */}
          <Text style={styles.fieldLabel}>Question Language (زبان):</Text>
          <View style={styles.countRow}>
            {[
              { id: 'both', label: 'Bilingual (Eng + اردو)' },
              { id: 'english', label: 'English Only' },
              { id: 'urdu', label: 'اردو (Urdu Only)' },
            ].map((lang) => {
              const isSelected = language === lang.id;
              return (
                <TouchableOpacity
                  key={lang.id}
                  style={[styles.countChip, isSelected && styles.countChipSelected]}
                  onPress={() => setLanguage(lang.id as any)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.countChipText, isSelected && styles.countChipTextSelected]}>
                    {lang.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Category Dropdown/Chips */}
          <Text style={styles.fieldLabel}>Select Islamic Subject / Masail (کیٹیگری):</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryChipsRow}>
            {QUIZ_CATEGORIES.map((cat) => {
              const isSelected = category === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.chip, isSelected && styles.chipSelected]}
                  onPress={() => setCategory(cat)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{cat}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Question Count */}
          <Text style={styles.fieldLabel}>Number of Questions (سوالات کی تعداد):</Text>
          <View style={styles.countRow}>
            {[5, 10, 15, 20].map((num) => {
              const isSelected = questionCount === num;
              return (
                <TouchableOpacity
                  key={num}
                  style={[styles.countChip, isSelected && styles.countChipSelected]}
                  onPress={() => setQuestionCount(num)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.countChipText, isSelected && styles.countChipTextSelected]}>
                    {num} Questions
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Difficulty */}
          <Text style={styles.fieldLabel}>Difficulty Level (معیار و درجہ):</Text>
          <View style={styles.countRow}>
            {[
              { id: 'easy', label: 'Basic / ابتدائی' },
              { id: 'medium', label: 'Medium / متوسط' },
              { id: 'hard', label: 'Advanced / اعلیٰ' },
            ].map((diff) => {
              const isSelected = difficulty === diff.id;
              return (
                <TouchableOpacity
                  key={diff.id}
                  style={[styles.countChip, isSelected && styles.countChipSelected]}
                  onPress={() => setDifficulty(diff.id as any)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.countChipText, isSelected && styles.countChipTextSelected]}>
                    {diff.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Generate Button */}
          <TouchableOpacity
            style={[styles.generateBtn, loading && { opacity: 0.7 }]}
            onPress={handleGenerate}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#002E23" />
            ) : (
              <>
                <Ionicons name="sparkles" size={18} color="#002E23" />
                <Text style={styles.generateBtnText}>Generate Questions with AI (پرچہ تیار کریں)</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Step 2: Generated Questions Review */}
        {questions.length > 0 && (
          <View style={styles.reviewSection}>
            <View style={styles.reviewHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.reviewTitle}>2. Review & Edit Questions ({questions.length}):</Text>
                <Text style={styles.reviewSubtitle}>Tap the correct option circle to set answer key</Text>
              </View>
              <TouchableOpacity style={styles.copyPaperBtn} onPress={handleCopyExamPaper} activeOpacity={0.8}>
                <Ionicons name="copy-outline" size={14} color="#005F46" />
                <Text style={styles.copyPaperBtnText}>Copy Exam Paper</Text>
              </TouchableOpacity>
            </View>

            {questions.map((q, qIdx) => (
              <View key={q.id} style={styles.questionCard}>
                <View style={styles.questionCardHeader}>
                  <Text style={styles.questionIndexBadge}>Question {qIdx + 1}</Text>
                  <TouchableOpacity onPress={() => handleDeleteQuestion(qIdx)} style={styles.deleteBtn}>
                    <Ionicons name="trash-outline" size={16} color="#DC2626" />
                  </TouchableOpacity>
                </View>

                {/* Question Input */}
                <TextInput
                  style={styles.questionInput}
                  value={q.question}
                  onChangeText={(txt) => handleUpdateQuestionText(qIdx, txt)}
                  multiline
                  placeholder="Enter Question..."
                />

                {/* Options List */}
                <Text style={styles.optionsLabel}>Answer Options (Select the correct option):</Text>
                {q.options.map((opt, oIdx) => {
                  const isCorrect = q.correct_answer === opt;
                  return (
                    <View key={oIdx} style={[styles.optionRow, isCorrect && styles.optionRowCorrect]}>
                      <TouchableOpacity
                        style={[styles.radioDot, isCorrect && styles.radioDotCorrect]}
                        onPress={() => handleSelectCorrectAnswer(qIdx, opt)}
                      >
                        {isCorrect && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                      </TouchableOpacity>
                      <TextInput
                        style={[styles.optionInput, isCorrect && styles.optionInputCorrect]}
                        value={opt}
                        onChangeText={(txt) => handleUpdateOption(qIdx, oIdx, txt)}
                      />
                    </View>
                  );
                })}

                {/* Explanation */}
                {q.explanation ? (
                  <View style={styles.explanationBox}>
                    <Ionicons name="bulb-outline" size={14} color="#92400E" />
                    <Text style={styles.explanationText}>{q.explanation}</Text>
                  </View>
                ) : null}
              </View>
            ))}

            {/* Step 3: Publish CTA */}
            <TouchableOpacity
              style={[styles.publishBtn, publishing && { opacity: 0.7 }]}
              onPress={handlePublish}
              disabled={publishing}
              activeOpacity={0.88}
            >
              {publishing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={20} color="#FFFFFF" />
                  <Text style={styles.publishBtnText}>Save to Firestore & Publish Live</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
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
  headerTitleMain: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#C8A84E',
    fontWeight: '600',
    marginTop: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    gap: 14,
    paddingBottom: 40,
  },
  configCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    gap: 10,
    ...SHADOWS.card,
  },
  stepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  stepNumCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#002E23',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginTop: 4,
  },
  categoryChipsRow: {
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipSelected: {
    backgroundColor: '#005F46',
    borderColor: '#005F46',
  },
  chipText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  countRow: {
    flexDirection: 'row',
    gap: 8,
  },
  countChip: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: RADIUS.md,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countChipSelected: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669',
  },
  countChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  countChipTextSelected: {
    color: '#047857',
    fontWeight: '800',
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#C8A84E',
    paddingVertical: 12,
    borderRadius: RADIUS.lg,
    marginTop: 8,
    ...SHADOWS.card,
  },
  generateBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#002E23',
  },
  reviewSection: {
    gap: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  reviewTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  reviewSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  copyPaperBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  copyPaperBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#005F46',
  },
  questionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: 8,
    ...SHADOWS.card,
  },
  questionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  questionIndexBadge: {
    fontSize: 12,
    fontWeight: '800',
    color: '#005F46',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  deleteBtn: {
    padding: 4,
  },
  questionInput: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: RADIUS.md,
    padding: 8,
    minHeight: 48,
    backgroundColor: '#F8FAFC',
  },
  optionsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginTop: 4,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  optionRowCorrect: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  radioDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDotCorrect: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  optionInput: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
    paddingVertical: 4,
  },
  optionInputCorrect: {
    fontWeight: '700',
    color: '#047857',
  },
  explanationBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#FEF3C7',
    padding: 8,
    borderRadius: RADIUS.md,
    marginTop: 4,
  },
  explanationText: {
    flex: 1,
    fontSize: 11,
    color: '#92400E',
    lineHeight: 15,
  },
  publishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    marginTop: 8,
    ...SHADOWS.card,
  },
  publishBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
