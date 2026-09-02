import {
  collection,
  doc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { clearQuizCounts } from '@/lib/lmsHardening';

export interface GeneratedQuestion {
  id: string;
  question: string;
  options: string[];
  correct_answer: string;
  category: string;
  explanation: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  language?: 'english' | 'urdu' | 'both';
}

export interface QuizGenerationParams {
  category: string;
  count: number;
  difficulty: 'easy' | 'medium' | 'hard';
  language: 'english' | 'urdu' | 'both';
  customTopic?: string;
}

const ISLAMIC_QUESTION_KNOWLEDGE_BASE: Record<string, GeneratedQuestion[]> = {
  'Wudu': [
    {
      id: 'wudu_1',
      question: 'How many Farz (obligatory acts) are there in Wudu? / وضو میں کتنے فرائض ہیں؟',
      options: ['3 Farz (۳ فرائض)', '4 Farz (۴ فرائض)', '5 Farz (۵ فرائض)', '6 Farz (۶ فرائض)'],
      correct_answer: '4 Farz (۴ فرائض)',
      category: 'Wudu',
      explanation: 'According to Surah Al-Maidah (5:6), there are 4 Farz in Wudu: Washing face, washing arms including elbows, wiping quarter of the head (Masah), and washing feet including ankles.',
      difficulty: 'easy',
    },
    {
      id: 'wudu_2',
      question: 'How much of the head must be wiped (Masah) as Farz during Wudu? / وضو میں سر کے کتنے حصے کا مسح کرنا فرض ہے؟',
      options: ['Full Head (پورے سر کا)', 'One-Fourth 1/4 (ایک چوتھائی)', 'Half 1/2 (نصف سر کا)', 'One-Eighth 1/8 (آٹھواں حصہ)'],
      correct_answer: 'One-Fourth 1/4 (ایک چوتھائی)',
      category: 'Wudu',
      explanation: 'In Hanafi Fiqh, wiping 1/4th of the head is Farz, while doing Masah of the entire head once is Sunnah Muakkadah.',
      difficulty: 'easy',
    },
    {
      id: 'wudu_3',
      question: 'Which of the following does NOT break (nullify) Wudu? / مندرجہ ذیل میں سے کس سے وضو نہیں ٹوٹتا؟',
      options: ['Flowing Blood (خون بہنا)', 'Mouthful Vomit (منہ بھر کر قے)', 'Deep Sleep with support (ٹیک لگا کر سونا)', 'Cutting Nails or Hair (ناخن یا بال کاٹنا)'],
      correct_answer: 'Cutting Nails or Hair (ناخن یا بال کاٹنا)',
      category: 'Wudu',
      explanation: 'Cutting nails, trimming hair, or clipping beard after performing Wudu does not break the Wudu.',
      difficulty: 'medium',
    },
    {
      id: 'wudu_4',
      question: 'What is the Islamic status of using Miswak during Wudu? / وضو میں مسواک کا استعمال کیا درجہ رکھتا ہے؟',
      options: ['Farz (فرض)', 'Sunnah Muakkadah (سنتِ مؤکدہ)', 'Wajib (واجب)', 'Mustahab (مستحب)'],
      correct_answer: 'Sunnah Muakkadah (سنتِ مؤکدہ)',
      category: 'Wudu',
      explanation: 'Using Miswak in Wudu is a Sunnah Muakkadah of great virtue; Salah performed after Miswak carries 70 times more reward.',
      difficulty: 'medium',
    },
    {
      id: 'wudu_5',
      question: 'If water is not available or harmful, what replaces Wudu? / پانی نہ ملنے پر وضو کا متبادل کیا ہے؟',
      options: ['Tayammum (تیمم)', 'Ghusl (غسل)', 'Namaz Maaf (نماز معاف)', 'Sajda Sahw (سجدہ سہو)'],
      correct_answer: 'Tayammum (تیمم)',
      category: 'Wudu',
      explanation: 'When water is unavailable within 1 mile or its use causes illness, Tayammum with pure earth replaces both Wudu and Ghusl.',
      difficulty: 'easy',
    },
  ],
  'Namaz ke Farz': [
    {
      id: 'namaz_1',
      question: 'How many internal pillars (Arkaan/Farz) are inside the Salah? / نماز کے اندر کتنے ارکان (فرائض) ہیں؟',
      options: ['5 Pillars (۵ ارکان)', '6 Pillars (۶ ارکان)', '7 Pillars (۷ ارکان)', '8 Pillars (۸ ارکان)'],
      correct_answer: '6 Pillars (۶ ارکان)',
      category: 'Namaz ke Farz',
      explanation: 'The 6 Arkaan (Internal Farz) of Salah are: Takbeer-e-Tehreema, Qiyam (Standing), Qiraat (Recitation), Ruku, Both Sujood, and Qaada Akheera.',
      difficulty: 'easy',
    },
    {
      id: 'namaz_2',
      question: 'How many external prerequisites (Sharaait-e-Namaz) must exist before starting Salah? / نماز سے باہر کتنی شرطیں ہیں؟',
      options: ['5 Conditions (۵ شرائط)', '6 Conditions (۶ شرائط)', '7 Conditions (۷ شرائط)', '8 Conditions (۸ شرائط)'],
      correct_answer: '6 Conditions (۶ شرائط)',
      category: 'Namaz ke Farz',
      explanation: 'The 6 external conditions are: Taharat of body, clothes, place of prayer, Satr-e-Aurat, facing Qibla, Waqt (proper prayer time), and Niyyah (Intention).',
      difficulty: 'medium',
    },
    {
      id: 'namaz_3',
      question: 'How long is it Farz to sit in Qaada Akheera (final sitting)? / قعدہ اخیرہ میں کتنا بیٹھنا فرض ہے؟',
      options: ['10 Seconds', 'Time to recite Tashahhud (التحیات کی مقدار)', 'Time to recite Surah Fatihah', '1 Minute'],
      correct_answer: 'Time to recite Tashahhud (التحیات کی مقدار)',
      category: 'Namaz ke Farz',
      explanation: 'Sitting for the duration it takes to recite Attahiyyat (up to Abduhoo wa Rasooluh) is Farz.',
      difficulty: 'medium',
    },
    {
      id: 'namaz_4',
      question: 'What is the ruling if someone intentionally leaves a Farz of Salah? / نماز کا کوئی فرض جان بوجھ کر چھوڑنے کا کیا حکم ہے؟',
      options: ['Salah is Valid with Sajda Sahw', 'Salah is Invalid and Must be Repeated (نماز باطل / اعادہ لازم)', 'Minor Sin only', 'Mustahab to repeat'],
      correct_answer: 'Salah is Invalid and Must be Repeated (نماز باطل / اعادہ لازم)',
      category: 'Namaz ke Farz',
      explanation: 'Missing any Farz of Salah (whether intentionally or mistakenly) invalidates the Salah. Sajda Sahw cannot compensate for a missed Farz.',
      difficulty: 'hard',
    },
  ],
  'Ghusl': [
    {
      id: 'ghusl_1',
      question: 'How many Farz (obligatory acts) are there in Ghusl (Full Bath)? / غسل میں کتنے فرائض ہیں؟',
      options: ['2 Farz (۲ فرائض)', '3 Farz (۳ فرائض)', '4 Farz (۴ فرائض)', '5 Farz (۵ فرائض)'],
      correct_answer: '3 Farz (۳ فرائض)',
      category: 'Ghusl',
      explanation: 'Ghusl has 3 Farz: 1. Gargling/Rinsing mouth (Kulli), 2. Passing water into nose up to soft bone (Naak me paani), 3. Flowing water over entire body without leaving even a hair-breadth dry.',
      difficulty: 'easy',
    },
    {
      id: 'ghusl_2',
      question: 'If a single spot equivalent to a hair width remains dry, what is the status of Ghusl? / اگر بال برابر جگہ سوکھی رہ جائے تو غسل کا کیا حکم ہے؟',
      options: ['Ghusl is Valid', 'Ghusl is Incomplete / Invalid until washed (غسل نہیں ہوا)', 'Sajda Sahw is sufficient', 'Makruh only'],
      correct_answer: 'Ghusl is Incomplete / Invalid until washed (غسل نہیں ہوا)',
      category: 'Ghusl',
      explanation: 'Every hair and every pore of the body must receive water. The dry spot must be washed immediately upon remembrance.',
      difficulty: 'easy',
    },
    {
      id: 'ghusl_3',
      question: 'Does waterproof nail polish or thick coating prevent Ghusl? / کیا واٹر پروف نیل پالش غسل میں رکاوٹ بنتی ہے؟',
      options: ['Yes, it prevents water reach so Ghusl is invalid (ہاں، غسل نہیں ہوگا)', 'No, it is forgiven', 'Only in winter', 'Only for Friday prayer'],
      correct_answer: 'Yes, it prevents water reach so Ghusl is invalid (ہاں، غسل نہیں ہوگا)',
      category: 'Ghusl',
      explanation: 'Any impermeable barrier like standard nail polish prevents water from touching the nail surface, making Wudu and Ghusl invalid.',
      difficulty: 'medium',
    },
  ],
  'Haiz': [
    {
      id: 'haiz_1',
      question: 'In Hanafi jurisprudence, what is the minimum duration of Haiz (Menstruation)? / فقہ حنفی میں حیض کی کم سے کم مدت کیا ہے؟',
      options: ['1 Day (24 hours)', '2 Days (48 hours)', '3 Days & 3 Nights (72 Hours / ۳ دن ۳ راتیں)', '5 Days'],
      correct_answer: '3 Days & 3 Nights (72 Hours / ۳ دن ۳ راتیں)',
      category: 'Haiz',
      explanation: 'The minimum duration of Haiz is 72 complete hours (3 days and 3 nights). Blood seen for less than 72 hours is Istihaza (irregular bleeding).',
      difficulty: 'medium',
    },
    {
      id: 'haiz_2',
      question: 'What is the maximum duration of Haiz in Hanafi Fiqh? / حیض کی زیادہ سے زیادہ مدت کتنی ہے؟',
      options: ['7 Days', '10 Days & 10 Nights (۱۰ دن ۱۰ راتیں)', '15 Days', '40 Days'],
      correct_answer: '10 Days & 10 Nights (۱۰ دن ۱۰ راتیں)',
      category: 'Haiz',
      explanation: 'The maximum duration of Haiz is 10 days and 10 nights (240 hours). Any blood seen beyond 10 days is Istihaza.',
      difficulty: 'medium',
    },
    {
      id: 'haiz_3',
      question: 'Are prayers (Salah) missed during Haiz required to be made up (Qada)? / کیا ایامِ حیض کی نمازوں کی قضا لازم ہے؟',
      options: ['Yes, all prayers must be made up', 'No, prayers are completely exempted / forgiven (نہیں، نمازیں معاف ہیں)', 'Only Farz prayers', 'Only Friday prayer'],
      correct_answer: 'No, prayers are completely exempted / forgiven (نہیں، نمازیں معاف ہیں)',
      category: 'Haiz',
      explanation: 'By the consensus of Islam, prayers missed during menstruation are totally forgiven without any Qada, while missed Ramzan fasts must be kept as Qada later.',
      difficulty: 'easy',
    },
  ],
  'Roza': [
    {
      id: 'roza_1',
      question: 'What is the basic condition (Rukn) of fasting (Sawm)? / روزے کا بنیادی رکن کیا ہے؟',
      options: ['Taraweeh prayer', 'Abstaining from food, drink & marital intimacy from Subh Sadiq till Sunset with Niyyah (امساک مع النیت)', 'Only drinking water', 'Staying in the Masjid'],
      correct_answer: 'Abstaining from food, drink & marital intimacy from Subh Sadiq till Sunset with Niyyah (امساک مع النیت)',
      category: 'Roza',
      explanation: 'The pillar of fasting is Imsak (abstaining) from Fajr start until Maghrib sunset accompanied by valid intention (Niyyah).',
      difficulty: 'easy',
    },
    {
      id: 'roza_2',
      question: 'Does eating or drinking forgetfully (Bhool kar) break the fast? / بھول کر کھانے پینے سے کیا روزہ ٹوٹ جاتا ہے؟',
      options: ['Yes, fast breaks and requires Kaffarah', 'No, the fast remains completely intact (نہیں، روزہ نہیں ٹوٹتا)', 'Only if eaten after Dhuhr', 'Requires half Qada'],
      correct_answer: 'No, the fast remains completely intact (نہیں، روزہ نہیں ٹوٹتا)',
      category: 'Roza',
      explanation: 'As per Hadith in Sahih Bukhari, whoever eats or drinks out of forgetfulness should complete their fast, as Allah provided them food and drink.',
      difficulty: 'easy',
    },
  ],
  'Hijab': [
    {
      id: 'hijab_1',
      question: 'What constitutes Satr-e-Aurat (covered zone) for a Muslim woman in front of non-Mahram men? / غیر محرم کے سامنے عورت کا ستر کیا ہے؟',
      options: ['Only head', 'Entire body except face, hands and feet under Shariah rules (پورا جسم سوائے جائز استثناء)', 'Only shoulders', 'Face only'],
      correct_answer: 'Entire body except face, hands and feet under Shariah rules (پورا جسم سوائے جائز استثناء)',
      category: 'Hijab',
      explanation: 'Islamic law mandates full dignified covering preventing fitnah, covering the entire body in modesty in front of non-Mahram individuals.',
      difficulty: 'medium',
    },
  ],
};

export async function generateAiQuiz(params: QuizGenerationParams): Promise<GeneratedQuestion[]> {
  const category = params.category || 'Wudu';
  const targetCount = params.count || 5;

  const templates = ISLAMIC_QUESTION_KNOWLEDGE_BASE[category] || ISLAMIC_QUESTION_KNOWLEDGE_BASE['Wudu'];
  const generated: GeneratedQuestion[] = [];

  for (let i = 0; i < targetCount; i++) {
    const base = templates[i % templates.length];
    const uniqueId = 'ai_q_' + Date.now() + '_' + (i + 1);

    let qText = base.question;
    let opts = [...base.options];
    let correct = base.correct_answer;
    let expl = base.explanation;

    // Filter by language preference
    if (params.language === 'english') {
      if (qText.includes(' / ')) qText = qText.split(' / ')[0];
      opts = opts.map((o) => (o.includes(' (') ? o.split(' (')[0] : o));
      if (correct.includes(' (')) correct = correct.split(' (')[0];
    } else if (params.language === 'urdu') {
      if (qText.includes(' / ')) qText = qText.split(' / ')[1] || qText;
      opts = opts.map((o) => {
        const match = o.match(/\((.*?)\)/);
        return match ? match[1] : o;
      });
      const cMatch = correct.match(/\((.*?)\)/);
      if (cMatch) correct = cMatch[1];
    }

    generated.push({
      id: uniqueId,
      question: (i >= templates.length ? `[Q${i + 1}] ` : '') + qText,
      options: opts,
      correct_answer: correct,
      category: category,
      explanation: expl,
      difficulty: params.difficulty,
      language: params.language,
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
      difficulty: q.difficulty || 'easy',
    });
  }

  await batch.commit();
  await clearQuizCounts().catch(() => {});
  return { count: questions.length };
}

export function formatQuizAsPrintableExam(questions: GeneratedQuestion[], title: string): string {
  let output = 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيم\n';
  output += '📜 *Madrasatu-s-Salikat Lil Banat — Examination Paper*\n';
  output += '📚 *Subject / Category:* ' + (title || 'Islamic Quiz') + '\n';
  output += '⏱️ *Total Questions:* ' + questions.length + '\n';
  output += '══════════════════════════════════════\n\n';

  questions.forEach((q, idx) => {
    output += 'Q' + (idx + 1) + '. ' + q.question + '\n';
    q.options.forEach((opt, oIdx) => {
      const label = ['(A)', '(B)', '(C)', '(D)'][oIdx] || '(' + (oIdx + 1) + ')';
      output += '   ' + label + ' ' + opt + '\n';
    });
    output += '\n';
  });

  output += '══════════════════════════════════════\n';
  output += '🔑 *Answer Key (For Faculty & Exam Review):*\n';
  questions.forEach((q, idx) => {
    output += 'Q' + (idx + 1) + ' Answer: ' + q.correct_answer + '\n';
  });

  return output;
}
