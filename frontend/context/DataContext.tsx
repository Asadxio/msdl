/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  setDoc,
  query,
  where,
  limit,
  orderBy,
  startAfter,
  documentId,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { normalizeFirebaseError, withTimeout } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { dispatchNotification } from '@/lib/dispatchNotification';
import { createRoleNotification } from '@/lib/notifications';
import { cacheGet, cacheSet } from '@/lib/cacheManager';
import { perfStart, perfEnd } from '@/lib/performanceMonitor';

const QUERY_CHUNK = 25;

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

type QueryCursor = { order: number; id: string } | null;

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
  courseContentLoading: Record<string, boolean>;
  courseContentError: Record<string, string>;
  hasMoreModulesByCourse: Record<string, boolean>;
  hasMoreLessonsByModule: Record<string, boolean>;
  hasMoreAssignmentsByLesson: Record<string, boolean>;
  refetch: () => void;
  refetchBooks: () => Promise<boolean>;
  refetchLearning: () => Promise<void>;
  fetchCourseModules: (courseId: string) => Promise<void>;
  fetchMoreCourseModules: (courseId: string) => Promise<void>;
  fetchLessonsForModule: (moduleId: string) => Promise<void>;
  fetchMoreLessonsForModule: (moduleId: string) => Promise<void>;
  fetchAssignmentsForLesson: (lessonId: string) => Promise<void>;
  fetchMoreAssignmentsForLesson: (lessonId: string) => Promise<void>;
  fetchSubmissionsForAssignment: (assignmentId: string) => Promise<void>;
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

const COURSES_CACHE_KEY = 'courses_cache_v1';
const TEACHERS_CACHE_KEY = 'teachers_cache_v1';
const COURSE_MODULES_CACHE_TTL_MS = 60 * 60 * 1000;
const MODULE_LESSONS_CACHE_TTL_MS = 60 * 60 * 1000;
const LESSON_ASSIGNMENTS_CACHE_TTL_MS = 60 * 60 * 1000;
const ASSIGNMENT_SUBMISSIONS_CACHE_TTL_MS = 60 * 60 * 1000;
const COURSE_CACHE_TTL_MS = 60 * 60 * 1000;

function getCourseModulesCacheKey(courseId: string) {
  return `course_modules_${courseId}`;
}

function getModuleLessonsCacheKey(moduleId: string) {
  return `module_lessons_${moduleId}`;
}

function getLessonAssignmentsCacheKey(lessonId: string) {
  return `lesson_assignments_${lessonId}`;
}

function getAssignmentSubmissionsCacheKey(assignmentId: string) {
  return `assignment_submissions_${assignmentId}`;
}

function mergeUniqueById<T extends { id: string }>(existing: T[], incoming: T[]) {
  const map = new Map(existing.map((item) => [item.id, item]));
  incoming.forEach((item) => map.set(item.id, item));
  return Array.from(map.values());
}

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
  courseContentLoading: {},
  courseContentError: {},
  hasMoreModulesByCourse: {},
  hasMoreLessonsByModule: {},
  hasMoreAssignmentsByLesson: {},
  refetch: () => {},
  refetchBooks: async () => false,
  refetchLearning: async () => {},
  fetchCourseModules: async () => {},
  fetchMoreCourseModules: async () => {},
  fetchLessonsForModule: async () => {},
  fetchMoreLessonsForModule: async () => {},
  fetchAssignmentsForLesson: async () => {},
  fetchMoreAssignmentsForLesson: async () => {},
  fetchSubmissionsForAssignment: async () => {},
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

export function useData() {
  return useContext(DataContext);
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { profile, user, authLoading } = useAuth();
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
  const [courseContentLoading, setCourseContentLoading] = useState<Record<string, boolean>>({});
  const [courseContentError, setCourseContentError] = useState<Record<string, string>>({});
  const [hasMoreModulesByCourse, setHasMoreModulesByCourse] = useState<Record<string, boolean>>({});
  const [hasMoreLessonsByModule, setHasMoreLessonsByModule] = useState<Record<string, boolean>>({});
  const [hasMoreAssignmentsByLesson, setHasMoreAssignmentsByLesson] = useState<Record<string, boolean>>({});
  const [moduleCursorByCourse, setModuleCursorByCourse] = useState<Record<string, QueryCursor>>({});
  const [lessonCursorByModule, setLessonCursorByModule] = useState<Record<string, QueryCursor>>({});
  const [assignmentCursorByLesson, setAssignmentCursorByLesson] = useState<Record<string, QueryCursor>>({});

  const fetchBooks = useCallback(async (): Promise<boolean> => {
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
      return true;
    } catch (err: unknown) {
      logger.warn('Failed to fetch books:', normalizeFirebaseError(err, 'Failed to fetch books'));
      setBooks([]);
      return false;
    } finally {
      setBooksLoading(false);
    }
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const t0 = perfStart('data.fetchData');
      const [cachedCourses, cachedTeachers] = await Promise.all([
        cacheGet<Course[]>(COURSES_CACHE_KEY),
        cacheGet<Teacher[]>(TEACHERS_CACHE_KEY),
      ]);
      if (cachedCourses?.length) setCourses(cachedCourses);
      if (cachedTeachers?.length) setTeachers(cachedTeachers);

      const [coursesSnap, teachersSnap] = await Promise.all([
        withTimeout(getDocs(collection(db, 'courses'))),
        withTimeout(getDocs(collection(db, 'teachers'))),
      ]);
      const coursesData: Course[] = [];
      const courseIdsSeen = new Set<string>();
      coursesSnap.forEach((doc) => {
        if (courseIdsSeen.has(doc.id)) return;
        courseIdsSeen.add(doc.id);
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

      setCourses(coursesData);
      setTeachers(teachersData);
      await cacheSet(COURSES_CACHE_KEY, coursesData, COURSE_CACHE_TTL_MS).catch(() => {});
      await cacheSet(TEACHERS_CACHE_KEY, teachersData, COURSE_CACHE_TTL_MS).catch(() => {});
      perfEnd('data.fetchData', t0, { courses: coursesData.length, teachers: teachersData.length });
    } catch (err: unknown) {
      logger.warn('Firebase fetch failed, using local data:', normalizeFirebaseError(err, 'Failed to fetch data'));
      setError(normalizeFirebaseError(err, 'Failed to fetch data'));
      const cachedCourses = await cacheGet<Course[]>(COURSES_CACHE_KEY).catch(() => null);
      const cachedTeachers = await cacheGet<Teacher[]>(TEACHERS_CACHE_KEY).catch(() => null);
      setCourses(Array.isArray(cachedCourses) ? cachedCourses : []);
      setTeachers(Array.isArray(cachedTeachers) ? cachedTeachers : []);
    } finally {
      setLoading(false);
    }
  };

  function cursorFromItems(items: { order: number; id: string }[]): QueryCursor {
    if (!items.length) return null;
    const last = items[items.length - 1];
    return { order: Number(last.order || 0), id: String(last.id) };
  }

  function cursorFromIdItems(items: { id: string }[]): QueryCursor {
    if (!items.length) return null;
    const last = items[items.length - 1];
    return { order: 0, id: String(last.id) };
  }

  function buildCourseModule(docItem: any): CourseModule {
    const data = docItem.data() as any;
    return {
      id: docItem.id,
      course_id: String(data.course_id || ''),
      title: String(data.title || 'Module'),
      order: Number(data.order || 0),
    };
  }

  function buildLesson(docItem: any): Lesson {
    const data = docItem.data() as any;
    return {
      id: docItem.id,
      course_id: String(data.course_id || ''),
      module_id: String(data.module_id || ''),
      title: String(data.title || 'Lesson'),
      order: Number(data.order || 0),
      description: data.description ? String(data.description) : '',
      duration_minutes: data.duration_minutes != null ? Number(data.duration_minutes) : undefined,
      content_url: data.content_url ? String(data.content_url) : undefined,
      video_url: data.video_url ? String(data.video_url) : undefined,
      pdf_url: data.pdf_url ? String(data.pdf_url) : undefined,
      quiz_id: data.quiz_id ? String(data.quiz_id) : undefined,
      resources: Array.isArray(data.resources) ? data.resources : undefined,
    };
  }

  function buildAssignment(docItem: any): Assignment {
    const data = docItem.data() as any;
    return {
      id: docItem.id,
      lesson_id: String(data.lesson_id || ''),
      module_id: String(data.module_id || ''),
      course_id: String(data.course_id || ''),
      title: String(data.title || 'Assignment'),
      description: String(data.description || ''),
      due_date: data.due_date ? String(data.due_date) : undefined,
      file_url: data.file_url ? String(data.file_url) : undefined,
    };
  }

  function buildSubmission(docItem: any): AssignmentSubmission {
    const data = docItem.data() as any;
    return {
      id: docItem.id,
      user_id: String(data.user_id || ''),
      assignment_id: String(data.assignment_id || ''),
      file_url: data.file_url ? String(data.file_url) : undefined,
      text_answer: data.text_answer ? String(data.text_answer) : undefined,
      status: data.status === 'reviewed' ? 'reviewed' : 'submitted',
      feedback: data.feedback ? String(data.feedback) : undefined,
      grade: data.grade ? String(data.grade) : undefined,
      created_at: data.created_at || null,
      reviewed_at: data.reviewed_at || null,
      reviewer_id: data.reviewer_id ? String(data.reviewer_id) : undefined,
    };
  }

  async function loadCourseModules(courseId: string, append = false): Promise<void> {
    const contentKey = `courseModules:${courseId}`;
    setCourseContentLoading((prev) => ({ ...prev, [contentKey]: true }));
    setCourseContentError((prev) => ({ ...prev, [contentKey]: '' }));

    try {
      const existingModules = modules.filter((module) => module.course_id === courseId).sort((a, b) => a.order - b.order);
      if (!append) {
        const cachedModules = await cacheGet<CourseModule[]>(getCourseModulesCacheKey(courseId));
        if (cachedModules?.length) {
          setModules((prev) => mergeUniqueById(prev.filter((m) => m.course_id !== courseId), cachedModules));
          setHasMoreModulesByCourse((prev) => ({ ...prev, [courseId]: cachedModules.length >= QUERY_CHUNK }));
          setModuleCursorByCourse((prev) => ({ ...prev, [courseId]: cursorFromItems(cachedModules) }));
          return;
        }
      }

      const cursor = append
        ? moduleCursorByCourse[courseId] || cursorFromItems(existingModules)
        : null;

      let modulesQuery = query(
        collection(db, 'modules'),
        where('course_id', '==', courseId),
        orderBy('order', 'asc'),
        orderBy(documentId(), 'asc'),
        limit(QUERY_CHUNK),
      );
      if (cursor) modulesQuery = query(modulesQuery, startAfter(cursor.order, cursor.id));

      const moduleSnap = await withTimeout(getDocs(modulesQuery));
      const nextModules = moduleSnap.docs.map(buildCourseModule);
      setModules((prev) => {
        const filtered = append ? prev : prev.filter((module) => module.course_id !== courseId);
        return mergeUniqueById(filtered, nextModules);
      });
      setModuleCursorByCourse((prev) => ({ ...prev, [courseId]: cursorFromItems(nextModules) }));
      setHasMoreModulesByCourse((prev) => ({ ...prev, [courseId]: nextModules.length === QUERY_CHUNK }));
      if (!append) {
        await cacheSet(getCourseModulesCacheKey(courseId), nextModules, COURSE_MODULES_CACHE_TTL_MS).catch(() => {});
      }
    } catch (err: unknown) {
      setCourseContentError((prev) => ({ ...prev, [contentKey]: normalizeFirebaseError(err, 'Failed to fetch course modules') }));
    } finally {
      setCourseContentLoading((prev) => ({ ...prev, [contentKey]: false }));
    }
  }

  async function loadLessonsForModule(moduleId: string, append = false): Promise<void> {
    const contentKey = `moduleLessons:${moduleId}`;
    setCourseContentLoading((prev) => ({ ...prev, [contentKey]: true }));
    setCourseContentError((prev) => ({ ...prev, [contentKey]: '' }));

    try {
      const existingLessons = lessons.filter((lesson) => lesson.module_id === moduleId).sort((a, b) => a.order - b.order);
      if (!append) {
        const cachedLessons = await cacheGet<Lesson[]>(getModuleLessonsCacheKey(moduleId));
        if (cachedLessons?.length) {
          setLessons((prev) => mergeUniqueById(prev.filter((lesson) => lesson.module_id !== moduleId), cachedLessons));
          setHasMoreLessonsByModule((prev) => ({ ...prev, [moduleId]: cachedLessons.length >= QUERY_CHUNK }));
          setLessonCursorByModule((prev) => ({ ...prev, [moduleId]: cursorFromItems(cachedLessons) }));
          return;
        }
      }

      const cursor = append
        ? lessonCursorByModule[moduleId] || cursorFromItems(existingLessons)
        : null;

      let lessonsQuery = query(
        collection(db, 'lessons'),
        where('module_id', '==', moduleId),
        orderBy('order', 'asc'),
        orderBy(documentId(), 'asc'),
        limit(QUERY_CHUNK),
      );
      if (cursor) lessonsQuery = query(lessonsQuery, startAfter(cursor.order, cursor.id));

      const lessonSnap = await withTimeout(getDocs(lessonsQuery));
      const nextLessons = lessonSnap.docs.map(buildLesson);
      setLessons((prev) => {
        const filtered = append ? prev : prev.filter((lesson) => lesson.module_id !== moduleId);
        return mergeUniqueById(filtered, nextLessons);
      });
      setLessonCursorByModule((prev) => ({ ...prev, [moduleId]: cursorFromItems(nextLessons) }));
      setHasMoreLessonsByModule((prev) => ({ ...prev, [moduleId]: nextLessons.length === QUERY_CHUNK }));
      if (!append) {
        await cacheSet(getModuleLessonsCacheKey(moduleId), nextLessons, MODULE_LESSONS_CACHE_TTL_MS).catch(() => {});
      }
    } catch (err: unknown) {
      setCourseContentError((prev) => ({ ...prev, [contentKey]: normalizeFirebaseError(err, 'Failed to fetch module lessons') }));
    } finally {
      setCourseContentLoading((prev) => ({ ...prev, [contentKey]: false }));
    }
  }

  async function loadAssignmentsForLesson(lessonId: string, append = false): Promise<void> {
    const contentKey = `lessonAssignments:${lessonId}`;
    setCourseContentLoading((prev) => ({ ...prev, [contentKey]: true }));
    setCourseContentError((prev) => ({ ...prev, [contentKey]: '' }));

    try {
      const existingAssignments = assignments.filter((assignment) => assignment.lesson_id === lessonId);
      if (!append) {
        const cachedAssignments = await cacheGet<Assignment[]>(getLessonAssignmentsCacheKey(lessonId));
        if (cachedAssignments?.length) {
          setAssignments((prev) => mergeUniqueById(prev.filter((assignment) => assignment.lesson_id !== lessonId), cachedAssignments));
          setHasMoreAssignmentsByLesson((prev) => ({ ...prev, [lessonId]: cachedAssignments.length >= QUERY_CHUNK }));
          setAssignmentCursorByLesson((prev) => ({ ...prev, [lessonId]: cursorFromIdItems(cachedAssignments) }));
          return;
        }
      }

      const cursor = append
        ? assignmentCursorByLesson[lessonId] || (existingAssignments.length ? { order: 0, id: existingAssignments[existingAssignments.length - 1].id } : null)
        : null;

      let assignmentQuery = query(
        collection(db, 'assignments'),
        where('lesson_id', '==', lessonId),
        orderBy(documentId(), 'asc'),
        limit(QUERY_CHUNK),
      );
      if (cursor) assignmentQuery = query(assignmentQuery, startAfter(cursor.id));

      const assignmentSnap = await withTimeout(getDocs(assignmentQuery));
      const nextAssignments = assignmentSnap.docs.map(buildAssignment);
      setAssignments((prev) => {
        const filtered = append ? prev : prev.filter((assignment) => assignment.lesson_id !== lessonId);
        return mergeUniqueById(filtered, nextAssignments);
      });
      setAssignmentCursorByLesson((prev) => ({ ...prev, [lessonId]: nextAssignments.length ? { order: 0, id: nextAssignments[nextAssignments.length - 1].id } : null }));
      setHasMoreAssignmentsByLesson((prev) => ({ ...prev, [lessonId]: nextAssignments.length === QUERY_CHUNK }));
      if (!append) {
        await cacheSet(getLessonAssignmentsCacheKey(lessonId), nextAssignments, LESSON_ASSIGNMENTS_CACHE_TTL_MS).catch(() => {});
      }
    } catch (err: unknown) {
      setCourseContentError((prev) => ({ ...prev, [contentKey]: normalizeFirebaseError(err, 'Failed to fetch lesson assignments') }));
    } finally {
      setCourseContentLoading((prev) => ({ ...prev, [contentKey]: false }));
    }
  }

  async function loadSubmissionsForAssignment(assignmentId: string): Promise<void> {
    const contentKey = `assignmentSubmissions:${assignmentId}`;
    setCourseContentLoading((prev) => ({ ...prev, [contentKey]: true }));
    setCourseContentError((prev) => ({ ...prev, [contentKey]: '' }));

    try {
      if (!assignmentId) {
        throw new Error('Invalid assignment id');
      }

      const cachedSubmissions = await cacheGet<AssignmentSubmission[]>(getAssignmentSubmissionsCacheKey(assignmentId));
      if (cachedSubmissions?.length) {
        setSubmissions((prev) => mergeUniqueById(prev.filter((submission) => submission.assignment_id !== assignmentId), cachedSubmissions));
        setCourseContentError((prev) => ({ ...prev, [assignmentId]: '' }));
        return;
      }

      const submissionsQuery = query(
        collection(db, 'submissions'),
        where('assignment_id', '==', assignmentId),
        orderBy(documentId(), 'asc'),
        limit(200),
      );
      const submissionSnap = await withTimeout(getDocs(submissionsQuery));
      const nextSubmissions = submissionSnap.docs.map(buildSubmission);
      setSubmissions((prev) => mergeUniqueById(prev.filter((submission) => submission.assignment_id !== assignmentId), nextSubmissions));
      await cacheSet(getAssignmentSubmissionsCacheKey(assignmentId), nextSubmissions, ASSIGNMENT_SUBMISSIONS_CACHE_TTL_MS).catch(() => {});
      setCourseContentError((prev) => ({ ...prev, [assignmentId]: '' }));
    } catch (err: unknown) {
      setCourseContentError((prev) => ({ ...prev, [contentKey]: normalizeFirebaseError(err, 'Failed to fetch submissions') }));
    } finally {
      setCourseContentLoading((prev) => ({ ...prev, [contentKey]: false }));
    }
  }

  const fetchCourseModules = useCallback((courseId: string) => loadCourseModules(courseId, false), [modules]);
  const fetchMoreCourseModules = useCallback((courseId: string) => loadCourseModules(courseId, true), [modules, moduleCursorByCourse]);
  const fetchLessonsForModule = useCallback((moduleId: string) => loadLessonsForModule(moduleId, false), [lessons]);
  const fetchMoreLessonsForModule = useCallback((moduleId: string) => loadLessonsForModule(moduleId, true), [lessons, lessonCursorByModule]);
  const fetchAssignmentsForLesson = useCallback((lessonId: string) => loadAssignmentsForLesson(lessonId, false), [assignments]);
  const fetchMoreAssignmentsForLesson = useCallback((lessonId: string) => loadAssignmentsForLesson(lessonId, true), [assignments, assignmentCursorByLesson]);

  const fetchSubmissionsForAssignment = useCallback((assignmentId: string) => loadSubmissionsForAssignment(assignmentId), []);

  const fetchLearning = useCallback(async () => {
    if (!user?.uid) {
      setModules([]);
      setLessons([]);
      setAssignments([]);
      setSubmissions([]);
      setLessonProgress({});
      setLastOpenedLessonId(null);
      return;
    }

    try {
      const progressQuery = query(collection(db, 'lesson_progress'), where('user_id', '==', user.uid));
      const canReviewSubmissions = profile?.role === 'teacher' || profile?.role === 'admin';
      const submissionsQuery = canReviewSubmissions
        ? collection(db, 'submissions')
        : query(collection(db, 'submissions'), where('user_id', '==', user.uid));

      const [progressSnap, submissionSnap, learningStateSnap] = await Promise.all([
        withTimeout(getDocs(progressQuery)),
        withTimeout(getDocs(submissionsQuery)),
        withTimeout(getDoc(doc(db, 'learning_state', user.uid))),
      ]);

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

      setLessonProgress(nextProgress);
      setSubmissions(nextSubmissions);
    } catch (err: any) {
      logger.warn('Failed to fetch structured learning:', normalizeFirebaseError(err, 'Failed to fetch learning'));
      setSubmissions([]);
      setLessonProgress({});
      setLastOpenedLessonId(null);
    }
  }, [profile?.role, user?.uid]);

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
    // Optimistic update so UI reflects completion immediately
    setLessonProgress((prev) => ({
      ...prev,
      [lesson.id]: {
        completed: true,
        quizCompleted: true,
        lastOpenedAt: prev[lesson.id]?.lastOpenedAt,
      },
    }));
    try {
      await withTimeout(setDoc(doc(db, 'lesson_progress', `${user.uid}_${lesson.id}`), {
        user_id: user.uid,
        course_id: lesson.course_id,
        module_id: lesson.module_id,
        lesson_id: lesson.id,
        completed: true,
        quiz_completed: true,
        updated_at: serverTimestamp(),
      }, { merge: true }), 15000);
      return true;
    } catch (err: any) {
      logger.warn('Failed to save lesson quiz immediately (queued offline):', normalizeFirebaseError(err, 'Failed to save lesson quiz'));
      return true;
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
      await dispatchNotification({
        channel: 'assignments',
        event: 'assignment_posted',
        title: 'Assignment Reviewed',
        body: 'Your assignment has been reviewed. Open the lesson to view feedback and marks.',
        recipientIds: [target.user_id],
        dedupeId: `assignment_reviewed:${params.submissionId}`,
      }).catch(() => {});
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
    if (authLoading || !user) return;
    fetchData();
    fetchBooks();
  }, [authLoading, user, fetchBooks]);

  useEffect(() => {
    fetchLearning().catch(() => {});
  }, [fetchLearning]);

  const contextValue = useMemo(() => ({
    courses, teachers, books, loading, booksLoading, error,
    modules, lessons, assignments, submissions, lessonProgress,
    courseContentLoading, courseContentError,
    hasMoreModulesByCourse, hasMoreLessonsByModule, hasMoreAssignmentsByLesson,
    refetch: fetchData, refetchBooks: fetchBooks, refetchLearning: fetchLearning,
    fetchCourseModules, fetchMoreCourseModules,
    fetchLessonsForModule, fetchMoreLessonsForModule,
    fetchAssignmentsForLesson, fetchMoreAssignmentsForLesson,
    fetchSubmissionsForAssignment,
    getModulesForCourse, getLessonsForModule, getLessonById, getAssignmentsForLesson,
    getSubmissionForAssignment, getSubmissionsForAssignment,
    markLessonOpened, markLessonComplete, markLessonQuizComplete, submitAssignment, reviewSubmission,
    getResumeLearning, getCourseProgress,
    addBook, deleteBook,
  }), [
    courses, teachers, books, loading, booksLoading, error,
    modules, lessons, assignments, submissions, lessonProgress,
    courseContentLoading, courseContentError,
    hasMoreModulesByCourse, hasMoreLessonsByModule, hasMoreAssignmentsByLesson,
    fetchData, fetchBooks, fetchLearning,
    fetchCourseModules, fetchMoreCourseModules,
    fetchLessonsForModule, fetchMoreLessonsForModule,
    fetchAssignmentsForLesson, fetchMoreAssignmentsForLesson,
    fetchSubmissionsForAssignment,
    getModulesForCourse, getLessonsForModule, getLessonById, getAssignmentsForLesson,
    getSubmissionForAssignment, getSubmissionsForAssignment,
    markLessonOpened, markLessonComplete, markLessonQuizComplete, submitAssignment, reviewSubmission,
    getResumeLearning, getCourseProgress,
    addBook, deleteBook,
  ]);

  return (
    <DataContext.Provider value={contextValue}>
      {children}
    </DataContext.Provider>
  );
}
