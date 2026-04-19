import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, StatusBar, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLORS, SPACING, RADIUS, SHADOWS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { createNotificationAsAdmin } from '@/lib/notifications';

type CourseItem = {
  id: string;
  name: string;
  teacher_name: string;
  schedule: string;
  time?: string;
  class_link: string;
  description: string;
};

type TeacherItem = {
  id: string;
  name: string;
  title: string;
  courses: string[];
};

const INITIAL_COURSE: Omit<CourseItem, 'id'> = {
  name: '',
  teacher_name: '',
  schedule: '',
  time: '',
  class_link: '',
  description: '',
};

export default function ManageAcademicsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseForm, setCourseForm] = useState(INITIAL_COURSE);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [teacherName, setTeacherName] = useState('');
  const [teacherTitle, setTeacherTitle] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const courseNames = useMemo(() => courses.map((c) => c.name).filter(Boolean), [courses]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [courseSnap, teacherSnap] = await Promise.all([
        getDocs(collection(db, 'courses')),
        getDocs(collection(db, 'teachers')),
      ]);

      const nextCourses: CourseItem[] = [];
      courseSnap.forEach((d) => {
        const data = d.data();
        nextCourses.push({
          id: d.id,
          name: data.name || '',
          teacher_name: data.teacher_name || data.teacherName || '',
          schedule: data.schedule || '',
          time: data.time || '',
          class_link: data.class_link || data.classLink || '',
          description: data.description || '',
        });
      });

      const nextTeachers: TeacherItem[] = [];
      teacherSnap.forEach((d) => {
        const data = d.data();
        nextTeachers.push({
          id: d.id,
          name: data.name || '',
          title: data.title || '',
          courses: Array.isArray(data.courses) ? data.courses : [],
        });
      });

      setCourses(nextCourses);
      setTeachers(nextTeachers);
      setLoadError('');
    } catch {
      setLoadError('Could not load academic data. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile && !isAdmin) {
      router.replace('/');
      return;
    }
    if (isAdmin) fetchData();
  }, [profile, isAdmin, router]);

  useEffect(() => {
    if (!selectedTeacherId) {
      setSelectedCourses([]);
      return;
    }
    const teacher = teachers.find((t) => t.id === selectedTeacherId);
    setSelectedCourses(teacher?.courses || []);
  }, [selectedTeacherId, teachers]);

  const saveCourse = async () => {
    if (!isAdmin) return;
    if (!courseForm.name.trim()) {
      Alert.alert('Missing', 'Course name is required');
      return;
    }

    const payload = {
      name: courseForm.name.trim(),
      teacher_name: courseForm.teacher_name.trim(),
      schedule: courseForm.schedule.trim(),
      time: (courseForm.time || '').trim(),
      class_link: courseForm.class_link.trim(),
      description: courseForm.description.trim(),
      updated_at: serverTimestamp(),
    };

    try {
      setActionLoading(true);
      if (editingCourseId) {
        await updateDoc(doc(db, 'courses', editingCourseId), payload);
      } else {
        await addDoc(collection(db, 'courses'), {
          ...payload,
          created_at: serverTimestamp(),
        });
      }
      setCourseForm(INITIAL_COURSE);
      setEditingCourseId(null);
      await createNotificationAsAdmin(profile, {
        title: editingCourseId ? 'Class Schedule Updated' : 'New Class Scheduled',
        message: `${payload.name} - ${payload.schedule}${payload.time ? ` at ${payload.time}` : ''}`,
        user_id: 'all',
      });
      await fetchData();
    } catch {
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
      schedule: course.schedule,
      time: course.time || '',
      class_link: course.class_link,
      description: course.description,
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
          } catch {
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
        courses: [],
        created_at: serverTimestamp(),
      });
      setTeacherName('');
      setTeacherTitle('');
      await fetchData();
    } catch {
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
          } catch {
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
              courses: selectedCourses,
              updated_at: serverTimestamp(),
            });
            await fetchData();
            Alert.alert('Success', 'Courses assigned successfully');
          } catch {
            Alert.alert('Update Failed', 'Could not assign courses. Please try again.');
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
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Courses</Text>
          <TextInput style={styles.input} placeholder="Course name" value={courseForm.name} onChangeText={(v) => setCourseForm((p) => ({ ...p, name: v }))} />
          <TextInput style={styles.input} placeholder="Teacher name" value={courseForm.teacher_name} onChangeText={(v) => setCourseForm((p) => ({ ...p, teacher_name: v }))} />
          <TextInput style={styles.input} placeholder="Schedule (days)" value={courseForm.schedule} onChangeText={(v) => setCourseForm((p) => ({ ...p, schedule: v }))} />
          <TextInput style={styles.input} placeholder="Time" value={courseForm.time} onChangeText={(v) => setCourseForm((p) => ({ ...p, time: v }))} />
          <TextInput style={styles.input} placeholder="Google Meet link" value={courseForm.class_link} onChangeText={(v) => setCourseForm((p) => ({ ...p, class_link: v }))} autoCapitalize="none" />
          <TextInput style={[styles.input, styles.textArea]} placeholder="Description" value={courseForm.description} onChangeText={(v) => setCourseForm((p) => ({ ...p, description: v }))} multiline />

          <TouchableOpacity style={[styles.primaryBtn, actionLoading && styles.disabledBtn]} onPress={saveCourse} disabled={actionLoading}>
            {actionLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryBtnText}>{editingCourseId ? 'Update Course' : 'Add Course'}</Text>}
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
                <Text style={styles.itemMeta}>{course.schedule} {course.time ? `• ${course.time}` : ''}</Text>
              </View>
              <TouchableOpacity onPress={() => editCourse(course)} style={styles.smallBtn}><Text style={styles.smallBtnText}>Edit</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => removeCourse(course)} style={[styles.smallBtn, styles.deleteSmallBtn]}><Text style={[styles.smallBtnText, { color: COLORS.error }]}>Delete</Text></TouchableOpacity>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Teachers</Text>
          <TextInput style={styles.input} placeholder="Teacher name" value={teacherName} onChangeText={setTeacherName} />
          <TextInput style={styles.input} placeholder="Title (e.g. Alima Fazila)" value={teacherTitle} onChangeText={setTeacherTitle} />
          <TouchableOpacity style={[styles.primaryBtn, actionLoading && styles.disabledBtn]} onPress={addTeacher} disabled={actionLoading}>
            {actionLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryBtnText}>Add Teacher</Text>}
          </TouchableOpacity>

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
            {actionLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryBtnText}>Save Assignment</Text>}
          </TouchableOpacity>
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
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surfaceAlt,
  },
  topBarTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textMain },
  body: { padding: SPACING.md, gap: SPACING.md, paddingBottom: 40 },
  section: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.md, gap: 8, ...SHADOWS.card },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.primary, marginBottom: 2 },
  input: {
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.lg, paddingHorizontal: 12, paddingVertical: 10, color: COLORS.textMain,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  primaryBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: 12, alignItems: 'center', marginTop: 2 },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  secondaryBtn: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, paddingVertical: 10, alignItems: 'center' },
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
    borderRadius: RADIUS.lg, paddingHorizontal: 10, paddingVertical: 8,
  },
  courseChipSelected: { borderColor: COLORS.primary, backgroundColor: '#EEF6F2' },
  courseChipText: { color: COLORS.textMain, fontSize: 13, fontWeight: '500' },
  courseChipTextSelected: { color: COLORS.primary, fontWeight: '700' },
});
