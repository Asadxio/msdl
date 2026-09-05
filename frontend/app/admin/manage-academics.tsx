import { ScreenRefreshControl } from "@/components/ui";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, StatusBar, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { goBackOrReplace } from '@/lib/navigation';
import {
  addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, updateDoc, setDoc, getCountFromServer, query, where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLORS, SPACING, RADIUS, SHADOWS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { createNotificationAsAdmin, createRoleNotificationAsAdmin } from '@/lib/notifications';
import { isValidHttpsUrl, normalizeMeetUrl } from '@/lib/links';
import { createAdminLog } from '@/lib/adminLogs';
import { hasPermission } from '@/lib/rbac';
import { logFirestoreFailure } from '@/lib/firestoreDebug';
import { getEnrollmentDocId } from '@/lib/enrollments';

export type CourseSubject = {
  id: string;
  name: string;
  teacher_id?: string;
  teacher_name?: string;
  schedule?: string;
};

type CourseItem = {
  id: string;
  name: string;
  teacher_name: string;
  teacher_id?: string;
  schedule: string;
  class_time?: string;
  meet_link: string;
  description: string;
  subjects?: CourseSubject[];
};

type TeacherItem = {
  id: string;
  name: string;
  title: string;
  photo_url?: string;
  assigned_courses: string[];
};

type LessonItem = {
  id: string;
  title: string;
  course_id: string;
  module_id: string;
};

type RecordingItem = {
  id: string;
  title: string;
  description: string;
  file_url: string;
  course_id: string;
  lesson_id?: string;
};

type StudentOption = {
  uid: string;
  name: string;
  email: string;
};

type RosterItem = {
  id: string;
  user_id: string;
  course_id: string;
  status: string;
  student_name?: string;
  student_email?: string;
};

const INITIAL_COURSE: Omit<CourseItem, 'id'> = {
  name: '',
  teacher_name: '',
  teacher_id: '',
  schedule: '',
  class_time: '',
  meet_link: '',
  description: '',
  subjects: [],
};

export default function ManageAcademicsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useAuth();
  const isAdmin = hasPermission(profile, 'admin.academics.manage');

  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseForm, setCourseForm] = useState(INITIAL_COURSE);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  
  // Subject drafting in course form
  const [subjectDraftName, setSubjectDraftName] = useState('');
  const [subjectDraftTeacherId, setSubjectDraftTeacherId] = useState('');
  const [subjectDraftSchedule, setSubjectDraftSchedule] = useState('');

  // Teacher management state
  const [teacherName, setTeacherName] = useState('');
  const [teacherTitle, setTeacherTitle] = useState('');
  const [teacherPhoto, setTeacherPhoto] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  
  // Recording state
  const [recordingTitle, setRecordingTitle] = useState('');
  const [recordingDescription, setRecordingDescription] = useState('');
  const [recordingUrl, setRecordingUrl] = useState('');
  const [recordingCourseId, setRecordingCourseId] = useState('');
  const [recordingLessonId, setRecordingLessonId] = useState('');
  const [recordings, setRecordings] = useState<RecordingItem[]>([]);
  const [lessons, setLessons] = useState<LessonItem[]>([]);
  const [editingRecordingId, setEditingRecordingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [studentCount, setStudentCount] = useState<number>(0);

  // Student Roster and Class Enrollment State
  const [selectedRosterCourseId, setSelectedRosterCourseId] = useState<string>('');
  const [rosterList, setRosterList] = useState<RosterItem[]>([]);
  const [availableStudents, setAvailableStudents] = useState<StudentOption[]>([]);
  const [selectedStudentToEnroll, setSelectedStudentToEnroll] = useState<string>('');
  const [rosterLoading, setRosterLoading] = useState(false);

  const courseNames = useMemo(() => courses.map((c) => c.name).filter(Boolean), [courses]);
  const lessonOptions = useMemo(
    () => lessons.filter((lesson) => lesson.course_id === recordingCourseId),
    [lessons, recordingCourseId],
  );

  const avgContentPerCourse = useMemo(() => {
    if (courses.length === 0) return '0.0';
    return ((lessons.length + recordings.length) / courses.length).toFixed(1);
  }, [courses.length, lessons.length, recordings.length]);

  const fetchData = useCallback(async () => {
    if (courses.length === 0) setLoading(true);
    try {
      const [courseSnap, teacherSnap, lessonSnap, recordingSnap, studentsCountSnap, usersSnap] = await Promise.all([
        getDocs(collection(db, 'courses')),
        getDocs(collection(db, 'teachers')),
        getDocs(collection(db, 'lessons')),
        getDocs(collection(db, 'recordings')),
        getCountFromServer(query(collection(db, 'users'), where('role', '==', 'student'))).catch(() => ({ data: () => ({ count: 0 }) })),
        getDocs(query(collection(db, 'users'), where('role', '==', 'student'))).catch(() => null),
      ]);

      const nextCourses: CourseItem[] = [];
      courseSnap.forEach((d) => {
        const data = d.data();
        const rawSubjects = Array.isArray(data.subjects) ? data.subjects : undefined;
        nextCourses.push({
          id: d.id,
          name: data.name || '',
          teacher_name: data.teacher_name || data.teacherName || '',
          teacher_id: data.teacher_id ? String(data.teacher_id) : undefined,
          schedule: data.schedule || '',
          class_time: data.class_time || data.time || '',
          meet_link: data.meet_link || data.class_link || data.classLink || '',
          description: data.description || '',
          subjects: rawSubjects,
        });
      });

      const nextTeachers: TeacherItem[] = [];
      teacherSnap.forEach((d) => {
        const data = d.data();
        nextTeachers.push({
          id: d.id,
          name: data.name || '',
          title: data.title || '',
          photo_url: data.photo_url || '',
          assigned_courses: Array.isArray(data.assigned_courses) ? data.assigned_courses : (Array.isArray(data.courses) ? data.courses : []),
        });
      });

      const nextLessons: LessonItem[] = [];
      lessonSnap.forEach((d) => {
        const data = d.data();
        nextLessons.push({
          id: d.id,
          title: data.title || 'Lesson',
          course_id: data.course_id || '',
          module_id: data.module_id || '',
        });
      });

      const nextRecordings: RecordingItem[] = [];
      recordingSnap.forEach((d) => {
        const data = d.data();
        nextRecordings.push({
          id: d.id,
          title: data.title || '',
          description: data.description || '',
          file_url: data.file_url || '',
          course_id: data.course_id || '',
          lesson_id: data.lesson_id || '',
        });
      });

      const studentOpts: StudentOption[] = [];
      if (usersSnap) {
        usersSnap.forEach((d) => {
          const u = d.data();
          studentOpts.push({
            uid: d.id,
            name: u.name || u.displayName || u.email || 'Student',
            email: u.email || '',
          });
        });
      }

      setCourses(nextCourses);
      setTeachers(nextTeachers);
      setLessons(nextLessons);
      setRecordings(nextRecordings);
      setStudentCount(studentsCountSnap.data().count || 0);
      setAvailableStudents(studentOpts);
      setLoadError('');
    } catch (error: unknown) {
      logFirestoreFailure({ collection: 'courses/teachers/lessons/recordings', operation: 'get', query: 'get all courses, teachers, lessons, recordings', role: profile?.role, status: profile?.status }, error);
      setLoadError('Could not load academic data. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [courses.length, profile?.role, profile?.status]);

  // Fetch student roster for a course
  const fetchRoster = useCallback(async (courseId: string) => {
    if (!courseId) {
      setRosterList([]);
      return;
    }
    setRosterLoading(true);
    try {
      const q = query(
        collection(db, 'enrollments'),
        where('course_id', '==', courseId),
        where('status', '==', 'active')
      );
      const snap = await getDocs(q);
      const list: RosterItem[] = [];
      snap.forEach((d) => {
        const data = d.data();
        const studentInfo = availableStudents.find((s) => s.uid === data.user_id);
        list.push({
          id: d.id,
          user_id: data.user_id,
          course_id: data.course_id,
          status: data.status,
          student_name: studentInfo?.name || data.user_name || 'Enrolled Student',
          student_email: studentInfo?.email || data.user_email || '',
        });
      });
      setRosterList(list);
    } catch (err) {
      console.warn('Failed to load roster:', err);
      setRosterList([]);
    } finally {
      setRosterLoading(false);
    }
  }, [availableStudents]);

  useEffect(() => {
    if (selectedRosterCourseId) {
      fetchRoster(selectedRosterCourseId);
    }
  }, [selectedRosterCourseId, fetchRoster]);

  const enrollStudentInCourse = async () => {
    if (!selectedRosterCourseId) {
      Alert.alert('Select Class', 'Please choose a class/course first.');
      return;
    }
    if (!selectedStudentToEnroll) {
      Alert.alert('Select Student', 'Please select a student to enroll.');
      return;
    }
    try {
      setActionLoading(true);
      const enrollmentDocId = getEnrollmentDocId(selectedStudentToEnroll, selectedRosterCourseId);
      const studentObj = availableStudents.find((s) => s.uid === selectedStudentToEnroll);
      const courseObj = courses.find((c) => c.id === selectedRosterCourseId);
      
      await setDoc(doc(db, 'enrollments', enrollmentDocId), {
        user_id: selectedStudentToEnroll,
        course_id: selectedRosterCourseId,
        status: 'active',
        user_name: studentObj?.name || '',
        user_email: studentObj?.email || '',
        course_name: courseObj?.name || '',
        enrolled_at: serverTimestamp(),
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      }, { merge: true });

      await createAdminLog(profile, {
        action: 'course_enroll_student',
        performed_by: profile?.email || profile?.name || 'admin',
        target_id: selectedStudentToEnroll,
        details: `Enrolled ${studentObj?.name || selectedStudentToEnroll} into ${courseObj?.name || selectedRosterCourseId}`,
      }).catch(() => {});

      await createNotificationAsAdmin(profile, {
        title: 'Class Enrollment Activated',
        message: `You have been officially enrolled in ${courseObj?.name || 'your class'}. Open Courses to begin learning.`,
        user_id: selectedStudentToEnroll,
      }).catch(() => {});

      setSelectedStudentToEnroll('');
      await fetchRoster(selectedRosterCourseId);
      Alert.alert('Student Enrolled', `${studentObj?.name || 'Student'} is now enrolled in this class.`);
    } catch (error: unknown) {
      logFirestoreFailure({ collection: 'enrollments', operation: 'set', path: `enrollments/${selectedStudentToEnroll}:${selectedRosterCourseId}`, query: 'enroll student', role: profile?.role, status: profile?.status }, error);
      Alert.alert('Enrollment Failed', 'Could not complete student enrollment.');
    } finally {
      setActionLoading(false);
    }
  };

  const unenrollStudentFromCourse = (rosterItem: RosterItem) => {
    Alert.alert(
      'Remove Enrollment',
      `Unenroll ${rosterItem.student_name || 'this student'} from this class?`,
      [
        { text: 'Cancel' },
        {
          text: 'Unenroll',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              await updateDoc(doc(db, 'enrollments', rosterItem.id), {
                status: 'cancelled',
                updated_at: serverTimestamp(),
              });
              await createAdminLog(profile, {
                action: 'course_unenroll_student',
                performed_by: profile?.email || profile?.name || 'admin',
                target_id: rosterItem.user_id,
                details: `Cancelled enrollment for ${rosterItem.student_name} in ${rosterItem.course_id}`,
              }).catch(() => {});
              await fetchRoster(selectedRosterCourseId);
              Alert.alert('Enrollment Cancelled', 'Student has been removed from this class roster.');
            } catch (error) {
              Alert.alert('Action Failed', 'Could not cancel enrollment.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const addSubjectToDraft = () => {
    if (!subjectDraftName.trim()) {
      Alert.alert('Subject Name', 'Please enter a subject name (e.g. Tajweed, Fiqh, Hadith).');
      return;
    }
    const assignedTeacher = teachers.find((t) => t.id === subjectDraftTeacherId);
    const newSubject: CourseSubject = {
      id: `sub_${Date.now()}`,
      name: subjectDraftName.trim(),
      teacher_id: subjectDraftTeacherId || undefined,
      teacher_name: assignedTeacher?.name || undefined,
      schedule: subjectDraftSchedule.trim() || undefined,
    };
    setCourseForm((prev) => ({
      ...prev,
      subjects: [...(prev.subjects || []), newSubject],
    }));
    setSubjectDraftName('');
    setSubjectDraftTeacherId('');
    setSubjectDraftSchedule('');
  };

  const removeSubjectFromDraft = (index: number) => {
    setCourseForm((prev) => ({
      ...prev,
      subjects: (prev.subjects || []).filter((_, i) => i !== index),
    }));
  };

  useEffect(() => {
    if (profile && !isAdmin) {
      router.replace('/unauthorized?required=admin');
      return;
    }
    if (isAdmin) fetchData();
  }, [isAdmin]);

  useEffect(() => {
    if (!selectedTeacherId) {
      setSelectedCourses([]);
      return;
    }
    const teacher = teachers.find((t) => t.id === selectedTeacherId);
    setSelectedCourses(teacher?.assigned_courses || []);
    if (teacher) {
      setTeacherName(teacher.name);
      setTeacherTitle(teacher.title);
      setTeacherPhoto(teacher.photo_url || '');
    }
  }, [selectedTeacherId, teachers]);

  useEffect(() => {
    if (!recordingLessonId) return;
    const belongsToCourse = lessons.some((lesson) => lesson.id === recordingLessonId && lesson.course_id === recordingCourseId);
    if (!belongsToCourse) setRecordingLessonId('');
  }, [lessons, recordingCourseId, recordingLessonId]);

  if (profile && !isAdmin) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center', padding: SPACING.lg }]}>
        <Text style={styles.sectionTitle}>Access denied</Text>
        <Text style={styles.helper}>Only admins can manage academics.</Text>
      </View>
    );
  }

  const saveCourse = async () => {
    if (!isAdmin) return;
    if (!courseForm.name.trim()) {
      Alert.alert('Missing', 'Course name is required');
      return;
    }

    let normalizedMeetLink = '';
    if (courseForm.meet_link && courseForm.meet_link.trim()) {
      normalizedMeetLink = normalizeMeetUrl(courseForm.meet_link);
      if (!isValidHttpsUrl(normalizedMeetLink)) {
        Alert.alert('Invalid Meet Link', 'Please add a valid http/https class link (Google Meet/Drive/YouTube links are supported).');
        return;
      }
    }

    const payload = {
      name: courseForm.name.trim(),
      teacher_name: courseForm.teacher_name.trim(),
      teacher_id: courseForm.teacher_id || '',
      schedule: courseForm.schedule.trim(),
      class_time: (courseForm.class_time || '').trim(),
      meet_link: normalizedMeetLink,
      description: courseForm.description.trim(),
      subjects: Array.isArray(courseForm.subjects) ? courseForm.subjects : [],
      updated_at: serverTimestamp(),
    };

    try {
      setActionLoading(true);
      const isEditing = Boolean(editingCourseId);
      if (editingCourseId) {
        await updateDoc(doc(db, 'courses', editingCourseId), payload);
        createAdminLog(profile, { action: 'course_update', performed_by: profile?.email || profile?.name || 'admin', target_id: editingCourseId, details: payload.name }).catch(() => {});
      } else {
        await addDoc(collection(db, 'courses'), {
          ...payload,
          created_at: serverTimestamp(),
        });
        createAdminLog(profile, { action: 'course_create', performed_by: profile?.email || profile?.name || 'admin', details: payload.name }).catch(() => {});
      }

      setCourseForm(INITIAL_COURSE);
      setEditingCourseId(null);

      // Trigger announcements in background (don't block UI)
      const announcementMessage = `${payload.name} - ${payload.schedule}${payload.class_time ? ` at ${payload.class_time}` : ''}`;
      createNotificationAsAdmin(profile, {
        title: isEditing ? 'Class Schedule Updated' : 'New Class Scheduled',
        message: announcementMessage,
        user_id: 'all',
      }).catch((err) => console.warn('[manage-academics] Announcement notification failed:', err));

      if (!isEditing) {
        createRoleNotificationAsAdmin(profile, {
          title: 'New Course Available',
          message: `${payload.name} has been added. Open Courses to enroll now.`,
          roles: ['student'],
          category: 'new_course',
        }).catch((err) => console.warn('[manage-academics] Role notification failed:', err));
      }

      await fetchData();
      Alert.alert('Success', isEditing ? 'Course updated successfully!' : 'Course added successfully!');
    } catch (error: unknown) {
      logFirestoreFailure({ collection: 'courses', operation: editingCourseId ? 'update' : 'add', path: editingCourseId ? `courses/${editingCourseId}` : 'courses', query: editingCourseId ? 'update course' : 'create course', role: profile?.role, status: profile?.status }, error);
      Alert.alert('Save Failed', 'Could not save course. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const editCourse = (course: CourseItem) => {
    setEditingCourseId(course.id);
    setCourseForm({
      name: course.name,
      teacher_name: course.teacher_name,
      teacher_id: course.teacher_id || '',
      schedule: course.schedule,
      class_time: course.class_time || '',
      meet_link: course.meet_link,
      description: course.description,
      subjects: Array.isArray(course.subjects) ? course.subjects : [],
    });
  };

  const removeCourse = (course: CourseItem) => {
    Alert.alert('Delete Course', `Delete "${course.name}"?`, [
      { text: 'Cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'courses', course.id));
            await fetchData();
          } catch (error: unknown) {
            logFirestoreFailure({ collection: 'courses', operation: 'delete', path: `courses/${course.id}`, query: 'delete course', role: profile?.role, status: profile?.status }, error);
            Alert.alert('Delete Failed', 'Could not delete course. Please try again.');
          }
        },
      },
    ]);
  };

  const addTeacher = async () => {
    if (!isAdmin) return;
    if (!teacherName.trim()) {
      Alert.alert('Missing', 'Teacher name is required');
      return;
    }
    try {
      setActionLoading(true);
      await addDoc(collection(db, 'teachers'), {
        name: teacherName.trim(),
        title: teacherTitle.trim() || 'Teacher',
        photo_url: teacherPhoto.trim(),
        assigned_courses: [],
        courses: [],
        created_at: serverTimestamp(),
      });
      setTeacherName('');
      setTeacherTitle('');
      setTeacherPhoto('');
      await fetchData();
    } catch (error: unknown) {
      logFirestoreFailure({ collection: 'teachers', operation: 'add', path: 'teachers', query: 'create teacher', role: profile?.role, status: profile?.status }, error);
      Alert.alert('Add Failed', 'Could not add teacher. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const removeTeacher = (teacher: TeacherItem) => {
    Alert.alert('Remove Teacher', `Remove "${teacher.name}"?`, [
      { text: 'Cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'teachers', teacher.id));
            if (selectedTeacherId === teacher.id) setSelectedTeacherId('');
            await fetchData();
          } catch (error: unknown) {
            logFirestoreFailure({ collection: 'teachers', operation: 'delete', path: `teachers/${teacher.id}`, query: 'delete teacher', role: profile?.role, status: profile?.status }, error);
            Alert.alert('Remove Failed', 'Could not remove teacher. Please try again.');
          }
        },
      },
    ]);
  };

  const toggleTeacherCourse = (courseName: string) => {
    setSelectedCourses((prev) => (prev.includes(courseName)
      ? prev.filter((c) => c !== courseName)
      : [...prev, courseName]));
  };

  const assignCourses = async () => {
    if (!selectedTeacherId) {
      Alert.alert('Select teacher', 'Choose a teacher first.');
      return;
    }
    Alert.alert('Save Assignment', 'Apply course assignments to selected teacher?', [
      { text: 'Cancel' },
      {
        text: 'Save',
        onPress: async () => {
          try {
            setActionLoading(true);
            await updateDoc(doc(db, 'teachers', selectedTeacherId), {
              assigned_courses: selectedCourses,
              courses: selectedCourses,
              updated_at: serverTimestamp(),
            });
            await fetchData();
            Alert.alert('Success', 'Courses assigned successfully');
          } catch (error: unknown) {
            logFirestoreFailure({ collection: 'teachers', operation: 'update', path: `teachers/${selectedTeacherId}`, query: 'assign courses to teacher', role: profile?.role, status: profile?.status }, error);
            Alert.alert('Update Failed', 'Could not assign courses. Please try again.');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const saveTeacherProfile = async () => {
    if (!selectedTeacherId) {
      Alert.alert('Select teacher', 'Choose a teacher first.');
      return;
    }
    if (!teacherName.trim()) {
      Alert.alert('Missing', 'Teacher name is required.');
      return;
    }
    try {
      setActionLoading(true);
      await updateDoc(doc(db, 'teachers', selectedTeacherId), {
        name: teacherName.trim(),
        title: teacherTitle.trim(),
        photo_url: teacherPhoto.trim(),
        updated_at: serverTimestamp(),
      });
      await fetchData();
      Alert.alert('Saved', 'Teacher profile updated.');
    } catch (error: unknown) {
      logFirestoreFailure({ collection: 'teachers', operation: 'update', path: `teachers/${selectedTeacherId}`, query: 'update teacher profile', role: profile?.role, status: profile?.status }, error);
      Alert.alert('Update Failed', 'Could not update teacher profile.');
    } finally {
      setActionLoading(false);
    }
  };

  const addRecording = async () => {
    if (!recordingTitle.trim() || !recordingUrl.trim() || !recordingCourseId) {
      Alert.alert('Missing', 'Recording title, link and course are required.');
      return;
    }
    if (!isValidHttpsUrl(recordingUrl.trim())) {
      Alert.alert('Invalid URL', 'Please enter a valid http/https recording URL (Google Drive/YouTube links are supported).');
      return;
    }
    try {
      setActionLoading(true);
      const payload = {
        title: recordingTitle.trim(),
        description: recordingDescription.trim(),
        file_url: recordingUrl.trim(),
        course_id: recordingCourseId,
        lesson_id: recordingLessonId || '',
        updated_at: serverTimestamp(),
      };
      if (editingRecordingId) {
        await updateDoc(doc(db, 'recordings', editingRecordingId), payload);
      } else {
        await addDoc(collection(db, 'recordings'), {
          ...payload,
          created_by: profile?.name || 'admin',
          created_at: serverTimestamp(),
        });
      }
      await createNotificationAsAdmin(profile, {
        title: editingRecordingId ? 'Recording Updated' : 'New Recording Added',
        message: `${recordingTitle.trim()} is available now.`,
        user_id: 'all',
      });
      setRecordingTitle('');
      setRecordingDescription('');
      setRecordingUrl('');
      setRecordingCourseId('');
      setRecordingLessonId('');
      setEditingRecordingId(null);
      Alert.alert('Saved', editingRecordingId ? 'Recording updated successfully.' : 'Recording added successfully.');
      await fetchData();
    } catch (error: unknown) {
      logFirestoreFailure({ collection: 'recordings', operation: editingRecordingId ? 'update' : 'add', path: editingRecordingId ? `recordings/${editingRecordingId}` : 'recordings', query: editingRecordingId ? 'update recording' : 'create recording', role: profile?.role, status: profile?.status }, error);
      Alert.alert('Save Failed', 'Could not save recording.');
    } finally {
      setActionLoading(false);
    }
  };

  const startEditRecording = (recording: RecordingItem) => {
    setEditingRecordingId(recording.id);
    setRecordingTitle(recording.title || '');
    setRecordingDescription(recording.description || '');
    setRecordingUrl(recording.file_url || '');
    setRecordingCourseId(recording.course_id || '');
    setRecordingLessonId(recording.lesson_id || '');
  };

  const clearRecordingForm = () => {
    setEditingRecordingId(null);
    setRecordingTitle('');
    setRecordingDescription('');
    setRecordingUrl('');
    setRecordingCourseId('');
    setRecordingLessonId('');
  };

  const deleteRecording = (recording: RecordingItem) => {
    Alert.alert('Delete Recording', `Delete "${recording.title || 'recording'}"?`, [
      { text: 'Cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setActionLoading(true);
            await deleteDoc(doc(db, 'recordings', recording.id));
            if (editingRecordingId === recording.id) clearRecordingForm();
            await fetchData();
          } catch (error: unknown) {
            logFirestoreFailure({ collection: 'recordings', operation: 'delete', path: `recordings/${recording.id}`, query: 'delete recording', role: profile?.role, status: profile?.status }, error);
            Alert.alert('Delete Failed', 'Could not delete recording.');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  if (profile && !isAdmin) return null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => goBackOrReplace(router, '/more')}>
          <Ionicons name="close" size={22} color={COLORS.textMain} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Manage Academics</Text>
        <TouchableOpacity onPress={fetchData}>
          <Ionicons name="refresh" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.helper}>Loading...</Text>
          </View>
        ) : null}
        {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}

        <View style={styles.lmsBanner}>
          <View style={styles.lmsBannerHeader}>
            <Ionicons name="school" size={24} color={COLORS.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.lmsBannerTitle}>LMS Executive Metrics</Text>
              <Text style={styles.lmsBannerSubtitle}>Real-time overview of academic operations</Text>
            </View>
          </View>
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{courses.length}</Text>
              <Text style={styles.metricLabel}>Total Courses</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={[styles.metricValue, { color: '#1565C0' }]}>{studentCount}</Text>
              <Text style={styles.metricLabel}>Active Students</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={[styles.metricValue, { color: '#2E7D32' }]}>{teachers.length}</Text>
              <Text style={styles.metricLabel}>Faculty</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={[styles.metricValue, { color: '#E65100' }]}>{lessons.length}</Text>
              <Text style={styles.metricLabel}>Materials</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={[styles.metricValue, { color: '#6A1B9A' }]}>{recordings.length}</Text>
              <Text style={styles.metricLabel}>Recordings</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={[styles.metricValue, { color: COLORS.goldText }]}>{avgContentPerCourse}</Text>
              <Text style={styles.metricLabel}>Avg Content/Course</Text>
            </View>
          </View>
        </View>

        {courses.length > 0 && (
          <View style={styles.scheduleCard}>
            <View style={styles.scheduleHeader}>
              <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
              <Text style={styles.scheduleTitle}>Upcoming Class Schedule</Text>
            </View>
            {courses.slice(0, 4).map((c) => (
              <View key={c.id} style={styles.scheduleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.scheduleCourseName}>{c.name}</Text>
                  <Text style={styles.scheduleTeacher}>Faculty: {c.teacher_name || 'Unassigned'}</Text>
                </View>
                <View style={styles.scheduleTimeBadge}>
                  <Text style={styles.scheduleTimeText}>{c.schedule || 'Weekly'} {c.class_time ? `• ${c.class_time}` : ''}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Courses & Institutional Classes</Text>
          <TextInput style={styles.input} placeholder="Course / Class Name (e.g. Dars-e-Nizami Year 1)" placeholderTextColor={COLORS.textMuted} value={courseForm.name} onChangeText={(v) => setCourseForm((p) => ({ ...p, name: v }))} />
          <TextInput style={styles.input} placeholder="Lead Teacher Name" placeholderTextColor={COLORS.textMuted} value={courseForm.teacher_name} onChangeText={(v) => setCourseForm((p) => ({ ...p, teacher_name: v }))} />
          <TextInput style={styles.input} placeholder="Schedule (e.g. Mon-Thu)" placeholderTextColor={COLORS.textMuted} value={courseForm.schedule} onChangeText={(v) => setCourseForm((p) => ({ ...p, schedule: v }))} />
          <TextInput style={styles.input} placeholder="Class time (e.g. 10:00 AM / 14:30)" placeholderTextColor={COLORS.textMuted} value={courseForm.class_time} onChangeText={(v) => setCourseForm((p) => ({ ...p, class_time: v }))} />
          <TextInput style={styles.input} placeholder="Google Meet link" placeholderTextColor={COLORS.textMuted} value={courseForm.meet_link} onChangeText={(v) => setCourseForm((p) => ({ ...p, meet_link: v }))} autoCapitalize="none" />
          <TextInput style={[styles.input, styles.textArea]} placeholder="Course Description / Syllabus Overview" placeholderTextColor={COLORS.textMuted} value={courseForm.description} onChangeText={(v) => setCourseForm((p) => ({ ...p, description: v }))} multiline />

          {/* Academic Subjects Builder */}
          <View style={styles.subSectionBox}>
            <View style={styles.subSectionHeader}>
              <Ionicons name="library-outline" size={18} color="#059669" />
              <Text style={styles.subSectionTitle}>Academic Subjects & Faculty (Optional)</Text>
            </View>
            <Text style={styles.helper}>Add individual subjects belonging to this class with specific assigned teachers (e.g. Tajweed → Ustaadha Sumra, Fiqh → Ustaadha Sumra, Hadith → Ustaadha Fatima).</Text>
            
            {Array.isArray(courseForm.subjects) && courseForm.subjects.length > 0 ? (
              <View style={{ gap: 6, marginVertical: 8 }}>
                {courseForm.subjects.map((sub, sIdx) => (
                  <View key={sub.id || sIdx} style={styles.subjectDraftItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subjectDraftName}>{sub.name}</Text>
                      <Text style={styles.subjectDraftMeta}>Faculty: {sub.teacher_name || 'Unassigned'} {sub.schedule ? `• ${sub.schedule}` : ''}</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeSubjectFromDraft(sIdx)} style={styles.subjectDraftRemoveBtn}>
                      <Ionicons name="trash-outline" size={16} color={COLORS.error} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[styles.helper, { fontStyle: 'italic', marginVertical: 4 }]}>No additional subjects defined for this course.</Text>
            )}

            <View style={styles.subjectAddRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="Subject Name (e.g. Tajweed)"
                placeholderTextColor={COLORS.textMuted}
                value={subjectDraftName}
                onChangeText={setSubjectDraftName}
              />
              <TextInput
                style={[styles.input, { width: 110, marginBottom: 0 }]}
                placeholder="Schedule"
                placeholderTextColor={COLORS.textMuted}
                value={subjectDraftSchedule}
                onChangeText={setSubjectDraftSchedule}
              />
            </View>

            {teachers.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginVertical: 6 }}>
                {teachers.map((t) => {
                  const sel = subjectDraftTeacherId === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.teacherChipSmall, sel && styles.teacherChipSmallSelected]}
                      onPress={() => setSubjectDraftTeacherId((prev) => (prev === t.id ? '' : t.id))}
                    >
                      <Ionicons name={sel ? "checkmark-circle" : "person-outline"} size={13} color={sel ? "#FFF" : COLORS.textMuted} />
                      <Text style={[styles.teacherChipSmallText, sel && styles.teacherChipSmallTextSelected]}>{t.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : null}

            <TouchableOpacity style={styles.addSubjectBtn} onPress={addSubjectToDraft}>
              <Ionicons name="add-circle-outline" size={16} color={COLORS.primary} />
              <Text style={styles.addSubjectBtnText}>+ Add Subject to Class</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[styles.primaryBtn, actionLoading && styles.disabledBtn]} onPress={saveCourse} disabled={actionLoading}>
            {actionLoading ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Text style={styles.primaryBtnText}>{editingCourseId ? 'Update Course' : 'Add Course'}</Text>}
          </TouchableOpacity>
          {editingCourseId && (
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => { setEditingCourseId(null); setCourseForm(INITIAL_COURSE); }}>
              <Text style={styles.secondaryBtnText}>Cancel Edit</Text>
            </TouchableOpacity>
          )}

          {courses.length === 0 ? <Text style={styles.helper}>No courses added yet.</Text> : courses.map((course) => (
            <View key={course.id} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{course.name}</Text>
                <Text style={styles.itemMeta}>{course.schedule} {course.class_time ? `• ${course.class_time}` : ''}</Text>
                {Array.isArray(course.subjects) && course.subjects.length > 0 ? (
                  <Text style={[styles.itemMeta, { color: '#059669', fontWeight: '700' }]}>
                    {course.subjects.length} Subjects: {course.subjects.map(s => s.name).join(', ')}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity onPress={() => editCourse(course)} style={styles.smallBtn}><Text style={styles.smallBtnText}>Edit</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => removeCourse(course)} style={[styles.smallBtn, styles.deleteSmallBtn]}><Text style={[styles.smallBtnText, { color: COLORS.error }]}>Delete</Text></TouchableOpacity>
            </View>
          ))}
        </View>

        {/* ══════════════════ STUDENT CLASS ENROLLMENT & ROSTER MANAGER ══════════════════ */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Ionicons name="people" size={22} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Student Class Enrollment & Roster</Text>
          </View>
          <Text style={styles.helper}>
            Select a class below to view its enrolled student roster or enroll registered students.
          </Text>

          {/* Select Course for Roster */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginVertical: 10 }}>
            {courses.map((course) => {
              const isSelected = selectedRosterCourseId === course.id;
              return (
                <TouchableOpacity
                  key={course.id}
                  style={[styles.courseChip, isSelected && styles.courseChipSelected]}
                  onPress={() => setSelectedRosterCourseId(course.id)}
                >
                  <Ionicons name={isSelected ? 'school' : 'school-outline'} size={16} color={isSelected ? COLORS.surface : COLORS.primary} />
                  <Text style={[styles.courseChipText, isSelected && styles.courseChipTextSelected]}>{course.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {selectedRosterCourseId ? (
            <View style={styles.rosterCard}>
              <View style={styles.rosterHeader}>
                <Text style={styles.rosterTitle}>
                  Enrolled Students ({rosterList.length})
                </Text>
                {rosterLoading ? <ActivityIndicator size="small" color={COLORS.primary} /> : null}
              </View>

              {rosterList.length === 0 ? (
                <Text style={[styles.helper, { fontStyle: 'italic', marginVertical: 8 }]}>
                  No students are currently enrolled in this class.
                </Text>
              ) : (
                rosterList.map((rosterItem) => (
                  <View key={rosterItem.id} style={styles.rosterRow}>
                    <Ionicons name="person-circle-outline" size={24} color={COLORS.secondary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rosterStudentName}>{rosterItem.student_name}</Text>
                      {rosterItem.student_email ? (
                        <Text style={styles.rosterStudentEmail}>{rosterItem.student_email}</Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      style={styles.unenrollBtn}
                      onPress={() => unenrollStudentFromCourse(rosterItem)}
                    >
                      <Ionicons name="remove-circle-outline" size={14} color={COLORS.error} />
                      <Text style={styles.unenrollBtnText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}

              {/* 1-Tap Enroll Student Dropdown / Picker */}
              <View style={styles.enrollBox}>
                <Text style={styles.enrollBoxTitle}>Enroll a Student into this Class:</Text>
                {availableStudents.length === 0 ? (
                  <Text style={styles.helper}>No registered student accounts found.</Text>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginVertical: 8 }}>
                    {availableStudents.map((st) => {
                      const isEnrolledAlready = rosterList.some((r) => r.user_id === st.uid);
                      const isSelected = selectedStudentToEnroll === st.uid;
                      if (isEnrolledAlready) return null;
                      return (
                        <TouchableOpacity
                          key={st.uid}
                          style={[styles.studentChip, isSelected && styles.studentChipSelected]}
                          onPress={() => setSelectedStudentToEnroll(st.uid)}
                        >
                          <Ionicons name={isSelected ? "checkmark" : "add"} size={14} color={isSelected ? "#FFF" : COLORS.primary} />
                          <Text style={[styles.studentChipText, isSelected && styles.studentChipTextSelected]}>
                            {st.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}

                <TouchableOpacity
                  style={[styles.primaryBtn, (!selectedStudentToEnroll || actionLoading) && styles.disabledBtn]}
                  onPress={enrollStudentInCourse}
                  disabled={!selectedStudentToEnroll || actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : (
                    <Text style={styles.primaryBtnText}>✓ Confirm Student Enrollment</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Text style={[styles.helper, { fontStyle: 'italic', marginVertical: 6 }]}>
              Please select a course above to view or manage its student roster.
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Teachers</Text>
          <TextInput style={styles.input} placeholder="Teacher name" placeholderTextColor={COLORS.textMuted} value={teacherName} onChangeText={setTeacherName} />
          <TextInput style={styles.input} placeholder="Title (e.g. Alima Fazila)" placeholderTextColor={COLORS.textMuted} value={teacherTitle} onChangeText={setTeacherTitle} />
          <TextInput style={styles.input} placeholder="Photo URL (optional)" placeholderTextColor={COLORS.textMuted} value={teacherPhoto} onChangeText={setTeacherPhoto} autoCapitalize="none" />
          <TouchableOpacity style={[styles.primaryBtn, actionLoading && styles.disabledBtn]} onPress={addTeacher} disabled={actionLoading}>
            {actionLoading ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Text style={styles.primaryBtnText}>Add Teacher</Text>}
          </TouchableOpacity>
          {selectedTeacherId ? (
            <TouchableOpacity style={styles.secondaryBtn} onPress={saveTeacherProfile}>
              <Text style={styles.secondaryBtnText}>Save Selected Teacher Profile</Text>
            </TouchableOpacity>
          ) : null}

          {teachers.length === 0 ? <Text style={styles.helper}>No teachers added yet.</Text> : teachers.map((teacher) => (
            <TouchableOpacity
              key={teacher.id}
              style={[styles.itemRow, selectedTeacherId === teacher.id && styles.selectedRow]}
              onPress={() => setSelectedTeacherId(teacher.id)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{teacher.name}</Text>
                <Text style={styles.itemMeta}>{teacher.title}</Text>
              </View>
              <TouchableOpacity onPress={() => removeTeacher(teacher)} style={[styles.smallBtn, styles.deleteSmallBtn]}>
                <Text style={[styles.smallBtnText, { color: COLORS.error }]}>Remove</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Assign Courses to Teacher</Text>
          <Text style={styles.helper}>
            Selected teacher: {teachers.find((t) => t.id === selectedTeacherId)?.name || 'None'}
          </Text>

          {courseNames.length === 0 ? <Text style={styles.helper}>No courses available for assignment.</Text> : courseNames.map((name) => {
            const selected = selectedCourses.includes(name);
          
            return (
              <TouchableOpacity
                key={name}
                style={[styles.courseChip, selected && styles.courseChipSelected]}
                onPress={() => toggleTeacherCourse(name)}
              >
                <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={18} color={selected ? COLORS.primary : COLORS.textMuted} />
                <Text style={[styles.courseChipText, selected && styles.courseChipTextSelected]}>{name}</Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity style={[styles.primaryBtn, actionLoading && styles.disabledBtn]} onPress={assignCourses} disabled={actionLoading}>
            {actionLoading ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Text style={styles.primaryBtnText}>Save Assignment</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recordings</Text>
          <TextInput style={styles.input} placeholder="Recording title" placeholderTextColor={COLORS.textMuted} value={recordingTitle} onChangeText={setRecordingTitle} />
          <TextInput style={styles.input} placeholder="Description" placeholderTextColor={COLORS.textMuted} value={recordingDescription} onChangeText={setRecordingDescription} />
          <TextInput style={styles.input} placeholder="Google Drive / media URL" placeholderTextColor={COLORS.textMuted} value={recordingUrl} onChangeText={setRecordingUrl} autoCapitalize="none" />
          <Text style={styles.helper}>Select course:</Text>
          {courses.length === 0 ? <Text style={styles.helper}>No courses available.</Text> : courses.map((course) => (
            <TouchableOpacity key={course.id} style={[styles.courseChip, recordingCourseId === course.id && styles.courseChipSelected]} onPress={() => setRecordingCourseId(course.id)}>
              <Text style={[styles.courseChipText, recordingCourseId === course.id && styles.courseChipTextSelected]}>{course.name}</Text>
            </TouchableOpacity>
          ))}
          <Text style={styles.helper}>Attach to lesson (optional):</Text>
          {lessonOptions.length === 0 ? (
            <Text style={styles.helper}>Select a course to view lessons.</Text>
          ) : lessonOptions.map((lesson) => (
            <TouchableOpacity key={lesson.id} style={[styles.courseChip, recordingLessonId === lesson.id && styles.courseChipSelected]} onPress={() => setRecordingLessonId((prev) => (prev === lesson.id ? '' : lesson.id))}>
              <Text style={[styles.courseChipText, recordingLessonId === lesson.id && styles.courseChipTextSelected]}>{lesson.title}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.primaryBtn, actionLoading && styles.disabledBtn]} onPress={addRecording} disabled={actionLoading}>
            {actionLoading ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Text style={styles.primaryBtnText}>{editingRecordingId ? 'Update Recording' : 'Add Recording'}</Text>}
          </TouchableOpacity>
          {editingRecordingId ? (
            <TouchableOpacity style={styles.secondaryBtn} onPress={clearRecordingForm}>
              <Text style={styles.secondaryBtnText}>Cancel Recording Edit</Text>
            </TouchableOpacity>
          ) : null}

          {recordings.length === 0 ? <Text style={styles.helper}>No recordings added yet.</Text> : recordings.map((recording) => (
            <View key={recording.id} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{recording.title || 'Recording'}</Text>
                <Text style={styles.itemMeta}>{courses.find((c) => c.id === recording.course_id)?.name || 'Unknown course'}</Text>
                {recording.lesson_id ? (
                  <Text style={styles.itemMeta}>Lesson: {lessons.find((l) => l.id === recording.lesson_id)?.title || 'Unknown lesson'}</Text>
                ) : null}
              </View>
              <TouchableOpacity onPress={() => startEditRecording(recording)} style={styles.smallBtn}><Text style={styles.smallBtnText}>Edit</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => deleteRecording(recording)} style={[styles.smallBtn, styles.deleteSmallBtn]}><Text style={[styles.smallBtnText, { color: COLORS.error }]}>Delete</Text></TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm, backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surfaceAlt,
  },
  topBarTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textMain },
  body: { padding: SPACING.md, gap: SPACING.md, paddingBottom: 40 },
  section: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.lg, gap: 12, ...SHADOWS.card, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.primary, marginBottom: 4 },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    color: COLORS.textMain,
    fontSize: 14,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  secondaryBtn: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryBtnText: { color: COLORS.textMain, fontWeight: '600' },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  itemTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textMain },
  itemMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  smallBtn: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 6 },
  deleteSmallBtn: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
  smallBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  selectedRow: { backgroundColor: '#EEF6F2' },
  helper: { fontSize: 12, color: COLORS.textMuted },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText: { color: COLORS.error, fontSize: 12 },
  disabledBtn: { opacity: 0.75 },
  courseChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.xxl, paddingHorizontal: 10, paddingVertical: 8,
  },
  courseChipSelected: { borderColor: COLORS.primary, backgroundColor: '#EEF6F2' },
  courseChipText: { color: COLORS.textMain, fontSize: 13, fontWeight: '500' },
  courseChipTextSelected: { color: COLORS.primary, fontWeight: '700' },
  lmsBanner: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    ...SHADOWS.card,
  },
  lmsBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: SPACING.sm,
  },
  lmsBannerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
  },
  lmsBannerSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    width: '30%',
    flexGrow: 1,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.primary,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  scheduleCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    ...SHADOWS.card,
  },
  scheduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.sm,
  },
  scheduleTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 8,
  },
  scheduleCourseName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  scheduleTeacher: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  scheduleTimeBadge: {
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  scheduleTimeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
  },
  subSectionBox: {
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  subSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  subjectDraftItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    padding: 8,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  subjectDraftName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  subjectDraftMeta: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  subjectDraftRemoveBtn: {
    padding: 6,
  },
  subjectAddRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginVertical: 4,
  },
  teacherChipSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  teacherChipSmallSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  teacherChipSmallText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  teacherChipSmallTextSelected: {
    color: '#FFF',
    fontWeight: '700',
  },
  addSubjectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(15,169,88,0.4)',
    backgroundColor: 'rgba(15,169,88,0.08)',
    borderRadius: RADIUS.md,
    paddingVertical: 8,
    marginTop: 6,
  },
  addSubjectBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  rosterCard: {
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginTop: 6,
  },
  rosterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  rosterTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textMain,
  },
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 8,
    marginBottom: 6,
  },
  rosterStudentName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  rosterStudentEmail: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  unenrollBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  unenrollBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.error,
  },
  enrollBox: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
  },
  enrollBoxTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMain,
    marginBottom: 4,
  },
  studentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(15,169,88,0.4)',
    backgroundColor: COLORS.surface,
  },
  studentChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  studentChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  studentChipTextSelected: {
    color: '#FFF',
    fontWeight: '700',
  },
});
