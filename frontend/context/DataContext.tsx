import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection, getDocs, getDoc, addDoc, serverTimestamp, doc, updateDoc, setDoc, query, where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COURSES as LOCAL_COURSES, TEACHERS as LOCAL_TEACHERS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { normalizeFirebaseError, withTimeout } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createRoleNotification } from '@/lib/notifications';

export type Course = {
  id: string;
  name: string;
  teacher_name: string;
  schedule: string;
  time?: string;
  class_time?: string;
  description: string;
  class_link: string;
  meet_link?: string;
};

export type Teacher = {
  id: string;
  name: string;
  title: string;
  courses: string[];
  photo_url?: string;
};

export type Book = {
  id: string;
  title: string;
  description?: string;
  file_url: string;
  pdf_url: string;
  category: string;
  category_id?: string;
  deleted?: boolean;
};

export type CourseModule = {
  id: string;
  course_id: string;
  title: string;
  order: number;
};

export type Lesson = {
  id: string;
  course_id: string;
  module_id: string;
  title: string;
  order: number;
  description?: string;
  duration_minutes?: number;
  content_url?: string;
  video_url?: string;
  pdf_url?: string;
  quiz_id?: string;
  resources?: { type: 'video' | 'pdf'; title: string; url: string }[];
};

export type Assignment = {
  id: string;
  lesson_id: string;
  module_id: string;
  course_id: string;
  title: string;
  description: string;
  due_date?: string;
  file_url?: string;
};

export type SubmissionStatus = 'submitted' | 'reviewed';

export type AssignmentSubmission = {
  id: string;
  user_id: string;
  assignment_id: string;
  file_url?: string;
  text_answer?: string;
  status: SubmissionStatus;
  feedback?: string;
  grade?: string;
  created_at?: { toDate?: () => Date } | null;
  reviewed_at?: { toDate?: () => Date } | null;
  reviewer_id?: string;
};

export type ResumeLearning = {
  courseId: string;
  courseName: string;
  moduleId: string;
  moduleTitle: string;
  lessonId: string;
  lessonTitle: string;
};

export type LessonProgressState = {
  completed: boolean;
  quizCompleted: boolean;
  lastOpenedAt?: number;
};

export type CourseProgressSummary = {
  totalLessons: number;
  lessonsDone: number;
  quizzesDone: number;
  completionPercent: number;
};

type DataContextType = {
  courses: Course[];
  teachers: Teacher[];
  books: Book[];
  loading: boolean;
  booksLoading: boolean;
  modules: CourseModule[];
  lessons: Lesson[];
  assignments: Assignment[];
  submissions: AssignmentSubmission[];
  lessonProgress: Record<string, LessonProgressState>;
  error: string | null;
  refetch: () => void;
  refetchBooks: () => Promise<void>;
  refetchLearning: () => Promise<void>;
  getModulesForCourse: (courseId: string) => CourseModule[];
  getLessonsForModule: (moduleId: string) => Lesson[];
  getLessonById: (lessonId: string) => Lesson | null;
  getAssignmentsForLesson: (lessonId: string) => Assignment[];
  getSubmissionForAssignment: (assignmentId: string) => AssignmentSubmission | null;
  getSubmissionsForAssignment: (assignmentId: string) => AssignmentSubmission[];
  markLessonOpened: (lesson: Lesson) => Promise<void>;
  markLessonComplete: (lesson: Lesson) => Promise<boolean>;
  markLessonQuizComplete: (lesson: Lesson) => Promise<boolean>;
  submitAssignment: (params: {
    assignmentId: string;
    textAnswer?: string;
    fileUrl?: string;
  }) => Promise<boolean>;
  reviewSubmission: (params: {
    submissionId: string;
    feedback: string;
    grade?: string;
  }) => Promise<boolean>;
  getResumeLearning: () => ResumeLearning | null;
  getCourseProgress: (courseId: string) => CourseProgressSummary;
  addBook: (
    title: string,
    file_url: string,
    category: string,
    category_id?: string,
    description?: string,
  ) => Promise<boolean>;
  deleteBook: (bookId: string) => Promise<boolean>;
};

const DataContext = createContext<DataContextType>({
  courses: [],
  teachers: [],
  books: [],
  loading: true,
  booksLoading: true,
  modules: [],
  lessons: [],
  assignments: [],
  submissions: [],
  lessonProgress: {},
  error: null,
  refetch: () => {},
  refetchBooks: async () => {},
  refetchLearning: async () => {},
  getModulesForCourse: () => [],
  getLessonsForModule: () => [],
  getLessonById: () => null,
  getAssignmentsForLesson: () => [],
  getSubmissionForAssignment: () => null,
  getSubmissionsForAssignment: () => [],
  markLessonOpened: async () => {},
  markLessonComplete: async () => false,
  markLessonQuizComplete: async () => false,
  submitAssignment: async () => false,
  reviewSubmission: async () => false,
  getResumeLearning: () => null,
  getCourseProgress: () => ({ totalLessons: 0, lessonsDone: 0, quizzesDone: 0, completionPercent: 0 }),
  addBook: async () => false,
  deleteBook: async () => false,
});
const COURSES_CACHE_KEY = 'courses_cache_v1';
const TEACHERS_CACHE_KEY = 'teachers_cache_v1';

export function useData() {
  return useContext(DataContext);
}

function getLocalCourses(): Course[] {
  return LOCAL_COURSES.map((c) => ({
    id: c.id,
    name: c.name,
    teacher_name: c.teacher,
    schedule: c.schedule,
    time: '',
    class_time: '',
    description: c.description,
    class_link: '',
    meet_link: '',
  }));
}

function getLocalTeachers(): Teacher[] {
  return LOCAL_TEACHERS.map((t) => ({
    id: t.id,
    name: t.name,
    title: t.title,
    courses: t.courseIds.map((cid) => {
      const course = LOCAL_COURSES.find((c) => c.id === cid);
      return course ? course.name : '';
    }).filter(Boolean),
    photo_url: '',
  }));
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { profile, user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [lessonProgress, setLessonProgress] = useState<Record<string, LessonProgressState>>({});
  const [lastOpenedLessonId, setLastOpenedLessonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [booksLoading, setBooksLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBooks = useCallback(async () => {
    setBooksLoading(true);
    try {
      const booksSnap = await withTimeout(getDocs(collection(db, 'library')));
      const booksData: Book[] = [];
      booksSnap.forEach((doc) => {
        const data = doc.data();
        if (data.deleted) return;
        booksData.push({
          id: doc.id,
          title: data.title || '',
          description: data.description || '',
          file_url: data.file_url || data.pdf_url || data.pdfUrl || '',
          pdf_url: data.file_url || data.pdf_url || data.pdfUrl || '',
          category: data.category || '',
          category_id: data.category_id || '',
        });
      });
      setBooks(booksData);
    } catch (err: any) {
      logger.warn('Failed to fetch books:', normalizeFirebaseError(err, 'Failed to fetch books'));
      setBooks([]);
    } finally {
      setBooksLoading(false);
    }
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const coursesSnap = await withTimeout(getDocs(collection(db, 'courses')));
      const coursesData: Course[] = [];
      coursesSnap.forEach((doc) => {
        const data = doc.data();
        coursesData.push({
          id: doc.id,
          name: data.name || '',
          teacher_name: data.teacherName || data.teacher_name || '',
          schedule: data.schedule || '',
          time: data.time || '',
          class_time: data.class_time || data.time || '',
          description: data.description || '',
          class_link: data.classLink || data.class_link || data.meet_link || '',
          meet_link: data.meet_link || data.class_link || data.classLink || '',
        });
      });

      const teachersSnap = await withTimeout(getDocs(collection(db, 'teachers')));
      const teachersData: Teacher[] = [];
      teachersSnap.forEach((doc) => {
        const data = doc.data();
        teachersData.push({
          id: doc.id,
          name: data.name || '',
          title: data.title || '',
          courses: Array.isArray(data.courses) ? data.courses : [],
          photo_url: data.photo_url || '',
        });
      });

      setCourses(coursesData.length > 0 ? coursesData : getLocalCourses());
      setTeachers(teachersData.length > 0 ? teachersData : getLocalTeachers());
      await AsyncStorage.setItem(COURSES_CACHE_KEY, JSON.stringify(coursesData)).catch(() => {});
      await AsyncStorage.setItem(TEACHERS_CACHE_KEY, JSON.stringify(teachersData)).catch(() => {});
    } catch (err: any) {
      logger.warn('Firebase fetch failed, using local data:', normalizeFirebaseError(err, 'Failed to fetch data'));
      setError(normalizeFirebaseError(err, 'Failed to fetch data'));
      const cachedCoursesRaw = await AsyncStorage.getItem(COURSES_CACHE_KEY).catch(() => null);
      const cachedTeachersRaw = await AsyncStorage.getItem(TEACHERS_CACHE_KEY).catch(() => null);
      let cachedCourses: Course[] = [];
      let cachedTeachers: Teacher[] = [];
      try {
        const parsed = cachedCoursesRaw ? JSON.parse(cachedCoursesRaw) : [];
        cachedCourses = Array.isArray(parsed) ? parsed : [];
      } catch {
        cachedCourses = [];
      }
      try {
        const parsed = cachedTeachersRaw ? JSON.parse(cachedTeachersRaw) : [];
        cachedTeachers = Array.isArray(parsed) ? parsed : [];
      } catch {
        cachedTeachers = [];
      }
      setCourses(cachedCourses.length > 0 ? cachedCourses : getLocalCourses());
      setTeachers(cachedTeachers.length > 0 ? cachedTeachers : getLocalTeachers());
    } finally {
      setLoading(false);
    }
  };

  const getLocalModulesAndLessons = (seedCourses: Course[]) => {
    const nextModules: CourseModule[] = [];
    const nextLessons: Lesson[] = [];
    seedCourses.forEach((course) => {
      const introModuleId = `module-${course.id}-1`;
      const advancedModuleId = `module-${course.id}-2`;
      nextModules.push(
        { id: introModuleId, course_id: course.id, title: 'Introduction', order: 1 },
        { id: advancedModuleId, course_id: course.id, title: 'Practice & Revision', order: 2 },
      );
      nextLessons.push(
        { id: `lesson-${course.id}-1`, course_id: course.id, module_id: introModuleId, title: 'Lesson 1', order: 1, duration_minutes: 20 },
        { id: `lesson-${course.id}-2`, course_id: course.id, module_id: introModuleId, title: 'Lesson 2', order: 2, duration_minutes: 25, quiz_id: `quiz-${course.id}-2` },
        { id: `lesson-${course.id}-3`, course_id: course.id, module_id: advancedModuleId, title: 'Lesson 3', order: 3, duration_minutes: 30, content_url: course.meet_link || course.class_link || '' },
      );
    });
    return { nextModules, nextLessons };
  };

  const fetchLearning = useCallback(async () => {
    if (!user?.uid) {
      setModules([]);
      setLessons([]);
      setAssignments([]);
      setSubmissions([]);
      setLessonProgress({});
      return;
    }

    try {
      const progressQuery = query(collection(db, 'lesson_progress'), where('user_id', '==', user.uid));
      const canReviewSubmissions = profile?.role === 'teacher' || profile?.role === 'admin';
      const submissionsQuery = canReviewSubmissions
        ? collection(db, 'submissions')
        : query(collection(db, 'submissions'), where('user_id', '==', user.uid));

      const [moduleSnap, lessonSnap, assignmentSnap, progressSnap, submissionSnap, learningStateSnap] = await Promise.all([
        withTimeout(getDocs(collection(db, 'modules'))),
        withTimeout(getDocs(collection(db, 'lessons'))),
        withTimeout(getDocs(collection(db, 'assignments'))),
        withTimeout(getDocs(progressQuery)),
        withTimeout(getDocs(submissionsQuery)),
        withTimeout(getDoc(doc(db, 'learning_state', user.uid))),
      ]);

      const nextModules: CourseModule[] = [];
      moduleSnap.forEach((d) => {
        const data = d.data() as any;
        nextModules.push({
          id: d.id,
          course_id: String(data.course_id || ''),
          title: String(data.title || 'Module'),
          order: Number(data.order || 0),
        });
      });

      const nextLessons: Lesson[] = [];
      lessonSnap.forEach((d) => {
        const data = d.data() as any;
        nextLessons.push({
          id: d.id,
          course_id: String(data.course_id || ''),
          module_id: String(data.module_id || ''),
          title: String(data.title || 'Lesson'),
          order: Number(data.order || 0),
          description: data.description ? String(data.description) : '',
          duration_minutes: Number(data.duration_minutes || 0) || undefined,
          content_url: data.content_url ? String(data.content_url) : undefined,
          video_url: data.video_url ? String(data.video_url) : undefined,
          pdf_url: data.pdf_url ? String(data.pdf_url) : undefined,
          quiz_id: data.quiz_id ? String(data.quiz_id) : undefined,
          resources: Array.isArray(data.resources) ? data.resources : undefined,
        });
      });
      const nextAssignments: Assignment[] = [];
      assignmentSnap.forEach((d) => {
        const data = d.data() as any;
        nextAssignments.push({
          id: d.id,
          lesson_id: String(data.lesson_id || ''),
          module_id: String(data.module_id || ''),
          course_id: String(data.course_id || ''),
          title: String(data.title || 'Assignment'),
          description: String(data.description || ''),
          due_date: data.due_date ? String(data.due_date) : undefined,
          file_url: data.file_url ? String(data.file_url) : undefined,
        });
      });

      const nextProgress: Record<string, LessonProgressState> = {};
      progressSnap.forEach((d) => {
        const data = d.data() as any;
        if (data.completed) {
          nextProgress[String(data.lesson_id)] = {
            completed: !!data.completed,
            quizCompleted: !!data.quiz_completed,
            lastOpenedAt: data.last_opened_at?.toDate ? data.last_opened_at.toDate().getTime() : undefined,
          };
        }
      });
      const nextSubmissions: AssignmentSubmission[] = [];
      submissionSnap.forEach((d) => {
        const data = d.data() as any;
        nextSubmissions.push({
          id: d.id,
          user_id: String(data.user_id || ''),
          assignment_id: String(data.assignment_id || ''),
          file_url: data.file_url ? String(data.file_url) : undefined,
          text_answer: data.text_answer ? String(data.text_answer) : '',
          status: data.status === 'reviewed' ? 'reviewed' : 'submitted',
          feedback: data.feedback ? String(data.feedback) : '',
          grade: data.grade ? String(data.grade) : '',
          created_at: data.created_at || null,
          reviewed_at: data.reviewed_at || null,
          reviewer_id: data.reviewer_id ? String(data.reviewer_id) : '',
        });
      });
      if (learningStateSnap.exists()) {
        const state = learningStateSnap.data() as any;
        setLastOpenedLessonId(state.last_opened_lesson_id ? String(state.last_opened_lesson_id) : null);
      } else {
        setLastOpenedLessonId(null);
      }

      if (nextModules.length === 0 || nextLessons.length === 0) {
        const local = getLocalModulesAndLessons(courses.length ? courses : getLocalCourses());
        setModules(local.nextModules);
        setLessons(local.nextLessons);
      } else {
        setModules(nextModules.sort((a, b) => a.order - b.order));
        setLessons(nextLessons.sort((a, b) => a.order - b.order));
      }
      setAssignments(nextAssignments);
      setLessonProgress(nextProgress);
      setSubmissions(nextSubmissions);
    } catch (err: any) {
      logger.warn('Failed to fetch structured learning:', normalizeFirebaseError(err, 'Failed to fetch learning'));
      const local = getLocalModulesAndLessons(courses.length ? courses : getLocalCourses());
      setModules(local.nextModules);
      setLessons(local.nextLessons);
      setAssignments([]);
      setSubmissions([]);
      setLessonProgress({});
      setLastOpenedLessonId(null);
    }
  }, [courses, profile?.role, user?.uid]);

  const addBook = async (
    title: string,
    file_url: string,
    category: string,
    category_id?: string,
    description?: string,
  ): Promise<boolean> => {
    if (profile?.role !== 'admin') {
      logger.warn('Unauthorized: only admin can add books');
      return false;
    }
    if (!title.trim() || !file_url.trim() || !category.trim()) {
      logger.warn('Invalid book payload: missing required fields');
      return false;
    }
    try {
      await withTimeout(addDoc(collection(db, 'library'), {
        title: title.trim(),
        description: String(description || '').trim(),
        file_url: file_url.trim(),
        // keep backward compatibility for existing readers/rules
        pdf_url: file_url.trim(),
        category: category.trim(),
        category_id: category_id || '',
        created_at: serverTimestamp(),
      }));
      await fetchBooks();
      return true;
    } catch (err: any) {
      logger.warn('Failed to add book:', normalizeFirebaseError(err, 'Failed to add book'));
      return false;
    }
  };

  const deleteBook = async (bookId: string): Promise<boolean> => {
    if (profile?.role !== 'admin') {
      logger.warn('Unauthorized: only admin can delete books');
      return false;
    }
    try {
      await withTimeout(updateDoc(doc(db, 'library', bookId), {
        deleted: true,
        deleted_at: serverTimestamp(),
      }));
      await fetchBooks();
      return true;
    } catch (err: any) {
      logger.warn('Failed to delete book:', normalizeFirebaseError(err, 'Failed to delete book'));
      return false;
    }
  };

  const getModulesForCourse = useCallback((courseId: string) => (
    modules.filter((m) => m.course_id === courseId).sort((a, b) => a.order - b.order)
  ), [modules]);

  const getLessonsForModule = useCallback((moduleId: string) => (
    lessons.filter((l) => l.module_id === moduleId).sort((a, b) => a.order - b.order)
  ), [lessons]);

  const getLessonById = useCallback((lessonId: string) => (
    lessons.find((lesson) => lesson.id === lessonId) || null
  ), [lessons]);
  const getAssignmentsForLesson = useCallback((lessonId: string) => (
    assignments
      .filter((assignment) => assignment.lesson_id === lessonId)
      .sort((a, b) => String(a.due_date || '').localeCompare(String(b.due_date || '')))
  ), [assignments]);
  const getSubmissionForAssignment = useCallback((assignmentId: string) => (
    submissions.find((submission) => submission.assignment_id === assignmentId && submission.user_id === user?.uid) || null
  ), [submissions, user?.uid]);
  const getSubmissionsForAssignment = useCallback((assignmentId: string) => (
    submissions
      .filter((submission) => submission.assignment_id === assignmentId)
      .sort((a, b) => {
        const aTime = a.created_at?.toDate ? a.created_at.toDate().getTime() : 0;
        const bTime = b.created_at?.toDate ? b.created_at.toDate().getTime() : 0;
        return bTime - aTime;
      })
  ), [submissions]);

  const markLessonOpened = useCallback(async (lesson: Lesson) => {
    if (!user?.uid) return;
    setLastOpenedLessonId(lesson.id);
    setLessonProgress((prev) => ({
      ...prev,
      [lesson.id]: {
        completed: prev[lesson.id]?.completed || false,
        quizCompleted: prev[lesson.id]?.quizCompleted || false,
        lastOpenedAt: Date.now(),
      },
    }));
    await withTimeout(setDoc(doc(db, 'learning_state', user.uid), {
      user_id: user.uid,
      last_opened_lesson_id: lesson.id,
      updated_at: serverTimestamp(),
    }, { merge: true })).catch(() => {});
  }, [user?.uid]);

  const markLessonComplete = useCallback(async (lesson: Lesson): Promise<boolean> => {
    if (!user?.uid) return false;
    try {
      await withTimeout(setDoc(doc(db, 'lesson_progress', `${user.uid}_${lesson.id}`), {
        user_id: user.uid,
        course_id: lesson.course_id,
        module_id: lesson.module_id,
        lesson_id: lesson.id,
        completed: true,
        quiz_completed: false,
        updated_at: serverTimestamp(),
      }, { merge: true }));
      setLessonProgress((prev) => ({
        ...prev,
        [lesson.id]: {
          completed: true,
          quizCompleted: prev[lesson.id]?.quizCompleted || false,
          lastOpenedAt: prev[lesson.id]?.lastOpenedAt,
        },
      }));
      return true;
    } catch (err: any) {
      logger.warn('Failed to mark lesson complete:', normalizeFirebaseError(err, 'Failed to save progress'));
      return false;
    }
  }, [user?.uid]);

  const markLessonQuizComplete = useCallback(async (lesson: Lesson): Promise<boolean> => {
    if (!user?.uid) return false;
    try {
      await withTimeout(setDoc(doc(db, 'lesson_progress', `${user.uid}_${lesson.id}`), {
        user_id: user.uid,
        course_id: lesson.course_id,
        module_id: lesson.module_id,
        lesson_id: lesson.id,
        completed: true,
        quiz_completed: true,
        updated_at: serverTimestamp(),
      }, { merge: true }));
      setLessonProgress((prev) => ({
        ...prev,
        [lesson.id]: {
          completed: true,
          quizCompleted: true,
          lastOpenedAt: prev[lesson.id]?.lastOpenedAt,
        },
      }));
      return true;
    } catch (err: any) {
      logger.warn('Failed to save lesson quiz:', normalizeFirebaseError(err, 'Failed to save lesson quiz'));
      return false;
    }
  }, [user?.uid]);

  const submitAssignment = useCallback(async (
    params: { assignmentId: string; textAnswer?: string; fileUrl?: string }
  ): Promise<boolean> => {
    if (!user?.uid) return false;
    try {
      const docId = `${user.uid}_${params.assignmentId}`;
      await withTimeout(setDoc(doc(db, 'submissions', docId), {
        user_id: user.uid,
        assignment_id: params.assignmentId,
        file_url: params.fileUrl || '',
        text_answer: params.textAnswer || '',
        status: 'submitted',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      }, { merge: true }));
      await createRoleNotification({
        title: 'Assignment Submitted',
        message: 'A student has submitted an assignment for review.',
        roles: ['teacher'],
        category: 'assignment_submitted',
      }).catch(() => {});
      await fetchLearning();
      return true;
    } catch (err: any) {
      logger.warn('Failed to submit assignment:', normalizeFirebaseError(err, 'Failed to submit assignment'));
      return false;
    }
  }, [fetchLearning, user?.uid]);

  const reviewSubmission = useCallback(async (
    params: { submissionId: string; feedback: string; grade?: string }
  ): Promise<boolean> => {
    if (!user?.uid) return false;
    try {
      const target = submissions.find((s) => s.id === params.submissionId);
      if (!target) return false;
      await withTimeout(updateDoc(doc(db, 'submissions', params.submissionId), {
        status: 'reviewed',
        feedback: params.feedback.trim(),
        grade: (params.grade || '').trim(),
        reviewer_id: user.uid,
        reviewed_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      }));
      await withTimeout(addDoc(collection(db, 'notifications'), {
        title: 'Assignment Reviewed',
        message: 'Your assignment has been reviewed. Open the lesson to view feedback and marks.',
        user_id: target.user_id,
        category: 'assignment_reviewed',
        created_at: serverTimestamp(),
      })).catch(() => {});
      await fetchLearning();
      return true;
    } catch (err: any) {
      logger.warn('Failed to review submission:', normalizeFirebaseError(err, 'Failed to review submission'));
      return false;
    }
  }, [fetchLearning, submissions, user?.uid]);

  const getResumeLearning = useCallback((): ResumeLearning | null => {
    try {
      if (lastOpenedLessonId) {
        const lastLesson = lessons.find((lesson) => lesson.id === lastOpenedLessonId);
        if (lastLesson && !lessonProgress[lastLesson.id]?.completed) {
          const module = modules.find((m) => m.id === lastLesson.module_id);
          const course = courses.find((c) => c.id === lastLesson.course_id);
          if (module && course && course.id) {
            return {
              courseId: String(course.id),
              courseName: String(course.name || 'Course'),
              moduleId: String(module.id || ''),
              moduleTitle: String(module.title || 'Module'),
              lessonId: String(lastLesson.id || ''),
              lessonTitle: String(lastLesson.title || 'Lesson'),
            };
          }
        }
      }
      for (const course of courses) {
        if (!course?.id) continue;
        const cModules = getModulesForCourse(course.id);
        for (const module of cModules) {
          if (!module?.id) continue;
          const mLessons = getLessonsForModule(module.id);
          const nextLesson = mLessons.find((lesson) => lesson?.id && !lessonProgress[lesson.id]?.completed);
          if (nextLesson?.id) {
            return {
              courseId: String(course.id),
              courseName: String(course.name || 'Course'),
              moduleId: String(module.id),
              moduleTitle: String(module.title || 'Module'),
              lessonId: String(nextLesson.id),
              lessonTitle: String(nextLesson.title || 'Lesson'),
            };
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  }, [courses, getLessonsForModule, getModulesForCourse, lastOpenedLessonId, lessonProgress, lessons, modules]);

  const getCourseProgress = useCallback((courseId: string): CourseProgressSummary => {
    const courseLessons = lessons.filter((lesson) => lesson.course_id === courseId);
    const totalLessons = courseLessons.length;
    const lessonsDone = courseLessons.filter((lesson) => lessonProgress[lesson.id]?.completed).length;
    const quizzesDone = courseLessons.filter((lesson) => lessonProgress[lesson.id]?.quizCompleted).length;
    const completionPercent = totalLessons === 0 ? 0 : Math.round((lessonsDone / totalLessons) * 100);
    return { totalLessons, lessonsDone, quizzesDone, completionPercent };
  }, [lessons, lessonProgress]);

  useEffect(() => {
    fetchData();
    fetchBooks();
  }, [fetchBooks]);

  useEffect(() => {
    fetchLearning().catch(() => {});
  }, [fetchLearning]);

  return (
    <DataContext.Provider value={{
      courses, teachers, books, loading, booksLoading, error,
      modules, lessons, assignments, submissions, lessonProgress,
      refetch: fetchData, refetchBooks: fetchBooks, refetchLearning: fetchLearning,
      getModulesForCourse, getLessonsForModule, getLessonById, getAssignmentsForLesson,
      getSubmissionForAssignment, getSubmissionsForAssignment,
      markLessonOpened, markLessonComplete, markLessonQuizComplete, submitAssignment, reviewSubmission,
      getResumeLearning, getCourseProgress,
      addBook, deleteBook,
    }}>
      {children}
    </DataContext.Provider>
  );
}
