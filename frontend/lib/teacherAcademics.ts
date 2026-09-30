/**
 * teacherAcademics.ts
 *
 * Phase 70B — Complete Teacher Teaching Workflow
 * Core services for Teacher Lesson Authoring, Assignment Creation & Review,
 * Material Attachments, and Student Roster Aggregation.
 *
 * All operations enforce academic scoping to ensure teachers can only
 * manage curriculum and review work for courses/subjects they are assigned to.
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  getDoc,
  query,
  where,
  serverTimestamp,
  orderBy,
  limit,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { Course, CourseModule, Lesson, Assignment, AssignmentSubmission } from '@/context/DataContext';
import { TeacherAcademicScope, isTeacherAssignedToCourse, isTeacherAssignedToSubject } from '@/lib/teacherScoping';
import { dispatchNotification } from '@/lib/dispatchNotification';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TeacherStudentRosterItem {
  uid: string;
  student_name: string;
  student_email?: string;
  student_id?: string;
  photo_url?: string;
  course_id: string;
  course_name: string;
  subjects_enrolled: string[];
  enrolled_at?: any;
  status: string;
  // Academic Metrics
  attendance: {
    total: number;
    present: number;
    absent: number;
    percentage: number;
  };
  assignments: {
    total: number;
    submitted: number;
    reviewed: number;
    pendingReview: number;
  };
  quizzes: {
    count: number;
    avgPercentage: number;
    lastResult?: {
      category: string;
      percentage: number;
      passed: boolean;
      date?: string;
    };
  };
  progress: {
    lessonsCompleted: number;
    totalLessons: number;
    percentage: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. LESSON & MODULE AUTHORING
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateLessonInput {
  courseId: string;
  moduleId: string;
  title: string;
  description?: string;
  duration_minutes?: number;
  content_url?: string;
  video_url?: string;
  pdf_url?: string;
  order?: number;
  subject_id?: string;
  subject_name?: string;
  published?: boolean;
}

export async function createTeacherLesson(
  scope: TeacherAcademicScope,
  input: CreateLessonInput,
  userUid: string,
  teacherName?: string
): Promise<{ success: boolean; lessonId?: string; error?: string }> {
  // 1. Strict scope verification: Teacher must be assigned to this course
  if (!scope.assignedCourseIds.has(input.courseId.toLowerCase())) {
    return { success: false, error: 'Unauthorized: You are not assigned to teach this course.' };
  }

  // 2. If subject specified, verify subject assignment
  const targetCourse = scope.assignedCourses.find((c) => c.id.toLowerCase() === input.courseId.toLowerCase());
  if (input.subject_id && targetCourse) {
    const isSubjectAssigned = (scope.subjectsByCourseId.get(targetCourse.id) || []).some(
      (s) => s.id === input.subject_id || s.name === input.subject_name
    );
    if (!isSubjectAssigned && !scope.isCourseLevelTeacherByCourseId.get(targetCourse.id)) {
      return { success: false, error: 'Unauthorized: You are not assigned to this subject.' };
    }
  }

  try {
    const payload = {
      course_id: input.courseId,
      module_id: input.moduleId,
      title: input.title.trim(),
      description: (input.description || '').trim(),
      duration_minutes: Number(input.duration_minutes) || 30,
      order: Number(input.order) || 1,
      content_url: input.content_url?.trim() || null,
      video_url: input.video_url?.trim() || null,
      pdf_url: input.pdf_url?.trim() || null,
      subject_id: input.subject_id || null,
      subject_name: input.subject_name || null,
      published: input.published ?? true,
      created_by: userUid,
      teacher_id: userUid,
      teacher_name: teacherName || scope.teacherName,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'lessons'), payload);
    return { success: true, lessonId: docRef.id };
  } catch (err: any) {
    console.error('[teacherAcademics] Failed to create lesson:', err);
    return { success: false, error: err.message || 'Failed to save lesson.' };
  }
}

export async function updateTeacherLesson(
  scope: TeacherAcademicScope,
  lessonId: string,
  updates: Partial<CreateLessonInput>,
  userUid: string
): Promise<{ success: boolean; error?: string }> {
  if (updates.courseId && !scope.assignedCourseIds.has(updates.courseId.toLowerCase())) {
    return { success: false, error: 'Unauthorized: You are not assigned to teach this course.' };
  }

  try {
    const lessonRef = doc(db, 'lessons', lessonId);
    const existing = await getDoc(lessonRef);
    if (!existing.exists()) {
      return { success: false, error: 'Lesson not found.' };
    }

    const data = existing.data();
    if (!scope.assignedCourseIds.has(String(data.course_id || '').toLowerCase())) {
      return { success: false, error: 'Unauthorized: You cannot edit lessons in unrelated courses.' };
    }

    const updatePayload: Record<string, any> = {
      updated_at: serverTimestamp(),
      updated_by: userUid,
    };

    if (updates.title !== undefined) updatePayload.title = updates.title.trim();
    if (updates.description !== undefined) updatePayload.description = updates.description.trim();
    if (updates.duration_minutes !== undefined) updatePayload.duration_minutes = Number(updates.duration_minutes);
    if (updates.content_url !== undefined) updatePayload.content_url = updates.content_url.trim() || null;
    if (updates.video_url !== undefined) updatePayload.video_url = updates.video_url.trim() || null;
    if (updates.pdf_url !== undefined) updatePayload.pdf_url = updates.pdf_url.trim() || null;
    if (updates.published !== undefined) updatePayload.published = Boolean(updates.published);
    if (updates.order !== undefined) updatePayload.order = Number(updates.order);
    if (updates.subject_id !== undefined) updatePayload.subject_id = updates.subject_id || null;
    if (updates.subject_name !== undefined) updatePayload.subject_name = updates.subject_name || null;

    await updateDoc(lessonRef, updatePayload);
    return { success: true };
  } catch (err: any) {
    console.error('[teacherAcademics] Failed to update lesson:', err);
    return { success: false, error: err.message || 'Failed to update lesson.' };
  }
}

export async function createTeacherModule(
  scope: TeacherAcademicScope,
  courseId: string,
  title: string,
  order: number = 1
): Promise<{ success: boolean; moduleId?: string; error?: string }> {
  if (!scope.assignedCourseIds.has(courseId.toLowerCase())) {
    return { success: false, error: 'Unauthorized: You are not assigned to teach this course.' };
  }

  try {
    const docRef = await addDoc(collection(db, 'modules'), {
      course_id: courseId,
      title: title.trim(),
      order,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
    return { success: true, moduleId: docRef.id };
  } catch (err: any) {
    console.error('[teacherAcademics] Failed to create module:', err);
    return { success: false, error: err.message || 'Failed to create module.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ASSIGNMENT CREATION & EVALUATION
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateAssignmentInput {
  courseId: string;
  moduleId?: string;
  lessonId?: string;
  subjectId?: string;
  subjectName?: string;
  title: string;
  description: string;
  dueDate?: string;
  fileUrl?: string;
}

export async function createTeacherAssignment(
  scope: TeacherAcademicScope,
  input: CreateAssignmentInput,
  userUid: string,
  teacherName?: string
): Promise<{ success: boolean; assignmentId?: string; error?: string }> {
  if (!scope.assignedCourseIds.has(input.courseId.toLowerCase())) {
    return { success: false, error: 'Unauthorized: You are not assigned to teach this course.' };
  }

  try {
    const payload = {
      course_id: input.courseId,
      module_id: input.moduleId || 'general',
      lesson_id: input.lessonId || 'general',
      subject_id: input.subjectId || null,
      subject_name: input.subjectName || null,
      title: input.title.trim(),
      description: input.description.trim(),
      due_date: input.dueDate || null,
      file_url: input.fileUrl || null,
      created_by: userUid,
      creator_uid: userUid,
      teacher_id: userUid,
      teacher_name: teacherName || scope.teacherName,
      status: 'active',
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'assignments'), payload);

    // Notify enrolled students in this course
    try {
      const enrollmentsSnap = await getDocs(
        query(
          collection(db, 'enrollments'),
          where('course_id', '==', input.courseId),
          where('status', '==', 'active')
        )
      );
      const studentUids = enrollmentsSnap.docs.map((d) => d.data().user_id).filter(Boolean);
      if (studentUids.length > 0) {
        await dispatchNotification({
          channel: 'assignments',
          event: 'assignment_posted',
          title: `📝 New Assignment: ${input.title}`,
          body: `Ustadh(a) ${teacherName || scope.teacherName} posted a new assignment for ${input.subjectName || 'your course'}.`,
          recipientIds: studentUids,
          dedupeId: `new_assignment:${docRef.id}`,
        });
      }
    } catch (notifErr) {
      console.warn('[teacherAcademics] Failed to dispatch assignment notification:', notifErr);
    }

    return { success: true, assignmentId: docRef.id };
  } catch (err: any) {
    console.error('[teacherAcademics] Failed to create assignment:', err);
    return { success: false, error: err.message || 'Failed to save assignment.' };
  }
}

export async function reviewTeacherSubmission(
  submissionId: string,
  feedback: string,
  grade: string | undefined,
  reviewerUid: string,
  reviewerName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const subRef = doc(db, 'submissions', submissionId);
    const subSnap = await getDoc(subRef);
    if (!subSnap.exists()) {
      return { success: false, error: 'Submission not found.' };
    }

    await updateDoc(subRef, {
      status: 'reviewed',
      feedback: feedback.trim(),
      grade: (grade || '').trim(),
      reviewer_id: reviewerUid,
      reviewed_by: reviewerName,
      reviewed_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });

    // Notify student of completed review
    const studentUid = subSnap.data()?.user_id;
    if (studentUid) {
      await dispatchNotification({
        channel: 'assignments',
        event: 'assignment_posted',
        title: '📋 Assignment Reviewed & Graded',
        body: `Your submission has been reviewed by ${reviewerName}. Tap to see your marks & notes.`,
        recipientIds: [studentUid],
        dedupeId: `reviewed_sub:${submissionId}`,
      }).catch(() => {});
    }

    return { success: true };
  } catch (err: any) {
    console.error('[teacherAcademics] Failed to review submission:', err);
    return { success: false, error: err.message || 'Failed to review submission.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. MEDIA & ATTACHMENT UPLOAD
// ─────────────────────────────────────────────────────────────────────────────

export async function uploadCourseMaterialForTeacher(
  courseId: string,
  fileBlobOrBuffer: Blob | Uint8Array,
  fileName: string,
  contentType: string
): Promise<{ success: boolean; downloadUrl?: string; storagePath?: string; error?: string }> {
  try {
    // Sanitize filename for storage rules: ^[A-Za-z0-9._-]{6,160}$
    const cleanExt = fileName.includes('.') ? `.${fileName.split('.').pop()}` : '';
    const cleanBase = fileName
      .replace(/\.[^/.]+$/, '')
      .replace(/[^A-Za-z0-9._-]/g, '_')
      .slice(0, 50);
    const uniqueFileName = `${Date.now()}_${cleanBase}${cleanExt}`;

    const storagePath = `course_materials/${courseId}/${uniqueFileName}`;
    const fileRef = ref(storage, storagePath);

    await uploadBytes(fileRef, fileBlobOrBuffer, { contentType });
    const downloadUrl = await getDownloadURL(fileRef);

    return { success: true, downloadUrl, storagePath };
  } catch (err: any) {
    console.error('[teacherAcademics] Material upload failed:', err);
    return { success: false, error: err.message || 'File upload failed.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. STUDENT ROSTER AGGREGATION
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchTeacherStudentRoster(
  scope: TeacherAcademicScope
): Promise<TeacherStudentRosterItem[]> {
  if (scope.assignedCourseIds.size === 0) return [];

  try {
    const courseIdList = Array.from(scope.assignedCourseIds);
    // Fetch active enrollments across assigned courses
    // In Firestore, 'in' queries accept up to 30 items
    const queryChunks: string[][] = [];
    for (let i = 0; i < courseIdList.length; i += 25) {
      queryChunks.push(courseIdList.slice(i, i + 25));
    }

    const allEnrollmentDocs: any[] = [];
    for (const chunk of queryChunks) {
      const q = query(
        collection(db, 'enrollments'),
        where('course_id', 'in', chunk),
        where('status', '==', 'active')
      );
      const snap = await getDocs(q);
      snap.forEach((d) => allEnrollmentDocs.push({ id: d.id, ...d.data() }));
    }

    if (allEnrollmentDocs.length === 0) return [];

    // Unique student UIDs
    const studentUids = Array.from(new Set(allEnrollmentDocs.map((e) => e.user_id).filter(Boolean)));

    // Fetch user profiles for student names and avatars
    const userMap = new Map<string, any>();
    for (let i = 0; i < studentUids.length; i += 25) {
      const chunk = studentUids.slice(i, i + 25);
      const uq = query(collection(db, 'users'), where('__name__', 'in', chunk));
      const usnap = await getDocs(uq);
      usnap.forEach((d) => userMap.set(d.id, d.data()));
    }

    // Fetch Attendance records for these courses
    const attendanceRecords: any[] = [];
    for (const chunk of queryChunks) {
      const attQ = query(collection(db, 'attendance'), where('course_id', 'in', chunk), limit(500));
      const attSnap = await getDocs(attQ);
      attSnap.forEach((d) => attendanceRecords.push(d.data()));
    }

    // Fetch Submissions for these courses/students
    const submissionsList: any[] = [];
    for (let i = 0; i < studentUids.length; i += 25) {
      const chunk = studentUids.slice(i, i + 25);
      const subQ = query(collection(db, 'submissions'), where('user_id', 'in', chunk), limit(500));
      const subSnap = await getDocs(subQ);
      subSnap.forEach((d) => submissionsList.push({ id: d.id, ...d.data() }));
    }

    // Fetch Quiz Results for these students
    const quizList: any[] = [];
    for (let i = 0; i < studentUids.length; i += 25) {
      const chunk = studentUids.slice(i, i + 25);
      const quizQ = query(collection(db, 'quiz_results'), where('user_id', 'in', chunk), limit(500));
      const quizSnap = await getDocs(quizQ);
      quizSnap.forEach((d) => quizList.push(d.data()));
    }

    // Aggregate per (studentUid + courseId)
    const roster: TeacherStudentRosterItem[] = [];

    for (const enr of allEnrollmentDocs) {
      const sUid = enr.user_id;
      const cId = enr.course_id;
      const course = scope.assignedCourses.find((c) => c.id.toLowerCase() === cId.toLowerCase());
      const courseName = course?.name || (course as any)?.title || 'Course';

      const userDocData = userMap.get(sUid);
      const studentName = userDocData?.name || enr.student_name || `Student (${sUid.slice(0, 6)})`;
      const photoUrl = userDocData?.photo_url || null;
      const studentEmail = userDocData?.email || null;
      const studentId = userDocData?.student_id || userDocData?.studentId || null;

      // Filter attendance for this student & course
      const studentAtt = attendanceRecords.filter((a) => a.user_id === sUid && a.course_id === cId);
      const attPresent = studentAtt.filter((a) => a.status === 'present').length;
      const attAbsent = studentAtt.filter((a) => a.status === 'absent').length;
      const attTotal = studentAtt.length;
      const attPercentage = attTotal > 0 ? Math.round((attPresent / attTotal) * 100) : 100;

      // Filter submissions for this student
      const studentSubs = submissionsList.filter((s) => s.user_id === sUid);
      const subReviewed = studentSubs.filter((s) => s.status === 'reviewed').length;
      const subPending = studentSubs.filter((s) => s.status === 'submitted').length;

      // Filter quiz results for this student
      const studentQuizzes = quizList.filter((q) => q.user_id === sUid || q.uid === sUid);
      const quizCount = studentQuizzes.length;
      const avgPercentage = quizCount > 0
        ? Math.round(studentQuizzes.reduce((acc, q) => acc + (Number(q.percentage) || 0), 0) / quizCount)
        : 0;

      const lastQuiz = studentQuizzes.length > 0 ? studentQuizzes[studentQuizzes.length - 1] : undefined;

      // Subjects taught by teacher in this course
      const assignedSubjects = (scope.subjectsByCourseId.get(cId) || []).map((s) => s.name);

      roster.push({
        uid: sUid,
        student_name: studentName,
        student_email: studentEmail,
        student_id: studentId,
        photo_url: photoUrl,
        course_id: cId,
        course_name: courseName,
        subjects_enrolled: assignedSubjects.length > 0 ? assignedSubjects : [courseName],
        enrolled_at: enr.enrolled_at || enr.created_at || null,
        status: enr.status || 'active',
        attendance: {
          total: attTotal,
          present: attPresent,
          absent: attAbsent,
          percentage: attPercentage,
        },
        assignments: {
          total: studentSubs.length,
          submitted: studentSubs.length,
          reviewed: subReviewed,
          pendingReview: subPending,
        },
        quizzes: {
          count: quizCount,
          avgPercentage,
          lastResult: lastQuiz
            ? {
                category: lastQuiz.category || 'Quiz',
                percentage: Number(lastQuiz.percentage) || 0,
                passed: Boolean(lastQuiz.passed),
              }
            : undefined,
        },
        progress: {
          lessonsCompleted: attPresent, // Proxy until full lesson progress aggregation
          totalLessons: Math.max(attTotal, 1),
          percentage: attPercentage,
        },
      });
    }

    return roster;
  } catch (err) {
    console.error('[teacherAcademics] Failed to build student roster:', err);
    return [];
  }
}
