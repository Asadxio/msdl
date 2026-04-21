import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  StatusBar,
  Linking,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { WebView } from 'react-native-webview';
import { COLORS, SPACING, RADIUS, SHADOWS, getCourseImage, getTeacherAvatar } from '@/constants/theme';
import { useData } from '@/context/DataContext';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ScalePressable } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { uploadUriFile } from '@/lib/storage';

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const courseId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    courses, teachers, loading, getModulesForCourse, getLessonsForModule, lessonProgress,
    markLessonComplete, markLessonOpened, getAssignmentsForLesson, getSubmissionForAssignment,
    getSubmissionsForAssignment, submitAssignment, reviewSubmission,
  } = useData();
  const { user, profile } = useAuth();
  const [recordings, setRecordings] = useState<{ id: string; title: string; description: string; file_url: string; lesson_id?: string }[]>([]);
  const [expandedLessonId, setExpandedLessonId] = useState<string | null>(null);
  const [playerVisible, setPlayerVisible] = useState(false);
  const [playerUrl, setPlayerUrl] = useState('');

  const [activeAssignmentId, setActiveAssignmentId] = useState<string>('');
  const [submissionModalVisible, setSubmissionModalVisible] = useState(false);
  const [submittingAssignment, setSubmittingAssignment] = useState(false);
  const [submissionText, setSubmissionText] = useState('');
  const [selectedUpload, setSelectedUpload] = useState<{ uri: string; name: string; mimeType?: string } | null>(null);
  const [externalFileUrl, setExternalFileUrl] = useState('');

  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [activeSubmissionId, setActiveSubmissionId] = useState('');
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [reviewGrade, setReviewGrade] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [fatalError, setFatalError] = useState<string>('');

  const course = courses.find((c) => c.id === courseId);
  const classTimeLabel = course?.class_time || course?.time || '';
  const meetLink = course?.meet_link || course?.class_link || '';
  const isReviewer = profile?.role === 'admin' || profile?.role === 'teacher';

  useEffect(() => {
    if (!courseId) return;
    try {
      const q = query(collection(db, 'recordings'), where('course_id', '==', courseId));
      const unsub = onSnapshot(q, (snap) => {
        const arr: { id: string; title: string; description: string; file_url: string; lesson_id?: string }[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
        setRecordings(arr);
      }, () => {
        setRecordings([]);
      });
      return unsub;
    } catch {
      setRecordings([]);
      setFatalError('Unable to load course recordings.');
      return () => {};
    }
  }, [courseId]);

  const showJoinNow = useMemo(() => {
    if (!classTimeLabel) return true;
    const [hh, mm] = classTimeLabel.split(':').map((n) => Number(n));
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return true;
    const now = new Date();
    const slot = new Date();
    slot.setHours(hh, mm, 0, 0);
    return Math.abs(now.getTime() - slot.getTime()) <= 60 * 60 * 1000;
  }, [classTimeLabel]);
  const modules = useMemo(() => (course ? getModulesForCourse(course.id) : []), [course, getModulesForCourse]);
  const generalRecordings = useMemo(() => recordings.filter((r) => !r.lesson_id), [recordings]);
  const safeModules = Array.isArray(modules) ? modules : [];

  const toEmbeddableUrl = (url: string): string => {
    const clean = url.trim();
    if (!clean) return clean;
    const youtubeWatchMatch = clean.match(/youtube\.com\/watch\?v=([^&]+)/i);
    if (youtubeWatchMatch?.[1]) return `https://www.youtube.com/embed/${youtubeWatchMatch[1]}`;
    const youtubeShortMatch = clean.match(/youtu\.be\/([^?&]+)/i);
    if (youtubeShortMatch?.[1]) return `https://www.youtube.com/embed/${youtubeShortMatch[1]}`;
    const driveMatch = clean.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
    if (driveMatch?.[1]) return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
    return clean;
  };

  const openRecordingPlayer = (url: string) => {
    try {
      const embedUrl = toEmbeddableUrl(url);
      if (!embedUrl) return;
      setPlayerUrl(embedUrl);
      setPlayerVisible(true);
    } catch {
      Alert.alert('Error', 'Unable to open recording right now.');
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading course...</Text>
        </View>
      </View>
    );
  }

  if (fatalError) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.errorBackBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textMain} />
          <Text style={styles.errorBackText}>Go Back</Text>
        </TouchableOpacity>
        <Text style={styles.errorText}>{fatalError}</Text>
      </View>
    );
  }

  if (!course) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.errorBackBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textMain} />
          <Text style={styles.errorBackText}>Go Back</Text>
        </TouchableOpacity>
        <Text style={styles.errorText}>Course not found</Text>
      </View>
    );
  }

  const teacher = teachers.find((t) => (course.teacher_name || '').includes((t.name || '').split(' ').slice(-2).join(' ')));
  const courseIndex = courses.findIndex((c) => c.id === courseId);

  const handleJoinClass = () => {
    try {
      if (meetLink && meetLink.trim().length > 0) {
        Linking.openURL(meetLink).catch(() => {
          Alert.alert('Error', 'Unable to open the class link');
        });
      } else {
        Alert.alert(
          'Join Class',
          'Class link will be shared by teacher',
          [{ text: 'OK', style: 'default' }]
        );
      }
    } catch {
      Alert.alert('Error', 'Unable to open class right now.');
    }
  };

  const openSubmissionModal = (assignmentId: string) => {
    try {
      if (!assignmentId) return;
      const current = getSubmissionForAssignment(assignmentId);
      setActiveAssignmentId(assignmentId);
      setSubmissionText(current?.text_answer || '');
      setSelectedUpload(current?.file_url ? { uri: current.file_url, name: 'Existing file' } : null);
      setExternalFileUrl(current?.file_url || '');
      setSubmissionModalVisible(true);
    } catch {
      Alert.alert('Error', 'Unable to open assignment submission.');
    }
  };

  const pickSubmissionFile = async () => {
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
      });
      const file = picked?.assets?.[0];
      if (picked?.canceled || !file?.uri) return;
      setSelectedUpload({
        uri: file.uri,
        name: file.fileName || 'submission-image',
        mimeType: file.mimeType || 'image/jpeg',
      });
      setExternalFileUrl('');
    } catch {
      Alert.alert('Error', 'Unable to pick file right now.');
    }
  };

  const submitAssignmentHandler = async () => {
    if (!activeAssignmentId) return;
    if (!submissionText.trim() && !selectedUpload && !externalFileUrl.trim()) {
      Alert.alert('Missing data', 'Please add a text answer, image upload, or file URL.');
      return;
    }
    setSubmittingAssignment(true);
    try {
      let fileUrl = '';
      if (externalFileUrl.trim()) {
        fileUrl = externalFileUrl.trim();
      } else if (selectedUpload?.uri) {
        fileUrl = selectedUpload.uri;
        if (!selectedUpload.uri.startsWith('http')) {
          fileUrl = await uploadUriFile({
            uri: selectedUpload.uri,
            path: `assignment_submissions/${user?.uid || 'anonymous'}/${Date.now()}_${selectedUpload.name}`,
            contentType: selectedUpload.mimeType,
          });
        }
      }
      const ok = await submitAssignment({
        assignmentId: activeAssignmentId,
        textAnswer: submissionText.trim(),
        fileUrl,
      });
      if (ok) {
        Alert.alert('Submitted', 'Assignment submitted successfully.');
        setSubmissionModalVisible(false);
      } else {
        Alert.alert('Error', 'Unable to submit assignment. Please try again.');
      }
    } finally {
      setSubmittingAssignment(false);
    }
  };

  const openReviewModal = (submissionId: string, feedback?: string, grade?: string) => {
    setActiveSubmissionId(submissionId);
    setReviewFeedback(feedback || '');
    setReviewGrade(grade || '');
    setReviewModalVisible(true);
  };

  const reviewSubmissionHandler = async () => {
    if (!activeSubmissionId) return;
    if (!reviewFeedback.trim()) {
      Alert.alert('Missing feedback', 'Please enter feedback before reviewing.');
      return;
    }
    setReviewing(true);
    try {
      const ok = await reviewSubmission({
        submissionId: activeSubmissionId,
        feedback: reviewFeedback.trim(),
        grade: reviewGrade.trim(),
      });
      if (ok) {
        Alert.alert('Reviewed', 'Feedback and marks saved.');
        setReviewModalVisible(false);
      } else {
        Alert.alert('Error', 'Unable to review submission.');
      }
    } finally {
      setReviewing(false);
    }
  };

  const safePush = (path: string) => {
    try {
      if (!path) return;
      router.push(path as any);
    } catch {
      // no-op: keep app responsive
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.heroWrapper}>
          <Image source={{ uri: getCourseImage(courseIndex) }} style={styles.heroImage} />
          <LinearGradient
            colors={['rgba(15,56,34,0.3)', 'rgba(15,56,34,0.95)']}
            style={styles.heroGradient}
          />
          <TouchableOpacity
            style={[styles.backBtn, { top: insets.top + 10 }]}
            onPress={() => router.back()}
            testID="course-detail-back-btn"
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>{course.name}</Text>
          </View>
        </View>

        <View style={styles.body}>
          <TouchableOpacity
            style={styles.teacherCard}
            testID="course-detail-teacher-link"
            activeOpacity={0.8}
            onPress={() => {
              if (teacher?.id) safePush(`/teacher/${teacher.id}`);
            }}
          >
            {teacher && (
              <Image source={{ uri: getTeacherAvatar(teacher.id) }} style={styles.teacherAvatar} />
            )}
            <View style={styles.teacherInfo}>
              <Text style={styles.teacherLabel}>Instructor</Text>
              <Text style={styles.teacherNameText}>{course.teacher_name}</Text>
            </View>
            {teacher && <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />}
          </TouchableOpacity>

          <View style={styles.infoCard} testID="course-detail-schedule">
            <View style={styles.infoCardHeader}>
              <View style={styles.iconCircle}>
                <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.infoCardTitle}>Schedule</Text>
            </View>
            <Text style={styles.infoCardValue}>{course.schedule || 'Schedule to be announced'}</Text>
            <Text style={styles.infoCardSubValue}>{classTimeLabel || 'Time to be announced'}</Text>
          </View>

          <View style={styles.infoCard} testID="course-detail-meet-link">
            <View style={styles.infoCardHeader}>
              <View style={styles.iconCircle}>
                <Ionicons name="videocam-outline" size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.infoCardTitle}>Google Meet Link</Text>
            </View>
            <Text style={styles.infoCardValue} numberOfLines={2}>
              {meetLink || 'Meet link will be shared by teacher'}
            </Text>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoCardHeader}>
              <View style={styles.iconCircle}>
                <Ionicons name="mic-outline" size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.infoCardTitle}>Recordings</Text>
            </View>
            {generalRecordings.length === 0 ? (
              <Text style={styles.infoCardSubValue}>No recordings yet.</Text>
            ) : generalRecordings.map((rec) => (
              <TouchableOpacity key={rec.id} style={styles.recordingRow} onPress={() => openRecordingPlayer(rec.file_url)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recordingTitle}>{rec.title || 'Recording'}</Text>
                  <Text style={styles.recordingDesc}>{rec.description || 'Tap to play'}</Text>
                </View>
                <Ionicons name="play-circle-outline" size={22} color={COLORS.primary} />
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.infoCard} testID="course-learning-structure">
            <View style={styles.infoCardHeader}>
              <View style={styles.iconCircle}>
                <Ionicons name="layers-outline" size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.infoCardTitle}>Learning Path</Text>
            </View>
            {safeModules.length === 0 ? (
              <Text style={styles.infoCardSubValue}>No modules added yet.</Text>
            ) : safeModules.map((module) => {
              const moduleLessons = getLessonsForModule(module.id);
              const completedCount = moduleLessons.filter((lesson) => lessonProgress[lesson.id]?.completed).length;
              return (
                <View key={module.id} style={styles.moduleBlock}>
                  <Text style={styles.moduleTitle}>{module.title}</Text>
                  <Text style={styles.moduleMeta}>{completedCount}/{moduleLessons.length} completed</Text>
                  {moduleLessons.map((lesson) => {
                    const done = !!lessonProgress[lesson.id]?.completed;
                    const lessonAssignments = getAssignmentsForLesson(lesson.id);
                    const isExpanded = expandedLessonId === lesson.id;
                    const lessonRecordings = recordings.filter((rec) => rec.lesson_id === lesson.id);
                    return (
                      <View key={lesson.id}>
                        <ScalePressable
                          style={[styles.lessonRow, done && styles.lessonRowDone]}
                          onPress={async () => {
                            await markLessonOpened(lesson);
                            setExpandedLessonId((prev) => (prev === lesson.id ? null : lesson.id));
                          }}
                          testID={`lesson-${lesson.id}`}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.lessonTitle}>{lesson.title}</Text>
                            <Text style={styles.lessonMeta}>{lesson.duration_minutes ? `${lesson.duration_minutes} min` : 'Tap to open lesson'}</Text>
                          </View>
                          <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.textMuted} />
                          <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={done ? COLORS.primary : COLORS.textMuted} />
                        </ScalePressable>
                        {isExpanded ? (
                          <View style={styles.lessonDetailCard}>
                            <TouchableOpacity
                              style={styles.completeBtn}
                              onPress={() => markLessonComplete(lesson)}
                            >
                              <Ionicons name="checkmark-done" size={16} color="#fff" />
                              <Text style={styles.completeBtnText}>{done ? 'Completed' : 'Mark lesson complete'}</Text>
                            </TouchableOpacity>
                            <View style={styles.lessonRecordingBlock}>
                              <Text style={styles.lessonRecordingTitle}>Class Recordings</Text>
                              {lessonRecordings.length === 0 ? (
                                <Text style={styles.infoCardSubValue}>No recording attached to this lesson yet.</Text>
                              ) : lessonRecordings.map((rec) => (
                                <TouchableOpacity key={rec.id} style={styles.recordingRow} onPress={() => openRecordingPlayer(rec.file_url)}>
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.recordingTitle}>{rec.title || 'Recording'}</Text>
                                    <Text style={styles.recordingDesc}>{rec.description || 'Tap to play'}</Text>
                                  </View>
                                  <Ionicons name="play-circle-outline" size={22} color={COLORS.primary} />
                                </TouchableOpacity>
                              ))}
                            </View>
                            {lessonAssignments.length === 0 ? (
                              <Text style={styles.infoCardSubValue}>No assignments in this lesson yet.</Text>
                            ) : lessonAssignments.map((assignment) => {
                              const mySubmission = getSubmissionForAssignment(assignment.id);
                              const assignmentSubmissions = isReviewer ? getSubmissionsForAssignment(assignment.id) : [];
                              return (
                                <View key={assignment.id} style={styles.assignmentCard}>
                                  <Text style={styles.assignmentTitle}>{assignment.title}</Text>
                                  <Text style={styles.assignmentDesc}>{assignment.description || 'No description provided.'}</Text>
                                  {assignment.due_date ? <Text style={styles.assignmentDue}>Due: {assignment.due_date}</Text> : null}
                                  {assignment.file_url ? (
                                    <TouchableOpacity onPress={() => Linking.openURL(assignment.file_url || '').catch(() => {})}>
                                      <Text style={styles.assignmentLink}>Open assignment file</Text>
                                    </TouchableOpacity>
                                  ) : null}
                                  {!isReviewer ? (
                                    <View style={styles.studentSubmissionBlock}>
                                      <Text style={styles.assignmentStatus}>Status: {mySubmission?.status || 'not_submitted'}</Text>
                                      {mySubmission?.feedback ? <Text style={styles.assignmentFeedback}>Feedback: {mySubmission.feedback}</Text> : null}
                                      {mySubmission?.grade ? <Text style={styles.assignmentGrade}>Marks: {mySubmission.grade}</Text> : null}
                                      <TouchableOpacity style={styles.assignmentActionBtn} onPress={() => openSubmissionModal(assignment.id)}>
                                        <Text style={styles.assignmentActionText}>{mySubmission ? 'Update submission' : 'Submit assignment'}</Text>
                                      </TouchableOpacity>
                                    </View>
                                  ) : (
                                    <View style={styles.reviewerBlock}>
                                      <Text style={styles.assignmentStatus}>Submissions: {assignmentSubmissions.length}</Text>
                                      {assignmentSubmissions.length === 0 ? <Text style={styles.infoCardSubValue}>No student submissions yet.</Text> : null}
                                      {assignmentSubmissions.slice(0, 6).map((submission) => (
                                        <View key={submission.id} style={styles.reviewerSubmissionRow}>
                                          <View style={{ flex: 1 }}>
                                            <Text style={styles.reviewerSubmissionMeta}>Student: {submission.user_id}</Text>
                                            <Text style={styles.reviewerSubmissionMeta}>Status: {submission.status}</Text>
                                            {submission.text_answer ? <Text style={styles.reviewerSubmissionText} numberOfLines={2}>{submission.text_answer}</Text> : null}
                                            {submission.file_url ? (
                                              <TouchableOpacity onPress={() => Linking.openURL(submission.file_url || '').catch(() => {})}>
                                                <Text style={styles.assignmentLink}>Open submitted file</Text>
                                              </TouchableOpacity>
                                            ) : null}
                                            {submission.feedback ? <Text style={styles.assignmentFeedback}>Feedback: {submission.feedback}</Text> : null}
                                            {submission.grade ? <Text style={styles.assignmentGrade}>Marks: {submission.grade}</Text> : null}
                                          </View>
                                          <TouchableOpacity
                                            style={styles.reviewBtn}
                                            onPress={() => openReviewModal(submission.id, submission.feedback, submission.grade)}
                                          >
                                            <Text style={styles.reviewBtnText}>{submission.status === 'reviewed' ? 'Edit Review' : 'Review'}</Text>
                                          </TouchableOpacity>
                                        </View>
                                      ))}
                                    </View>
                                  )}
                                </View>
                              );
                            })}
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </View>

          <View style={styles.infoCard} testID="course-detail-description">
            <View style={styles.infoCardHeader}>
              <View style={styles.iconCircle}>
                <Ionicons name="document-text-outline" size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.infoCardTitle}>About this Course</Text>
            </View>
            <Text style={styles.descriptionText}>{course.description || 'Course details coming soon.'}</Text>
          </View>

          {showJoinNow ? (
            <TouchableOpacity
              style={styles.joinBtn}
              testID="join-class-btn"
              activeOpacity={0.8}
              onPress={handleJoinClass}
            >
              <Ionicons name="videocam" size={20} color="#FFFFFF" />
              <Text style={styles.joinBtnText}>Join Class</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.joinLaterCard}>
              <Text style={styles.infoCardSubValue}>Next class at {classTimeLabel}. Join button appears 1 hour before class.</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={submissionModalVisible} transparent animationType="slide" onRequestClose={() => setSubmissionModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Submit Assignment</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              value={submissionText}
              onChangeText={setSubmissionText}
              placeholder="Write your answer..."
              multiline
            />
            <TouchableOpacity style={styles.secondaryModalBtn} onPress={pickSubmissionFile}>
              <Text style={styles.secondaryModalBtnText}>
                {selectedUpload ? `Image: ${selectedUpload.name}` : 'Upload Image'}
              </Text>
            </TouchableOpacity>
            <TextInput
              style={styles.modalInput}
              value={externalFileUrl}
              onChangeText={setExternalFileUrl}
              placeholder="Or paste PDF/Image URL"
              autoCapitalize="none"
            />
            <View style={styles.modalActionRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setSubmissionModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSubmitBtn} onPress={submitAssignmentHandler} disabled={submittingAssignment}>
                {submittingAssignment ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalSubmitText}>Submit</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={reviewModalVisible} transparent animationType="slide" onRequestClose={() => setReviewModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Review Submission</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              value={reviewFeedback}
              onChangeText={setReviewFeedback}
              placeholder="Write feedback..."
              multiline
            />
            <TextInput
              style={styles.modalInput}
              value={reviewGrade}
              onChangeText={setReviewGrade}
              placeholder="Marks / Grade (optional)"
            />
            <View style={styles.modalActionRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setReviewModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSubmitBtn} onPress={reviewSubmissionHandler} disabled={reviewing}>
                {reviewing ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalSubmitText}>Save Review</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={playerVisible} animationType="slide" onRequestClose={() => setPlayerVisible(false)}>
        <View style={styles.playerContainer}>
          <View style={[styles.playerTopBar, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity style={styles.playerCloseBtn} onPress={() => setPlayerVisible(false)}>
              <Ionicons name="close" size={20} color={COLORS.textMain} />
            </TouchableOpacity>
            <Text style={styles.playerTitle}>Class Recording</Text>
            <View style={{ width: 36 }} />
          </View>
          {playerUrl ? (
            <WebView source={{ uri: playerUrl }} style={styles.playerWebView} allowsFullscreenVideo />
          ) : (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Unable to load recording.</Text>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  loadingText: { fontSize: 14, color: COLORS.textMuted, fontWeight: '500' },
  errorBackBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: SPACING.lg },
  errorBackText: { fontSize: 15, fontWeight: '600', color: COLORS.textMain },
  errorText: { fontSize: 16, color: COLORS.textMuted, textAlign: 'center', marginTop: 40 },

  heroWrapper: { position: 'relative', height: 270 },
  heroImage: { width: '100%', height: '100%' },
  heroGradient: { ...StyleSheet.absoluteFillObject },
  backBtn: {
    position: 'absolute',
    left: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  heroContent: { position: 'absolute', left: 20, right: 20, bottom: 24 },
  heroTitle: { color: '#fff', fontSize: 26, fontWeight: '800' },

  body: { padding: SPACING.lg, gap: SPACING.md },

  teacherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: 12,
    ...SHADOWS.card,
  },
  teacherAvatar: { width: 48, height: 48, borderRadius: 24 },
  teacherInfo: { flex: 1 },
  teacherLabel: { color: COLORS.textMuted, fontSize: 12 },
  teacherNameText: { color: COLORS.textMain, fontSize: 15, fontWeight: '700' },

  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: 14,
    gap: 8,
    ...SHADOWS.card,
  },
  infoCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5EE',
  },
  infoCardTitle: { color: COLORS.textMain, fontWeight: '700', fontSize: 15 },
  infoCardValue: { color: COLORS.textMain, fontSize: 14, fontWeight: '600' },
  infoCardSubValue: { color: COLORS.textMuted, fontSize: 12 },

  moduleBlock: { marginTop: 8 },
  moduleTitle: { color: COLORS.textMain, fontWeight: '700', fontSize: 14 },
  moduleMeta: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.surfaceAlt,
    marginTop: 8,
  },
  lessonRowDone: { borderColor: '#CFE9DB', backgroundColor: '#F4FBF7' },
  lessonTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textMain },
  lessonMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  lessonDetailCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, backgroundColor: COLORS.surface, marginTop: 8, padding: 10, gap: 8 },
  completeBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 9, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  completeBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  lessonRecordingBlock: { marginTop: 4, gap: 4 },
  lessonRecordingTitle: { color: COLORS.textMain, fontSize: 13, fontWeight: '700' },

  assignmentCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: 10, backgroundColor: COLORS.surfaceAlt, gap: 4 },
  assignmentTitle: { color: COLORS.textMain, fontWeight: '700', fontSize: 14 },
  assignmentDesc: { color: COLORS.textMuted, fontSize: 12 },
  assignmentDue: { color: COLORS.goldText, fontSize: 12, fontWeight: '600' },
  assignmentLink: { color: COLORS.primary, fontSize: 12, fontWeight: '700', marginTop: 2 },
  assignmentStatus: { color: COLORS.textMain, fontSize: 12, fontWeight: '600', marginTop: 4 },
  assignmentFeedback: { color: COLORS.textMain, fontSize: 12, marginTop: 2 },
  assignmentGrade: { color: COLORS.primary, fontSize: 12, fontWeight: '700', marginTop: 2 },
  studentSubmissionBlock: { marginTop: 4, gap: 4 },
  assignmentActionBtn: { marginTop: 4, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 8, paddingHorizontal: 10, alignSelf: 'flex-start' },
  assignmentActionText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  reviewerBlock: { marginTop: 6, gap: 8 },
  reviewerSubmissionRow: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 8, flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: COLORS.surface },
  reviewerSubmissionMeta: { color: COLORS.textMuted, fontSize: 11 },
  reviewerSubmissionText: { color: COLORS.textMain, fontSize: 12, marginTop: 2 },
  reviewBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 6, paddingHorizontal: 8 },
  reviewBtnText: { color: '#fff', fontWeight: '700', fontSize: 11 },

  descriptionText: { marginTop: 4, fontSize: 14, color: COLORS.textMuted, lineHeight: 21 },
  joinBtn: {
    marginTop: 18,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xl,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    ...SHADOWS.card,
  },
  joinBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  joinLaterCard: { marginTop: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.lg, padding: 12 },

  recordingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: 10,
    backgroundColor: COLORS.surfaceAlt,
    marginTop: 8,
  },
  recordingTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textMain },
  recordingDesc: { fontSize: 12, color: COLORS.textMuted },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.md, gap: 10 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textMain },
  modalInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 10, color: COLORS.textMain, backgroundColor: COLORS.surfaceAlt },
  modalTextArea: { minHeight: 90, textAlignVertical: 'top' },
  secondaryModalBtn: { borderWidth: 1, borderColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 10, alignItems: 'center' },
  secondaryModalBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  modalActionRow: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingVertical: 11, alignItems: 'center' },
  modalCancelText: { color: COLORS.textMain, fontWeight: '700' },
  modalSubmitBtn: { flex: 1, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 11, alignItems: 'center' },
  modalSubmitText: { color: '#fff', fontWeight: '700' },
  playerContainer: { flex: 1, backgroundColor: '#000' },
  playerTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: 8,
    backgroundColor: COLORS.surface,
  },
  playerCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceAlt,
  },
  playerTitle: { color: COLORS.textMain, fontWeight: '700', fontSize: 15 },
  playerWebView: { flex: 1, backgroundColor: '#000' },
});
