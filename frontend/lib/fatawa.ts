import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type FatawaCategoryKey =
  | 'taharat'
  | 'salah'
  | 'sawm'
  | 'purdah'
  | 'family'
  | 'general';

export interface FatawaCategoryDef {
  key: FatawaCategoryKey;
  title: string;
  arabicTitle: string;
  icon: string;
  description: string;
}

export const FATAWA_CATEGORIES: Record<FatawaCategoryKey, FatawaCategoryDef> = {
  taharat: {
    key: 'taharat',
    title: 'Taharat & Ghusl',
    arabicTitle: 'طَہَارَت وَ غُسْل',
    icon: 'water-outline',
    description: 'Paki, napaaki, wuzu, ghusl, aur khawateen ke makhsoos masail.',
  },
  salah: {
    key: 'salah',
    title: 'Salah & Prayers',
    arabicTitle: 'صَلَاۃ وَ نَمَاز',
    icon: 'time-outline',
    description: 'Namaz ke arkaan, qaza namazein, sajda sahw, aur auqaat.',
  },
  sawm: {
    key: 'sawm',
    title: 'Sawm & Ramadan',
    arabicTitle: 'صَوْم وَ رَمَضَان',
    icon: 'moon-outline',
    description: 'Roza, kaffara, fidya, aur Ramadan ke masail.',
  },
  purdah: {
    key: 'purdah',
    title: 'Purdah & Haya',
    arabicTitle: 'حِجَاب وَ پَرْدَہ',
    icon: 'shield-checkmark-outline',
    description: 'Sharai purdah, libas, aur islami adab-o-haya.',
  },
  family: {
    key: 'family',
    title: 'Family & Nikah',
    arabicTitle: 'نِکَاح وَ خَانْدَان',
    icon: 'heart-outline',
    description: 'Nikah, huqooq-ul-ibad, walidain, aur aulad ki tarbiyat.',
  },
  general: {
    key: 'general',
    title: 'General Deeni Masail',
    arabicTitle: 'عَام دِینِی مَسَائِل',
    icon: 'book-outline',
    description: 'Muamalat, aqaid, sunnat-o-bidat, aur rozmarrah masail.',
  },
};

export interface FatawaQuestion {
  id: string;
  student_id: string;
  student_name: string;
  category: FatawaCategoryKey;
  title: string;
  question: string;
  status: 'pending' | 'answered' | 'rejected';
  answer?: string;
  answered_by_uid?: string;
  answered_by_name?: string;
  answered_at?: Timestamp | any;
  reference_kitab?: string;
  is_public: boolean;
  created_at?: Timestamp | any;
  updated_at?: Timestamp | any;
}

export async function askFatawaQuestion(params: {
  userId: string;
  userName: string;
  category: FatawaCategoryKey;
  title: string;
  question: string;
}): Promise<string> {
  const title = params.title.trim();
  const question = params.question.trim();

  if (!title || title.length < 3) {
    throw new Error('Title must be at least 3 characters long.');
  }
  if (!question || question.length < 10) {
    throw new Error('Question must be at least 10 characters long.');
  }

  const colRef = collection(db, 'fatawa_questions');
  const newDocRef = doc(colRef);

  const payload = {
    id: newDocRef.id,
    student_id: params.userId,
    student_name: params.userName || 'Taliba',
    category: params.category,
    title,
    question,
    status: 'pending',
    is_public: false,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };

  await setDoc(newDocRef, payload);

  // Notify teachers/Dar-ul-Ifta scholars about the new question
  try {
    const notifRef = doc(collection(db, 'notifications'));
    const dedupeId = `fatwa_ask:${newDocRef.id}:${Date.now()}`;
    await setDoc(notifRef, {
      id: notifRef.id,
      user_id: 'role_targeted',
      target_roles: ['teacher'],
      recipient_id: 'all_teachers',
      actor_id: params.userId,
      category: 'fatawa_question_asked',
      channel: 'announcements',
      event: 'system_alert',
      title: 'نیا فقہی سوال (New Dar-ul-Ifta Question)',
      message: `ایک طالبہ نے دار الافتاء میں نیا سوال پوچھا ہے: "${title}"`,
      body: `ایک طالبہ نے دار الافتاء میں نیا سوال پوچھا ہے: "${title}"`,
      route: '/fatawa/manage',
      read: {},
      dedupe_id: dedupeId,
      created_at: serverTimestamp(),
      created_at_ms: Date.now(),
    });
  } catch (err) {
    console.warn('[Fatawa] Teacher notification dispatch failed:', err);
  }

  return newDocRef.id;
}

export function subscribeToMyQuestions(
  userId: string,
  callback: (questions: FatawaQuestion[]) => void
): () => void {
  const q = query(
    collection(db, 'fatawa_questions'),
    where('student_id', '==', userId),
    orderBy('created_at', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list: FatawaQuestion[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as FatawaQuestion);
      });
      callback(list);
    },
    (err) => {
      console.warn('[Fatawa] Error fetching user questions:', err);
      callback([]);
    }
  );
}

export function subscribeToPublicFatawa(
  categoryFilter: FatawaCategoryKey | 'all',
  callback: (questions: FatawaQuestion[]) => void
): () => void {
  const baseQuery = categoryFilter === 'all'
    ? query(
        collection(db, 'fatawa_questions'),
        where('is_public', '==', true),
        where('status', '==', 'answered'),
        orderBy('answered_at', 'desc')
      )
    : query(
        collection(db, 'fatawa_questions'),
        where('is_public', '==', true),
        where('status', '==', 'answered'),
        where('category', '==', categoryFilter),
        orderBy('answered_at', 'desc')
      );

  return onSnapshot(
    baseQuery,
    (snapshot) => {
      const list: FatawaQuestion[] = [];
      snapshot.forEach((docSnap) => {
        const item = docSnap.data() as FatawaQuestion;
        // Redact student name for privacy in public view
        item.student_name = 'سائلہ (محفوظ برائے پردہ)';
        list.push(item);
      });
      callback(list);
    },
    (err) => {
      console.warn('[Fatawa] Error fetching public fatawa:', err);
      callback([]);
    }
  );
}

export type TeacherFatawaFilter = 'all' | 'pending' | 'answered';

export function subscribeToQuestionsForTeacher(
  options: {
    status?: TeacherFatawaFilter;
    category?: FatawaCategoryKey | 'all';
  },
  callback: (questions: FatawaQuestion[]) => void
): () => void {
  // Query all questions ordered by creation descending so scholars have full visibility
  const q = query(
    collection(db, 'fatawa_questions'),
    orderBy('created_at', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const all: FatawaQuestion[] = [];
      snapshot.forEach((docSnap) => {
        all.push(docSnap.data() as FatawaQuestion);
      });

      const filtered = all.filter((item) => {
        // Status filter
        if (options.status && options.status !== 'all') {
          if (item.status !== options.status) return false;
        }
        // Category filter
        if (options.category && options.category !== 'all') {
          if (item.category !== options.category) return false;
        }
        return true;
      });

      callback(filtered);
    },
    (err) => {
      console.warn('[Fatawa] Error fetching questions for teacher:', err);
      callback([]);
    }
  );
}

export function subscribeToPendingQuestionsForTeacher(
  callback: (questions: FatawaQuestion[]) => void
): () => void {
  return subscribeToQuestionsForTeacher({ status: 'pending' }, callback);
}

export async function answerFatawaQuestion(params: {
  questionId: string;
  teacherUid: string;
  teacherName: string;
  answer: string;
  referenceKitab?: string;
  isPublic: boolean;
}): Promise<void> {
  const answer = params.answer.trim();
  if (!answer || answer.length < 5) {
    throw new Error('Answer must be at least 5 characters long.');
  }

  const docRef = doc(db, 'fatawa_questions', params.questionId);
  const snap = await getDoc(docRef);

  await updateDoc(docRef, {
    answer,
    answered_by_uid: params.teacherUid,
    answered_by_name: params.teacherName || 'Muftiah / Ustaadha',
    answered_at: serverTimestamp(),
    reference_kitab: params.referenceKitab?.trim() || 'کتبِ فقہ و فتاویٰ',
    is_public: params.isPublic,
    status: 'answered',
    updated_at: serverTimestamp(),
  });

  if (snap.exists()) {
    const qData = snap.data() as FatawaQuestion;
    if (qData.student_id) {
      try {
        const notifRef = doc(collection(db, 'notifications'));
        const dedupeId = `fatwa_ans:${params.questionId}:${Date.now()}`;
        await setDoc(notifRef, {
          id: notifRef.id,
          recipient_id: qData.student_id,
          user_id: qData.student_id,
          actor_id: params.teacherUid,
          channel: 'announcements',
          event: 'system_alert',
          type: 'fatwa_answered',
          category: 'fatwa_answered',
          title: 'شرعی مسئلہ کا جواب (Fatwa Answered)',
          message: `آپ کے سوال "${qData.title}" کا جواب دار الافتاء کی طرف سے جاری کر دیا گیا ہے۔`,
          body: `آپ کے سوال "${qData.title}" کا جواب دار الافتاء کی طرف سے جاری کر دیا گیا ہے۔`,
          route: `/fatawa/${params.questionId}`,
          read: { [qData.student_id]: false },
          dedupe_id: dedupeId,
          created_at: serverTimestamp(),
          created_at_ms: Date.now(),
        });
      } catch (err) {
        console.warn('[Fatawa] Notification write skipped:', err);
      }
    }
  }
}
