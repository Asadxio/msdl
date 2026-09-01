import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, ActivityIndicator, Share, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { ScalePressable } from '@/components/ui';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { auth, db } from '@/lib/firebase';
import { apiUrl } from '@/lib/api';
import { getCertificate } from '@/lib/certificateFunctions';
import { useAuth } from '@/context/AuthContext';
import { useData, type Course } from '@/context/DataContext';
import { useRouter } from 'expo-router';
import { IslamicCertificateModal } from '@/components/IslamicCertificateModal';
import type { QuizCertificateData } from '@/lib/quizCertificate';

type Certificate = {
  id: string;
  certificate_id?: string;
  user_name: string;
  course_name: string;
  completion_date: string;
  hijri_date?: string;
  quiz_category?: string;
  score?: number;
  total_questions?: number;
  percentage?: number;
  grade_label?: string;
  type?: string;
};
type AttendanceRow = { status?: string };

export default function CertificateScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();
  const { courses } = useData();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [previewCert, setPreviewCert] = useState<QuizCertificateData | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [quizAttempts, setQuizAttempts] = useState(0);
  const [attendancePct, setAttendancePct] = useState(0);

  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    const ready = { quiz: false, attendance: false, certs: false };
    const finishLoading = () => {
      if (ready.quiz && ready.attendance && ready.certs) setLoading(false);
    };
    const quizUnsub = onSnapshot(query(collection(db, 'quiz_results'), where('user_id', '==', user.uid)), (snap) => {
      setQuizAttempts(snap.size);
      ready.quiz = true;
      finishLoading();
    }, () => {
      ready.quiz = true;
      finishLoading();
    });
    const attendanceUnsub = onSnapshot(query(collection(db, 'attendance'), where('user_id', '==', user.uid)), (snap) => {
      const present = snap.docs.filter((d) => {
        const data = d.data() as AttendanceRow;
        return data.status === 'present';
      }).length;
      setAttendancePct(snap.size ? Math.round((present / snap.size) * 100) : 0);
      ready.attendance = true;
      finishLoading();
    }, () => {
      ready.attendance = true;
      finishLoading();
    });
    const certUnsub = onSnapshot(query(collection(db, 'certificates'), where('user_id', '==', user.uid), orderBy('created_at', 'desc')), (snap) => {
      const arr: Certificate[] = [];
      snap.forEach((d) => {
        const data = d.data() as Partial<Certificate>;
        arr.push({
          id: d.id,
          certificate_id: String(data.certificate_id || d.id),
          user_name: String(data.user_name || ''),
          course_name: String(data.course_name || ''),
          completion_date: String(data.completion_date || ''),
          hijri_date: String(data.hijri_date || ''),
          quiz_category: String(data.quiz_category || ''),
          score: Number(data.score || 0),
          total_questions: Number(data.total_questions || 0),
          percentage: Number(data.percentage || 0),
          grade_label: String(data.grade_label || ''),
          type: String(data.type || 'course_completion'),
        });
      });
      setCerts(arr);
      ready.certs = true;
      finishLoading();
    }, () => {
      ready.certs = true;
      finishLoading();
    });
    return () => {
      quizUnsub();
      attendanceUnsub();
      certUnsub();
    };
  }, [user?.uid]);

  const eligible = useMemo(() => quizAttempts > 0 && attendancePct >= 75, [quizAttempts, attendancePct]);

  const handleOpenCertPreview = (cert: Certificate) => {
    const certData: QuizCertificateData = {
      certificateId: cert.certificate_id || cert.id,
      userId: user?.uid || '',
      studentName: cert.user_name || profile?.name || 'Student',
      quizCategory: cert.quiz_category || cert.course_name || 'Islamic Knowledge',
      score: cert.score || 10,
      totalQuestions: cert.total_questions || 10,
      percentage: cert.percentage || 100,
      issueDateGregorian: cert.completion_date || new Date().toLocaleDateString('en-GB'),
      issueDateHijri: cert.hijri_date || '1447 AH',
      gradeLabel: cert.grade_label || 'Certified (Mumtaz - ممتاز)',
      createdAtMs: Date.now(),
    };
    setPreviewCert(certData);
    setPreviewVisible(true);
  };

  const generateCertificate = async () => {
    if (!user?.uid || !profile?.name || !selectedCourseId) return;
    if (!eligible || generating) return;
    const course = courses.find((c: Course) => c.id === selectedCourseId);
    if (!course) return;
    try {
      setGenerating(true);
      // Stage E: switched from FastAPI fetch to Firebase callable
      // FastAPI route /certificates/generate remains active for rollback
      const certData = await getCertificate(selectedCourseId);
      const certText = `Certificate of Completion\n\nAwarded to: ${profile.name}\nCourse: ${course.name}\nCertificate ID: ${certData.certificateId}\nDate: ${new Date().toDateString()}`;
      await Share.share({ message: certText });
    } catch {
      Alert.alert('Failed', 'Could not generate certificate right now.');
    } finally {
      setGenerating(false);
    }
  };

  const handleShareExistingCert = (cert: Certificate) => {
    handleOpenCertPreview(cert);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* ─── Hero Header ─── */}
      <View style={[styles.heroHeader, { paddingTop: insets.top + 16 }]}>
        <View style={styles.heroContent}>
          <View style={styles.heroIconBadge}>
            <Ionicons name="ribbon" size={28} color="#D97706" />
          </View>
          <View style={styles.heroTextContainer}>
            <Text style={styles.heroTitle}>Certificates</Text>
            <Text style={styles.heroSubtitle}>Generate and share official completion certificates for your courses</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading academic status...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
          
          {/* ─── Statistics Dashboard ─── */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>📊  ACADEMIC ELIGIBILITY</Text>
            <View style={styles.statsGrid}>
              
              {/* Quiz Attempts Stat Box */}
              <View style={styles.statBox}>
                <View style={styles.statHeaderRow}>
                  <View style={[styles.statIconBadge, { backgroundColor: '#EEF2FF' }]}>
                    <Ionicons name="help-circle" size={22} color="#4F46E5" />
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: quizAttempts > 0 ? '#ECFDF5' : '#FEF3C7' }]}>
                    <Text style={[styles.statusBadgeText, { color: quizAttempts > 0 ? '#047857' : '#B45309' }]}>
                      {quizAttempts > 0 ? '✓ Done' : 'Required'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.statValue}>{quizAttempts}</Text>
                <Text style={styles.statLabel}>Quiz Attempts</Text>
              </View>

              {/* Attendance % Stat Box */}
              <View style={styles.statBox}>
                <View style={styles.statHeaderRow}>
                  <View style={[styles.statIconBadge, { backgroundColor: '#ECFDF5' }]}>
                    <Ionicons name="calendar" size={22} color="#10B981" />
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: attendancePct >= 75 ? '#ECFDF5' : '#FEF3C7' }]}>
                    <Text style={[styles.statusBadgeText, { color: attendancePct >= 75 ? '#047857' : '#B45309' }]}>
                      {attendancePct >= 75 ? '✓ On Track' : '>= 75% Needed'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.statValue}>{attendancePct}%</Text>
                <Text style={styles.statLabel}>Attendance</Text>
              </View>

              {/* Overall Eligibility Banner */}
              <View style={[styles.statBoxFull, { borderColor: eligible ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.2)' }]}>
                <View style={[styles.statIconBadge, { backgroundColor: eligible ? '#ECFDF5' : '#FEE2E2' }]}>
                  <Ionicons name={eligible ? "checkmark-circle" : "alert-circle"} size={24} color={eligible ? "#10B981" : "#EF4444"} />
                </View>
                <View style={styles.statFullContent}>
                  <Text style={styles.statValueText}>{eligible ? 'Qualified for Certificates' : 'Eligibility Incomplete'}</Text>
                  <Text style={styles.statSubText}>
                    {eligible ? 'You have met all academic criteria to generate course certificates.' : 'Complete at least 1 quiz and achieve 75% attendance to qualify.'}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: eligible ? '#ECFDF5' : '#FEE2E2' }]}>
                  <Text style={[styles.statusBadgeText, { color: eligible ? '#047857' : '#B91C1C' }]}>
                    {eligible ? 'ELIGIBLE' : 'LOCKED'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* ─── Course Selector ─── */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>📚  SELECT COURSE</Text>
            <View style={styles.card}>
              {courses.length === 0 ? (
                <Text style={styles.empty}>No courses available right now.</Text>
              ) : (
                <View style={styles.courseList}>
                  {courses.map((course: Course) => {
                    const isSelected = selectedCourseId === course.id;
                    return (
                      <ScalePressable
                        key={course.id}
                        style={[styles.courseChip, isSelected && styles.courseChipActive]}
                        onPress={() => setSelectedCourseId(course.id)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: isSelected }}
                        accessibilityLabel={course.name}
                      >
                        <View style={[styles.courseIconBadge, { backgroundColor: isSelected ? '#D1FAE5' : '#F1F5F9' }]}>
                          <Ionicons name="book" size={20} color={isSelected ? '#047857' : '#64748B'} />
                        </View>
                        <Text style={[styles.courseChipText, isSelected && styles.courseChipTextActive]} numberOfLines={2}>
                          {course.name}
                        </Text>
                        <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                          {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                        </View>
                      </ScalePressable>
                    );
                  })}
                </View>
              )}

              {/* Generate & Share CTA */}
              <TouchableOpacity
                style={[styles.btn, (!eligible || !selectedCourseId || generating) && styles.btnDisabled]}
                disabled={!eligible || !selectedCourseId || generating}
                onPress={generateCertificate}
                accessibilityRole="button"
                accessibilityLabel="Generate and Share Certificate"
              >
                {generating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name={!eligible ? "lock-closed-outline" : "ribbon-outline"} size={22} color={(!eligible || !selectedCourseId) ? "#94A3B8" : "#FFFFFF"} />
                )}
                <Text style={[styles.btnText, (!eligible || !selectedCourseId) && styles.btnTextDisabled]}>
                  {generating ? 'Generating Certificate...' : 'Generate & Share Certificate'}
                </Text>
              </TouchableOpacity>
              
              {(!eligible || !selectedCourseId) && (
                <Text style={styles.ctaHelperText}>
                  {!eligible ? '⚠️ Meet eligibility requirements above to unlock certificate generation.' : '💡 Please select a course above to generate your official certificate.'}
                </Text>
              )}

              {/* Verify Any Sanad CTA */}
              <TouchableOpacity
                style={styles.verifySanadBtn}
                onPress={() => router.push('/verify-sanad' as any)}
                activeOpacity={0.8}
              >
                <Ionicons name="shield-checkmark-outline" size={18} color="#005F46" />
                <Text style={styles.verifySanadBtnText}>🔍 Verify Any Sanad Online (تصدیقِ اسناد)</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ─── My Certificates ─── */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>🏆  MY CERTIFICATES</Text>
            {certs.length === 0 ? (
              <View style={styles.emptyCard}>
                <View style={[styles.emptyIconBadge, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="ribbon-outline" size={36} color="#D97706" />
                </View>
                <Text style={styles.emptyTitle}>No Certificates Awarded Yet</Text>
                <Text style={styles.emptyDesc}>
                  Your official completion certificates will appear here once you finish a course and meet the academic eligibility criteria.
                </Text>
                <View style={styles.emptyGuidanceBox}>
                  <Ionicons name="bulb-outline" size={18} color="#D97706" style={{ marginRight: 8 }} />
                  <Text style={styles.emptyGuidanceText}>
                    Complete at least 1 course quiz and maintain 75% attendance to unlock your certificate.
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.certList}>
                {certs.map((cert) => (
                  <TouchableOpacity
                    key={cert.id}
                    style={styles.certCard}
                    onPress={() => handleOpenCertPreview(cert)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`View certificate for ${cert.course_name}`}
                  >
                    <View style={[styles.certIconBadge, { backgroundColor: '#FEF3C7' }]}>
                      <Ionicons name="trophy" size={24} color="#D97706" />
                    </View>
                    <View style={styles.certContent}>
                      <Text style={styles.certCourseName} numberOfLines={2}>{cert.course_name}</Text>
                      <Text style={styles.certUserName} numberOfLines={1}>Awarded to: {cert.user_name || profile?.name || 'Student'}</Text>
                      <View style={styles.certDateRow}>
                        <Ionicons name="calendar-outline" size={12} color={COLORS.textMuted} style={{ marginRight: 4 }} />
                        <Text style={styles.certDateText}>{cert.completion_date || 'Completed'}</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.certShareBtn}
                      onPress={() => handleOpenCertPreview(cert)}
                      accessibilityRole="button"
                      accessibilityLabel={`View and Share certificate for ${cert.course_name}`}
                    >
                      <Ionicons name="eye-outline" size={20} color="#0FA958" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

        </ScrollView>
      )}

      <IslamicCertificateModal
        visible={previewVisible}
        certificate={previewCert}
        onClose={() => setPreviewVisible(false)}
      />
    </View>
  );
}

const CARD_RADIUS = 20;
const CARD_BORDER = 'rgba(15, 23, 42, 0.06)';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  loadingText: { marginTop: 12, fontSize: 14, color: '#64748B', fontWeight: '500' },

  /* Hero Header */
  heroHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: CARD_BORDER,
    ...SHADOWS.card,
    shadowOpacity: 0.04,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroIconBadge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  heroTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },

  /* Body & Sections */
  body: { paddingHorizontal: 16, paddingTop: 20, gap: 24 },
  sectionBlock: { gap: 12 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginLeft: 4,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  /* Stats Dashboard */
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  statBox: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: CARD_RADIUS,
    padding: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    ...SHADOWS.card,
    shadowOpacity: 0.05,
    minHeight: 112,
    justifyContent: 'space-between',
  },
  statHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statBoxFull: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: CARD_RADIUS,
    padding: 16,
    borderWidth: 1.5,
    ...SHADOWS.card,
    shadowOpacity: 0.05,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statFullContent: {
    flex: 1,
    justifyContent: 'center',
  },
  statValueText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  statSubText: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },

  /* Standard Card */
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: CARD_RADIUS,
    padding: 20,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    ...SHADOWS.card,
    shadowOpacity: 0.05,
    gap: 16,
  },
  courseList: {
    gap: 12,
  },
  courseChip: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    minHeight: 56,
  },
  courseChipActive: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  courseIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  courseChipText: {
    flex: 1,
    color: '#334155',
    fontSize: 15,
    fontWeight: '600',
  },
  courseChipTextActive: {
    color: '#065F46',
    fontWeight: '700',
  },
  radioCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  radioCircleActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },

  /* Button */
  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 56,
    width: '100%',
    ...SHADOWS.card,
    shadowOpacity: 0.1,
  },
  btnDisabled: {
    backgroundColor: '#E2E8F0',
    shadowOpacity: 0,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  btnTextDisabled: {
    color: '#94A3B8',
  },
  ctaHelperText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },

  /* My Certificates List */
  certList: {
    gap: 12,
  },
  certCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: CARD_RADIUS,
    padding: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    ...SHADOWS.card,
    shadowOpacity: 0.05,
    minHeight: 80,
  },
  certIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  certContent: {
    flex: 1,
    justifyContent: 'center',
  },
  certCourseName: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  certUserName: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
  },
  certDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  certDateText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '400',
  },
  certShareBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },

  /* Empty State */
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: CARD_RADIUS,
    padding: 24,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    ...SHADOWS.card,
    shadowOpacity: 0.05,
    alignItems: 'center',
    textAlign: 'center',
  },
  emptyIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    maxWidth: 320,
  },
  emptyGuidanceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    width: '100%',
  },
  emptyGuidanceText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    fontWeight: '600',
    lineHeight: 18,
  },
  empty: {
    color: COLORS.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 12,
  },
  verifySanadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5EE',
    borderWidth: 1.5,
    borderColor: '#005F46',
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
    gap: 8,
    marginTop: 10,
  },
  verifySanadBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#005F46',
  },
});
