import {
  generateAiQuiz,
  formatQuizAsPrintableExam,
} from './aiQuizGenerator';

describe('AI Auto-Quiz & Exam Maker Module', () => {
  it('generates target number of valid Islamic MCQs', async () => {
    const questions = await generateAiQuiz({
      category: 'Wudu',
      count: 5,
      difficulty: 'easy',
    });

    expect(questions.length).toBe(5);
    questions.forEach((q) => {
      expect(q.question.length).toBeGreaterThan(0);
      expect(q.options.length).toBe(4);
      expect(q.options).toContain(q.correct_answer);
      expect(q.category).toBe('Wudu');
    });
  });

  it('generates questions for different categories', async () => {
    const namazQuiz = await generateAiQuiz({
      category: 'Namaz ke Farz',
      count: 3,
      difficulty: 'medium',
    });

    expect(namazQuiz.length).toBe(3);
    expect(namazQuiz[0].category).toBe('Namaz ke Farz');
  });

  it('formats exam paper into a clean printable and shareable layout with answer key', async () => {
    const questions = await generateAiQuiz({
      category: 'Wudu',
      count: 2,
      difficulty: 'easy',
    });

    const examText = formatQuizAsPrintableExam(questions, 'طہارت و وضو');
    expect(examText).toContain('بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيم');
    expect(examText).toContain('مدرسۃ السالکات للبنات');
    expect(examText).toContain('طہارت و وضو');
    expect(examText).toContain('جوابی پرچہ (Answer Key for Teacher)');
    expect(examText).toContain(questions[0].correct_answer);
  });
});
