/**
 * /teacher/lessons.tsx
 *
 * Phase 70B — Complete Teacher Teaching Workflow
 * Dedicated Teacher Lesson Authoring & Curriculum Management Screen.
 *
 * Resolves the block where lesson creation UI was trapped behind Admin-only manage-academics.
 * Allows teachers to manage syllabus, modules, and lessons for their assigned courses.
 *
 * Enforces course & subject scoping: teachers can ONLY create/edit lessons for assigned courses.
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
  StatusBar,
  RefreshControl,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, getDocs, orderBy, onSnapshot } from 'firebase/firestore';
import { COLORS, RADIUS, SPACING, SHADOWS } from '@/constants/theme';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { getTeacherAcademicScope } from '@/lib/teacherScoping';
import {
  createTeacherLesson,
  updateTeacherLesson,
  createTeacherModule,
  uploadCourseMaterialForTeacher,
  CreateLessonInput,
} from '@/lib/teacherAcademics';
import { goBackOrReplace } from '@/lib/navigation';

interface LocalModule {
  id: string;
  course_id: string;
  title: string;
  order: number;
}

interface LocalLesson {
  id: string;
  course_id: string;
  module_id: string;
  title: string;
  description?: string;
  duration_minutes?: number;
  order: number;
  content_url?: string;
  video_url?: string;
  pdf_url?: string;
  subject_id?: string;
  subject_name?: string;
  published?: boolean;
}

export default function TeacherLessonsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const { courses, teachers } = useData();
  const { courseId: initialCourseId } = useLocalSearchParams<{ courseId?: string }>();

  // Teacher scope
  const currentTeacher = useMemo(() => {
    return teachers.find(
      (t) =>
        t.id === user?.uid ||
        t.user_uid === user?.uid ||
        (profile?.name && t.name?.toLowerCase().includes(profile.name.toLowerCase()))
    );
  }, [teachers, user?.uid, profile?.name]);

  const scope = useMemo(() => {
    return getTeacherAcademicScope(courses, currentTeacher, user?.uid);
  }, [courses, currentTeacher, user?.uid]);

  // Selected course filter
  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    initialCourseId || (scope.assignedCourses[0]?.id ?? '')
  );

  useEffect(() => {
    if (!selectedCourseId && scope.assignedCourses.length > 0) {
      setSelectedCourseId(scope.assignedCourses[0].id);
    }
  }, [scope.assignedCourses, selectedCourseId]);

  // Selected course object
  const activeCourse = useMemo(() => {
    return scope.assignedCourses.find((c) => c.id.toLowerCase() === selectedCourseId.toLowerCase());
  }, [scope.assignedCourses, selectedCourseId]);

  // Assigned subjects for the active course
  const activeSubjects = useMemo(() => {
    if (!activeCourse) return [];
    return scope.subjectsByCourseId.get(activeCourse.id) || [];
  }, [activeCourse, scope]);

  // Modules & lessons state
  const [modules, setModules] = useState<LocalModule[]>([]);
  const [lessons, setLessons] = useState<LocalLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Lesson Edit/Create Modal state
  const [lessonModalVisible, setLessonModalVisible] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonDescription, setLessonDescription] = useState('');
  const [lessonDuration, setLessonDuration] = useState('30');
  const [lessonOrder, setLessonOrder] = useState('1');
  const [lessonModuleId, setLessonModuleId] = useState('');
  const [lessonSubjectName, setLessonSubjectName] = useState('');
  const [lessonContentUrl, setLessonContentUrl] = useState('');
  const [lessonVideoUrl, setLessonVideoUrl] = useState('');
  const [lessonPdfUrl, setLessonPdfUrl] = useState('');
  const [lessonPublished, setLessonPublished] = useState(true);
  const [savingLesson, setSavingLesson] = useState(false);

  // New Module Modal state
  const [moduleModalVisible, setModuleModalVisible] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [savingModule, setSavingModule] = useState(false);

  // Load modules & lessons for the active course
  const loadCurriculum = useCallback(async () => {
    if (!selectedCourseId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // 1. Fetch modules
      const modQ = query(
        collection(db, 'modules'),
        where('course_id', '==', selectedCourseId)
      );
      const modSnap = await getDocs(modQ);
      const modList: LocalModule[] = [];
      modSnap.forEach((d) => {
        const data = d.data();
        modList.push({
          id: d.id,
          course_id: data.course_id,
          title: data.title || 'Untitled Module',
          order: Number(data.order) || 1,
        });
      });
      modList.sort((a, b) => a.order - b.order);
      setModules(modList);

      // 2. Fetch lessons
      const lesQ = query(
        collection(db, 'lessons'),
        where('course_id', '==', selectedCourseId)
      );
      const lesSnap = await getDocs(lesQ);
      const lesList: LocalLesson[] = [];
      lesSnap.forEach((d) => {
        const data = d.data();
        lesList.push({
          id: d.id,
          course_id: data.course_id,
          module_id: data.module_id,
          title: data.title || 'Untitled Lesson',
          description: data.description,
          duration_minutes: data.duration_minutes,
          order: Number(data.order) || 1,
          content_url: data.content_url,
          video_url: data.video_url,
          pdf_url: data.pdf_url,
          subject_id: data.subject_id,
          subject_name: data.subject_name,
          published: data.published ?? true,
        });
      });
      lesList.sort((a, b) => a.order - b.order);
      setLessons(lesList);
    } catch (err) {
      console.error('[TeacherLessonsScreen] Error fetching curriculum:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCourseId]);

  useEffect(() => {
    loadCurriculum();
  }, [loadCurriculum]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCurriculum();
  };

  // Open modal to create a new lesson in a specific module
  const handleOpenCreateLesson = (moduleId?: string) => {
    setEditingLessonId(null);
    setLessonTitle('');
    setLessonDescription('');
    setLessonDuration('30');
    setLessonOrder(String(lessons.length + 1));
    setLessonModuleId(moduleId || (modules[0]?.id ?? ''));
    setLessonSubjectName(activeSubjects[0]?.name || '');
    setLessonContentUrl('');
    setLessonVideoUrl('');
    setLessonPdfUrl('');
    setLessonPublished(true);
    setLessonModalVisible(true);
  };

  // Open modal to edit an existing lesson
  const handleOpenEditLesson = (lesson: LocalLesson) => {
    setEditingLessonId(lesson.id);
    setLessonTitle(lesson.title);
    setLessonDescription(lesson.description || '');
    setLessonDuration(String(lesson.duration_minutes || 30));
    setLessonOrder(String(lesson.order || 1));
    setLessonModuleId(lesson.module_id);
    setLessonSubjectName(lesson.subject_name || '');
    setLessonContentUrl(lesson.content_url || '');
    setLessonVideoUrl(lesson.video_url || '');
    setLessonPdfUrl(lesson.pdf_url || '');
    setLessonPublished(lesson.published ?? true);
    setLessonModalVisible(true);
  };

  // Save lesson (create or update)
  const handleSaveLesson = async () => {
    if (!lessonTitle.trim()) {
      Alert.alert('Required', 'Please enter a lesson title.');
      return;
    }
    if (!selectedCourseId) {
      Alert.alert('Required', 'No course selected.');
      return;
    }
    if (!lessonModuleId && modules.length === 0) {
      Alert.alert('Required', 'Please create at least one Module/Bab first.');
      return;
    }

    setSavingLesson(true);
    try {
      const selectedSub = activeSubjects.find((s) => s.name === lessonSubjectName);

      const input: CreateLessonInput = {
        courseId: selectedCourseId,
        moduleId: lessonModuleId || modules[0]?.id || 'module_1',
        title: lessonTitle.trim(),
        description: lessonDescription.trim(),
        duration_minutes: parseInt(lessonDuration, 10) || 30,
        order: parseInt(lessonOrder, 10) || 1,
        content_url: lessonContentUrl.trim() || undefined,
        video_url: lessonVideoUrl.trim() || undefined,
        pdf_url: lessonPdfUrl.trim() || undefined,
        subject_id: selectedSub?.id,
        subject_name: lessonSubjectName || undefined,
        published: lessonPublished,
      };

      if (editingLessonId) {
        const res = await updateTeacherLesson(scope, editingLessonId, input, user?.uid || '');
        if (!res.success) {
          Alert.alert('Error', res.error || 'Failed to update lesson.');
          return;
        }
        Alert.alert('Lesson Updated', 'The lesson content has been saved successfully.');
      } else {
        const res = await createTeacherLesson(scope, input, user?.uid || '', profile?.name);
        if (!res.success) {
          Alert.alert('Error', res.error || 'Failed to create lesson.');
          return;
        }
        Alert.alert('Lesson Created', 'The new lesson has been added to the syllabus.');
      }

      setLessonModalVisible(false);
      await loadCurriculum();
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Unable to save lesson.');
    } finally {
      setSavingLesson(false);
    }
  };

  // Create new module
  const handleSaveModule = async () => {
    if (!newModuleTitle.trim()) {
      Alert.alert('Required', 'Please enter a module title.');
      return;
    }
    if (!selectedCourseId) return;

    setSavingModule(true);
    try {
      const res = await createTeacherModule(scope, selectedCourseId, newModuleTitle, modules.length + 1);
      if (!res.success) {
        Alert.alert('Error', res.error || 'Failed to create module.');
        return;
      }
      setNewModuleTitle('');
      setModuleModalVisible(false);
      Alert.alert('Module Created', 'New curriculum module/bab created.');
      await loadCurriculum();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create module.');
    } finally {
      setSavingModule(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => goBackOrReplace(router, '/(tabs)')}
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.textMain} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Curriculum & Lessons</Text>
          <Text style={styles.headerSubtitle}>
            {activeCourse ? activeCourse.name : 'Select Course'} • {lessons.length} Lesson(s)
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addLessonHeaderBtn}
          onPress={() => handleOpenCreateLesson()}
          disabled={!selectedCourseId}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.addLessonHeaderBtnText}>New Lesson</Text>
        </TouchableOpacity>
      </View>

      {/* Course Selection Strip */}
      <View style={styles.courseSelectStrip}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.courseScroll}>
          {scope.assignedCourses.map((c) => {
            const isSelected = selectedCourseId.toLowerCase() === c.id.toLowerCase();
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.coursePill, isSelected && styles.coursePillActive]}
                onPress={() => setSelectedCourseId(c.id)}
              >
                <Ionicons
                  name="book-outline"
                  size={14}
                  color={isSelected ? '#FFFFFF' : COLORS.primary}
                />
                <Text style={[styles.coursePillText, isSelected && styles.coursePillTextActive]}>
                  {c.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Subject Tags for the Active Course */}
      {activeSubjects.length > 0 && (
        <View style={styles.subjectTagsRow}>
          <Text style={styles.subjectTagsLabel}>Your Subjects:</Text>
          {activeSubjects.map((sub) => (
            <View key={sub.id} style={styles.subjectTagPill}>
              <Text style={styles.subjectTagText}>{sub.name}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Curriculum View */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading course syllabus & lessons...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.contentScroll, { paddingBottom: insets.bottom + 30 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Module Add Button */}
          <View style={styles.moduleBar}>
            <Text style={styles.moduleBarTitle}>
              Modules & Chapters ({modules.length})
            </Text>
            <TouchableOpacity
              style={styles.addModuleBtn}
              onPress={() => setModuleModalVisible(true)}
            >
              <Ionicons name="add-circle-outline" size={16} color={COLORS.primary} />
              <Text style={styles.addModuleBtnText}>+ Add Module / Bab</Text>
            </TouchableOpacity>
          </View>

          {/* Modules with their lessons */}
          {modules.length > 0 ? (
            modules.map((mod, modIdx) => {
              const moduleLessons = lessons.filter((l) => l.module_id === mod.id);
              return (
                <View key={mod.id} style={styles.moduleCard}>
                  <View style={styles.moduleHeader}>
                    <View style={styles.moduleBadge}>
                      <Text style={styles.moduleBadgeText}>BAB {modIdx + 1}</Text>
                    </View>
                    <Text style={styles.moduleTitle} numberOfLines={1}>
                      {mod.title}
                    </Text>
                    <TouchableOpacity
                      style={styles.addLessonToModBtn}
                      onPress={() => handleOpenCreateLesson(mod.id)}
                    >
                      <Ionicons name="add" size={16} color={COLORS.primary} />
                    </TouchableOpacity>
                  </View>

                  {/* Lessons list inside this module */}
                  {moduleLessons.length > 0 ? (
                    <View style={styles.lessonsList}>
                      {moduleLessons.map((les) => (
                        <TouchableOpacity
                          key={les.id}
                          style={styles.lessonRow}
                          activeOpacity={0.7}
                          onPress={() => handleOpenEditLesson(les)}
                        >
                          <View style={styles.lessonOrderBox}>
                            <Text style={styles.lessonOrderNum}>{les.order}</Text>
                          </View>

                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={styles.lessonRowTitle} numberOfLines={1}>
                                {les.title}
                              </Text>
                              {!les.published && (
                                <View style={styles.draftBadge}>
                                  <Text style={styles.draftBadgeText}>Draft</Text>
                                </View>
                              )}
                            </View>

                            <View style={styles.lessonMetaRow}>
                              <Text style={styles.lessonMetaText}>
                                {les.duration_minutes ? `${les.duration_minutes}m` : '30m'}
                              </Text>
                              {les.subject_name && (
                                <Text style={styles.lessonSubjectTag}>
                                  • {les.subject_name}
                                </Text>
                              )}
                              {les.video_url && (
                                <Ionicons name="videocam" size={12} color="#2563EB" />
                              )}
                              {les.pdf_url && (
                                <Ionicons name="document-attach" size={12} color="#D97706" />
                              )}
                            </View>
                          </View>

                          <Ionicons name="create-outline" size={18} color={COLORS.textMuted} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.noLessonsInModBox}>
                      <Text style={styles.noLessonsInModText}>No lessons in this module yet.</Text>
                      <TouchableOpacity onPress={() => handleOpenCreateLesson(mod.id)}>
                        <Text style={styles.addFirstLessonText}>+ Add Sabaq / Lesson</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })
          ) : (
            <View style={styles.emptyCurriculumBox}>
              <Ionicons name="library-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No Syllabus Modules Created</Text>
              <Text style={styles.emptySubtitle}>
                Begin by creating your first module/bab (e.g. "Bab 1: Introduction"), then add lessons and attach learning materials.
              </Text>
              <TouchableOpacity
                style={styles.initCurriculumBtn}
                onPress={() => setModuleModalVisible(true)}
              >
                <Ionicons name="add-circle" size={18} color="#FFFFFF" />
                <Text style={styles.initCurriculumBtnText}>Create First Module</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* Lesson Edit/Create Modal */}
      <Modal
        visible={lessonModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLessonModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingLessonId ? 'Edit Lesson' : 'Create New Lesson'}
              </Text>
              <TouchableOpacity onPress={() => setLessonModalVisible(false)}>
                <Ionicons name="close" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 450 }}>
              <View style={styles.formBox}>
                {/* Module Selector */}
                {modules.length > 1 && (
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>MODULE / BAB *</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                      {modules.map((m) => (
                        <TouchableOpacity
                          key={m.id}
                          style={[
                            styles.smallPill,
                            lessonModuleId === m.id && styles.smallPillActive,
                          ]}
                          onPress={() => setLessonModuleId(m.id)}
                        >
                          <Text
                            style={[
                              styles.smallPillText,
                              lessonModuleId === m.id && styles.smallPillTextActive,
                            ]}
                          >
                            {m.title}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Subject Selector */}
                {activeSubjects.length > 0 && (
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>SUBJECT</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                      {activeSubjects.map((sub) => (
                        <TouchableOpacity
                          key={sub.id}
                          style={[
                            styles.smallPill,
                            lessonSubjectName === sub.name && styles.smallPillActive,
                          ]}
                          onPress={() => setLessonSubjectName(sub.name)}
                        >
                          <Text
                            style={[
                              styles.smallPillText,
                              lessonSubjectName === sub.name && styles.smallPillTextActive,
                            ]}
                          >
                            {sub.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Lesson Title */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>LESSON TITLE *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. Sabaq 1: Taaruf wa Makharij al-Huroof"
                    placeholderTextColor={COLORS.textMuted}
                    value={lessonTitle}
                    onChangeText={setLessonTitle}
                  />
                </View>

                {/* Duration & Order Row */}
                <View style={styles.formRow}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.formLabel}>DURATION (MINS)</Text>
                    <TextInput
                      style={styles.textInput}
                      keyboardType="numeric"
                      value={lessonDuration}
                      onChangeText={setLessonDuration}
                    />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.formLabel}>SEQUENCE ORDER</Text>
                    <TextInput
                      style={styles.textInput}
                      keyboardType="numeric"
                      value={lessonOrder}
                      onChangeText={setLessonOrder}
                    />
                  </View>
                </View>

                {/* Description */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>DESCRIPTION / LESSON OBJECTIVES</Text>
                  <TextInput
                    style={[styles.textInput, { height: 75, textAlignVertical: 'top' }]}
                    placeholder="Outline what students will learn in this session..."
                    placeholderTextColor={COLORS.textMuted}
                    multiline
                    value={lessonDescription}
                    onChangeText={setLessonDescription}
                  />
                </View>

                {/* Learning Media & Links */}
                <Text style={[styles.formSectionHeader, { marginTop: 10 }]}>
                  LEARNING MATERIALS & ATTACHMENTS
                </Text>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>VIDEO STREAM URL (OPTIONAL)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="https://youtube.com/... or Google Drive video"
                    placeholderTextColor={COLORS.textMuted}
                    autoCapitalize="none"
                    keyboardType="url"
                    value={lessonVideoUrl}
                    onChangeText={setLessonVideoUrl}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>PDF / KITAB NOTES URL (OPTIONAL)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="https://... PDF reference or textbook page"
                    placeholderTextColor={COLORS.textMuted}
                    autoCapitalize="none"
                    keyboardType="url"
                    value={lessonPdfUrl}
                    onChangeText={setLessonPdfUrl}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>ONLINE AUDIO DARS LINK (OPTIONAL)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="https://... recitation audio or recording"
                    placeholderTextColor={COLORS.textMuted}
                    autoCapitalize="none"
                    keyboardType="url"
                    value={lessonContentUrl}
                    onChangeText={setLessonContentUrl}
                  />
                </View>

                {/* Published Switch */}
                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchLabel}>Published to Students</Text>
                    <Text style={styles.switchSub}>
                      When active, enrolled students can view this lesson in their course
                    </Text>
                  </View>
                  <Switch
                    value={lessonPublished}
                    onValueChange={setLessonPublished}
                    trackColor={{ false: '#E5E7EB', true: COLORS.primary }}
                  />
                </View>

                {/* Save Button */}
                <TouchableOpacity
                  style={[styles.saveBtn, savingLesson && { opacity: 0.7 }]}
                  disabled={savingLesson}
                  onPress={handleSaveLesson}
                >
                  {savingLesson ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="save-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.saveBtnText}>
                        {editingLessonId ? 'Save Changes' : 'Publish Lesson'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Module Create Modal */}
      <Modal
        visible={moduleModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModuleModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.smallModalCard}>
            <Text style={styles.modalTitle}>Add Module / Bab</Text>
            <Text style={styles.modalSubtitle}>
              Group related lessons into a curriculum chapter for {activeCourse?.name}.
            </Text>

            <TextInput
              style={[styles.textInput, { marginTop: 14 }]}
              placeholder="e.g. Bab 2: Ahkam at-Tajweed"
              placeholderTextColor={COLORS.textMuted}
              value={newModuleTitle}
              onChangeText={setNewModuleTitle}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setModuleModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, savingModule && { opacity: 0.7 }]}
                disabled={savingModule}
                onPress={handleSaveModule}
              >
                {savingModule ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Create Module</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  addLessonHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
  },
  addLessonHeaderBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  courseSelectStrip: {
    paddingVertical: 8,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  courseScroll: {
    paddingHorizontal: SPACING.md,
    gap: 8,
  },
  coursePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  coursePillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  coursePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMain,
  },
  coursePillTextActive: {
    color: '#FFFFFF',
  },
  subjectTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    backgroundColor: '#F9FAFB',
    gap: 6,
    flexWrap: 'wrap',
  },
  subjectTagsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  subjectTagPill: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  subjectTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4338CA',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  loadingText: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 12,
  },
  contentScroll: {
    paddingHorizontal: SPACING.md,
    paddingTop: 12,
    gap: 14,
  },
  moduleBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  moduleBarTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  addModuleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addModuleBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  moduleCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  moduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  moduleBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  moduleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  moduleTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  addLessonToModBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lessonsList: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  lessonOrderBox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lessonOrderNum: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  lessonRowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMain,
  },
  draftBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  draftBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#D97706',
  },
  lessonMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  lessonMetaText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  lessonSubjectTag: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '600',
  },
  noLessonsInModBox: {
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  noLessonsInModText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  addFirstLessonText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  emptyCurriculumBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: 30,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textMain,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  initCurriculumBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    marginTop: 18,
  },
  initCurriculumBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  modalSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  formBox: {
    paddingVertical: 12,
    gap: 12,
  },
  formGroup: {
    gap: 4,
  },
  formRow: {
    flexDirection: 'row',
    gap: 10,
  },
  formLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },
  formSectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.textMain,
  },
  smallPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    backgroundColor: '#F3F4F6',
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  smallPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  smallPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  smallPillTextActive: {
    color: '#FFFFFF',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  switchSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    marginTop: 8,
    ...SHADOWS.card,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  smallModalCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 24,
    borderRadius: RADIUS.lg,
    padding: 20,
    alignSelf: 'center',
    width: '90%',
    ...SHADOWS.card,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: '#F3F4F6',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  modalSubmitBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  modalSubmitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
