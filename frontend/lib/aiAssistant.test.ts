import {
  isFatwaQuery,
  getFatwaRedirectMessage,
  askAiSabaqAssistant,
  SUGGESTED_STUDY_PROMPTS,
} from './aiAssistant';

describe('24/7 AI Sabaq Assistant Module', () => {
  it('provides suggested study prompts across categories', () => {
    expect(SUGGESTED_STUDY_PROMPTS.length).toBeGreaterThanOrEqual(4);
    expect(SUGGESTED_STUDY_PROMPTS.map((p) => p.category)).toContain('quran');
    expect(SUGGESTED_STUDY_PROMPTS.map((p) => p.category)).toContain('tajweed');
  });

  it('accurately identifies sensitive Fatwa queries', () => {
    expect(isFatwaQuery('طلاق کا شرعی مسئلہ کیا ہے؟')).toBe(true);
    expect(isFatwaQuery('is this halal or haram?')).toBe(true);
    expect(isFatwaQuery('what is the meaning of Surah Fatiha?')).toBe(false);
  });

  it('safely redirects Fatwa queries to Dar-ul-Iftaa', async () => {
    const result = await askAiSabaqAssistant('میرا طلاق کا مسئلہ ہے بتائیں');
    expect(result.isRedirect).toBe(true);
    expect(result.text).toContain('دار الافتاء');
  });

  it('answers educational Quranic vocabulary questions with rich detail', async () => {
    const result = await askAiSabaqAssistant('سورۃ الفاتحہ کے الفاظ کے معانی بتائیں');
    expect(result.isRedirect).toBeFalsy();
    expect(result.text).toContain('الْحَمْدُ لِلَّهِ');
    expect(result.text).toContain('رَبِّ الْعَالَمِينَ');
  });

  it('answers Tajweed rule queries accurately', async () => {
    const result = await askAiSabaqAssistant('نون ساکن اور تنوین کے بعد اخفاء اور ادغام کیا ہے؟');
    expect(result.isRedirect).toBeFalsy();
    expect(result.text).toContain('اظہار');
    expect(result.text).toContain('ادغام');
    expect(result.text).toContain('اخفاء');
  });

  it('delivers first-class English explanations for English queries', async () => {
    const result = await askAiSabaqAssistant('Explain the 4 Farz of Wudu according to Hanafi Fiqh');
    expect(result.isRedirect).toBeFalsy();
    expect(result.language).toBe('en');
    expect(result.text).toContain('Washing the Entire Face');
    expect(result.text).toContain('Washing Both Arms');
    expect(result.text).toContain('Masah');
    expect(result.text).toContain('Washing Both Feet');
  });

  it('provides bilingual Fatwa redirects with English translation when requested', async () => {
    const redirectEn = getFatwaRedirectMessage('en');
    expect(redirectEn).toContain('Dar-ul-Iftaa');
    expect(redirectEn).toContain('artificial intelligence (AI)');

    const result = await askAiSabaqAssistant('Can I divorce my husband if he is abusive?', [], { language: 'en' });
    expect(result.isRedirect).toBe(true);
    expect(result.text).toContain('Dar-ul-Iftaa');
  });

  it('supports interactive Quiz mode with questions, options, and explanations', async () => {
    const result = await askAiSabaqAssistant('Give me a quiz on Surah Fatiha', [], { mode: 'quiz', language: 'en' });
    expect(result.quiz).toBeDefined();
    expect(result.quiz?.question).toBeDefined();
    expect(result.quiz?.options.length).toBeGreaterThanOrEqual(4);
    const correctOpt = result.quiz?.options.find((o) => o.isCorrect);
    expect(correctOpt).toBeDefined();
    expect(correctOpt?.explanation).toBeDefined();
  });

  it('supports Vocabulary mode with Arabic root analysis', async () => {
    const result = await askAiSabaqAssistant('Show vocabulary roots of Tajweed rules', [], { mode: 'vocab', language: 'en' });
    expect(result.vocab).toBeDefined();
    expect(result.vocab?.length).toBeGreaterThan(0);
    expect(result.vocab?.[0].root).toBeDefined();
    expect(result.text).toContain('Root:');
  });

  it('supports Summary mode with bulleted revision points', async () => {
    const result = await askAiSabaqAssistant('Give a summary of Salah pillars', [], { mode: 'summary', language: 'en' });
    expect(result.summaryPoints).toBeDefined();
    expect(result.summaryPoints?.length).toBeGreaterThan(0);
    expect(result.text).toContain('⚡');
  });

  it('incorporates lesson and course context into guidance', async () => {
    const result = await askAiSabaqAssistant('How to memorize this effectively?', [], {
      language: 'en',
      courseTitle: 'Tahfeez-ul-Quran',
      lessonTitle: 'Juz 1 Revision',
    });
    expect(result.text).toContain('Tahfeez-ul-Quran');
    expect(result.text).toContain('Juz 1 Revision');
  });
});

