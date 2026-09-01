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
        'کامیابی / Published!',
        'ماشاءاللہ! ' + result.count + ' سوالات کامیابی سے مدرسہ کے کوئز سیکشن میں لائیو ہو چکے ہیں۔',
        [
          {
            text: 'ٹھیک ہے',
            onPress: () => goBackOrReplace(router, '/(tabs)/quiz'),
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Publish Error', err?.message || 'Failed to publish quiz.');
    } finally {
      setPublishing(false);
    }
  };

  const handleCopyExamPaper = async () => {
    if (questions.length === 0) return;
    const text = formatQuizAsPrintableExam(questions, category);
    await Clipboard.setStringAsync(text);
    Alert.alert('پرچہ کاپی ہوگیا', 'امتحانی پرچہ و جوابی کلید کامیابی سے کاپی ہو چکی ہے۔ آپ اسے واٹس ایپ یا پرنٹ کے لیے استعمال کر سکتی ہیں۔');
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
          <Text style={styles.arabicHeader}>مُؤَلِّفُ الامْتِحَانَاتِ بِالذَّكَاءِ الاصْطِنَاعِي</Text>
          <Text style={styles.headerSubtitle}>AI Auto-Quiz & Exam Maker</Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Step 1: Configuration Card */}
        <View style={styles.configCard}>
          <Text style={styles.sectionHeading}>۱. کوئز کا موضوع و ترجیحات منتخب کریں:</Text>

          {/* Category Dropdown/Chips */}
          <Text style={styles.fieldLabel}>مضمون / کیٹیگری (Islamic Subject):</Text>
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
          <Text style={styles.fieldLabel}>سوالات کی تعداد (Questions Count):</Text>
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
                    {num} سوالات
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Difficulty */}
          <Text style={styles.fieldLabel}>معیار و درجہ (Difficulty):</Text>
          <View style={styles.countRow}>
            {[
              { id: 'easy', label: 'ابتدائی (Basic)' },
              { id: 'medium', label: 'متوسط (Medium)' },
              { id: 'hard', label: 'اعلیٰ (Advanced)' },
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
                <Text style={styles.generateBtnText}>AI سے پرچہ تیار کریں (Generate with AI)</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Step 2: Generated Questions Review */}
        {questions.length > 0 && (
          <View style={styles.reviewSection}>
            <View style={styles.reviewHeader}>
              <Text style={styles.reviewTitle}>۲. تیار شدہ سوالات کا جائزہ و ایڈیٹنگ ({questions.length}):</Text>
              <TouchableOpacity style={styles.copyPaperBtn} onPress={handleCopyExamPaper} activeOpacity={0.8}>
                <Ionicons name="copy-outline" size={14} color="#005F46" />
                <Text style={styles.copyPaperBtnText}>پرچہ کاپی کریں</Text>
              </TouchableOpacity>
            </View>

            {questions.map((q, qIdx) => (
              <View key={q.id} style={styles.questionCard}>
                <View style={styles.questionCardHeader}>
                  <Text style={styles.questionIndexBadge}>سوال {qIdx + 1}</Text>
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
                />

                {/* Options List */}
                <Text style={styles.optionsLabel}>جوابات کے اختیارات (صحیح جواب پر کلک کریں):</Text>
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
                  <Ionicons name="checkmark-done-circle" size={22} color="#FFFFFF" />
                  <Text style={styles.publishBtnText}>مدرسہ میں لائیو پبلش کریں (Publish to Quiz)</Text>
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
  },
  countChipSelected: {
    backgroundColor: '#E8F5EE',
    borderColor: '#005F46',
  },
  countChipText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
  },
  countChipTextSelected: {
    color: '#005F46',
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C8A84E',
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    gap: 8,
    marginTop: 10,
  },
  generateBtnText: {
    color: '#002E23',
    fontSize: 14,
    fontWeight: '800',
  },
  reviewSection: {
    gap: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  copyPaperBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.md,
    gap: 4,
  },
  copyPaperBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#005F46',
  },
  questionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
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
    fontSize: 11,
    fontWeight: '800',
    color: '#005F46',
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  deleteBtn: {
    padding: 4,
  },
  questionInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: RADIUS.md,
    padding: 10,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  optionsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 2,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 8,
  },
  optionRowCorrect: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  radioDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDotCorrect: {
    backgroundColor: '#007A58',
    borderColor: '#007A58',
  },
  optionInput: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '600',
    paddingVertical: 6,
  },
  optionInputCorrect: {
    fontWeight: '700',
    color: '#007A58',
  },
  explanationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    padding: 8,
    borderRadius: RADIUS.sm,
    gap: 6,
  },
  explanationText: {
    flex: 1,
    fontSize: 10,
    color: '#92400E',
    lineHeight: 15,
  },
  publishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
    borderRadius: RADIUS.xl,
    paddingVertical: 14,
    gap: 8,
    marginTop: 6,
    ...SHADOWS.card,
  },
  publishBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
