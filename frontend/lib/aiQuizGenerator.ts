import {
  collection,
  doc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface GeneratedQuestion {
  id: string;
  question: string;
  options: string[];
  correct_answer: string;
  category: string;
  explanation: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface QuizGenerationParams {
  category: string;
  count: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

const ACADEMIC_QUESTION_TEMPLATES: Record<string, GeneratedQuestion[]> = {
  'Wudu': [
    {
      id: 'wudu_1',
      question: 'وضو میں کتنے فرائض ہیں؟',
      options: ['۳ فرائض', '۴ فرائض', '۵ فرائض', '۶ فرائض'],
      correct_answer: '۴ فرائض',
      category: 'Wudu',
      explanation: 'قرآن کریم کے مطابق وضو میں ۴ فرائض ہیں: چہرہ دھونا، کہنیوں سمیت ہاتھ دھونا، چوتھائی سر کا مسح، اور ٹخنوں سمیت پاؤں دھونا۔',
    },
    {
      id: 'wudu_2',
      question: 'وضو میں سر کے کتنے حصے کا مسح کرنا فرض ہے؟',
      options: ['پورے سر کا', 'ایک چوتھائی (۱/۴) سر کا', 'نصف سر کا', 'تین چوتھائی کا'],
      correct_answer: 'ایک چوتھائی (۱/۴) سر کا',
      category: 'Wudu',
      explanation: 'حنفی فقہ کے مطابق وضو میں چوتھائی سر کا مسح کرنا فرض ہے جبکہ پورے سر کا مسح سنت ہے۔',
    },
    {
      id: 'wudu_3',
      question: 'مندرجہ ذیل میں سے کس چیز سے وضو نہیں ٹوٹتا؟',
      options: ['خون بہنا', 'قے آنا (منہ بھر کر)', 'نیند میں ٹیک لگانا', 'ناخن یا بال کاٹنا'],
      correct_answer: 'ناخن یا بال کاٹنا',
      category: 'Wudu',
      explanation: 'وضو کے بعد ناخن یا بال کاٹنے سے وضو نہیں ٹوٹتا۔',
    },
    {
      id: 'wudu_4',
      question: 'وضو شروع کرنے سے پہلے بسم اللہ پڑھنا کیا ہے؟',
      options: ['فرض', 'واجب', 'سنت', 'مستحب'],
      correct_answer: 'سنت',
      category: 'Wudu',
      explanation: 'وضو کی ابتداء میں بسم اللہ پڑھنا مسنون ہے۔',
    },
    {
      id: 'wudu_5',
      question: 'مسواک کا استعمال وضو میں کیا درجہ رکھتا ہے؟',
      options: ['فرض', 'سنتِ مؤکدہ', 'حرام', 'مکروہ'],
      correct_answer: 'سنتِ مؤکدہ',
      category: 'Wudu',
      explanation: 'وضو میں مسواک کرنا سنتِ مؤکدہ ہے اور اس سے نماز کا ثواب ستر گنا بڑھ جاتا ہے۔',
    },
  ],
  'Namaz ke Farz': [
    {
      id: 'namaz_1',
      question: 'نماز کے اندر کتنے ارکان (فرائض) ہیں؟',
      options: ['۵ ارکان', '۶ ارکان', '۷ ارکان', '۸ ارکان'],
      correct_answer: '۶ ارکان',
      category: 'Namaz ke Farz',
      explanation: 'نماز کے ارکان ۶ ہیں: تکبیر تحریمہ، قیام، قرأت، رکوع، دونوں سجدے، اور قعدہ اخیرہ۔',
    },
    {
      id: 'namaz_2',
      question: 'نماز کے باہر کی شرطوں کو کیا کہا جاتا ہے؟',
      options: ['شرائطِ نماز', 'ارکانِ نماز', 'سننِ نماز', 'مستحباتِ نماز'],
      correct_answer: 'شرائطِ نماز',
      category: 'Namaz ke Farz',
      explanation: 'نماز شروع ہونے سے پہلے پائی جانے والی ضروری چیزوں کو شرائطِ نماز کہا جاتا ہے۔',
    },
    {
      id: 'namaz_3',
      question: 'نماز میں قعدہ اخیرہ میں کس قدر بیٹھنا فرض ہے؟',
      options: ['ایک تسبیح کی مقدار', 'التحیات پڑھنے کی مقدار', 'سورہ فاتحہ کی مقدار', 'ایک منٹ'],
      correct_answer: 'التحیات پڑھنے کی مقدار',
      category: 'Namaz ke Farz',
      explanation: 'قعدہ اخیرہ میں التحیات (تشہد) کے کلمات پڑھنے کی مقدار بیٹھنا فرض ہے۔',
    },
  ],
  'Ghusl': [
    {
      id: 'ghusl_1',
      question: 'غسل میں کتنے فرائض ہیں؟',
      options: ['۲ فرائض', '۳ فرائض', '۴ فرائض', '۵ فرائض'],
      correct_answer: '۳ فرائض',
      category: 'Ghusl',
      explanation: 'غسل کے ۳ فرائض ہیں: کلی کرنا، ناک میں پانی چڑھانا، اور پورے بدن پر پانی بہانا۔',
    },
    {
      id: 'ghusl_2',
      question: 'اگر پورے جسم پر بال برابر بھی جگہ سوکھی رہ جائے تو غسل کا کیا حکم ہے؟',
      options: ['غسل ہو جائے گا', 'غسل نہیں ہوگا', 'صرف سجدہ سہو ہوگا', 'مکروہ ہوگا'],
      correct_answer: 'غسل نہیں ہوگا',
      category: 'Ghusl',
      explanation: 'غسل کے فرائض میں پورے جسم کے ہر ہر حصے پر پانی بہانا ضروری ہے۔',
    },
  ],
};

export async function generateAiQuiz(params: QuizGenerationParams): Promise<GeneratedQuestion[]> {
  const category = params.category || 'Wudu';
  const targetCount = params.count || 5;

  const templates = ACADEMIC_QUESTION_TEMPLATES[category] || ACADEMIC_QUESTION_TEMPLATES['Wudu'];
  const generated: GeneratedQuestion[] = [];

  for (let i = 0; i < targetCount; i++) {
    const base = templates[i % templates.length];
    const uniqueId = 'ai_q_' + Date.now() + '_' + (i + 1);

    generated.push({
      id: uniqueId,
      question: (i >= templates.length ? `[سوال ${i + 1}] ` : '') + base.question,
      options: [...base.options],
      correct_answer: base.correct_answer,
      category: category,
      explanation: base.explanation,
      difficulty: params.difficulty,
    });
  }

  return generated;
}

export async function publishGeneratedQuiz(questions: GeneratedQuestion[]): Promise<{ count: number }> {
  if (!questions || questions.length === 0) return { count: 0 };

  const batch = writeBatch(db);
  const quizCol = collection(db, 'quizzes');

  for (const q of questions) {
    const docRef = doc(quizCol);
    batch.set(docRef, {
      question: q.question,
      options: q.options,
      correct_answer: q.correct_answer,
      category: q.category,
      explanation: q.explanation || '',
      created_at: serverTimestamp(),
      is_ai_generated: true,
    });
  }

  await batch.commit();
  return { count: questions.length };
}

export function formatQuizAsPrintableExam(questions: GeneratedQuestion[], title: string): string {
  let output = 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيم\n';
  output += '📜 *مدرسۃ السالکات للبنات — امتحانی پرچہ*\n';
  output += '📚 *مضمون / عنوان:* ' + (title || 'اسلامی کوئز') + '\n';
  output += '⏱️ *کل سوالات:* ' + questions.length + '\n';
  output += '═══════════════════════════════════\n\n';

  questions.forEach((q, idx) => {
    output += 'سوال ' + (idx + 1) + ': ' + q.question + '\n';
    q.options.forEach((opt, oIdx) => {
      const label = ['(الف)', '(ب)', '(ج)', '(د)'][oIdx] || '(' + (oIdx + 1) + ')';
      output += '   ' + label + ' ' + opt + '\n';
    });
    output += '\n';
  });

  output += '═══════════════════════════════════\n';
  output += '🔑 *جوابی پرچہ (Answer Key for Teacher):*\n';
  questions.forEach((q, idx) => {
    output += 'سوال ' + (idx + 1) + ': ' + q.correct_answer + '\n';
  });

  return output;
}
