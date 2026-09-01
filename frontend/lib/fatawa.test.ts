import {
  FATAWA_CATEGORIES,
  FatawaCategoryKey,
  askFatawaQuestion,
  answerFatawaQuestion,
} from './fatawa';

// Mock Firestore
jest.mock('firebase/firestore', () => {
  const actual = jest.requireActual('firebase/firestore');
  return {
    ...actual,
    collection: jest.fn(() => ({ id: 'fatawa_questions' })),
    doc: jest.fn((col, id) => ({ id: id || 'test_doc_id', path: 'fatawa_questions/' + (id || 'test_doc_id') })),
    getDoc: jest.fn().mockResolvedValue({
      exists: () => true,
      data: () => ({ student_id: 'u123', title: 'Test Question' }),
    }),
    setDoc: jest.fn().mockResolvedValue(undefined),
    updateDoc: jest.fn().mockResolvedValue(undefined),
    query: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    onSnapshot: jest.fn((q, cb) => {
      cb({
        forEach: jest.fn(),
      });
      return jest.fn();
    }),
    serverTimestamp: jest.fn(() => ({ seconds: 1234567890, nanoseconds: 0 })),
  };
});

describe('Fatawa & Dar-ul-Iftaa Module', () => {
  it('defines all 6 essential Islamic fatawa categories', () => {
    const keys: FatawaCategoryKey[] = ['taharat', 'salah', 'sawm', 'purdah', 'family', 'general'];
    keys.forEach((k) => {
      expect(FATAWA_CATEGORIES[k]).toBeDefined();
      expect(FATAWA_CATEGORIES[k].arabicTitle).toBeTruthy();
      expect(FATAWA_CATEGORIES[k].title).toBeTruthy();
      expect(FATAWA_CATEGORIES[k].description).toBeTruthy();
    });
  });

  it('rejects questions with title that is too short', async () => {
    await expect(
      askFatawaQuestion({
        userId: 'u123',
        userName: 'Taliba Fatima',
        category: 'taharat',
        title: 'ab',
        question: 'Detailed question about wuzu rules and validation.',
      })
    ).rejects.toThrow('Title must be at least 3 characters long.');
  });

  it('rejects questions with body that is too short', async () => {
    await expect(
      askFatawaQuestion({
        userId: 'u123',
        userName: 'Taliba Fatima',
        category: 'salah',
        title: 'Namaz Qaza',
        question: 'Short',
      })
    ).rejects.toThrow('Question must be at least 10 characters long.');
  });

  it('successfully creates a pending question with valid payload', async () => {
    const docId = await askFatawaQuestion({
      userId: 'u123',
      userName: 'Taliba Fatima',
      category: 'taharat',
      title: 'Hale Ghusl Masala',
      question: 'Kia beemari ki halat mein tayammum jaiz hai?',
    });

    expect(docId).toBe('test_doc_id');
  });

  it('validates teacher answer input length before recording', async () => {
    await expect(
      answerFatawaQuestion({
        questionId: 'q123',
        teacherUid: 't456',
        teacherName: 'Ustaadha Zaynab',
        answer: 'No',
        referenceKitab: 'Bahishti Zewar',
        isPublic: true,
      })
    ).rejects.toThrow('Answer must be at least 5 characters long.');
  });

  it('successfully records teacher answer and reference', async () => {
    await expect(
      answerFatawaQuestion({
        questionId: 'q123',
        teacherUid: 't456',
        teacherName: 'Ustaadha Zaynab',
        answer: 'Ji haan, agar pani istemal karne se maraz barhne ka khadsha ho to tayammum jaiz hai.',
        referenceKitab: 'Bahishti Zewar, Hissa 2',
        isPublic: true,
      })
    ).resolves.not.toThrow();
  });
});
