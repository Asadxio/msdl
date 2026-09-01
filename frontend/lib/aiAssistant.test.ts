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
});
