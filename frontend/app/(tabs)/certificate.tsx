import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, ActivityIndicator, Share, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { auth, db } from '@/lib/firebase';
import { apiUrl } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';

type Certificate = { id: string; user_name: string; course_name: string; completion_date: string };
type AttendanceRow = { status?: string };

export default function CertificateScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const { courses } = useData();
  const [loading, setLoading] = useState(true);
  const [certs, setCerts] = useState<Certificate[]>([]);
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
          user_name: String(data.user_name || ''),
          course_name: String(data.course_name || ''),
          completion_date: String(data.completion_date || ''),
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

  const generateCertificate = async () => {
    if (!user?.uid || !profile?.name || !selectedCourseId) return;
    if (!eligible) return;
    const course = courses.find((c) => c.id === selectedCourseId);
    if (!course) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(apiUrl('/certificates/generate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
        body: JSON.stringify({ course_id: selectedCourseId }),
      });
      if (!res.ok) throw new Error(`certificate_generate_failed_${res.status}`);
      const certText = `Certificate of Completion\n\nAwarded to: ${profile.name}\nCourse: ${course.name}\nDate: ${new Date().toDateString()}`;
      await Share.share({ message: certText });
    } catch {
      Alert.alert('Failed', 'Could not generate certificate right now.');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Certificates</Text>
        <Text style={styles.subtitle}>Generate and share completion certificates</Text>
      </View>
      {loading ? <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View> : (
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.card}>
            <Text style={styles.meta}>Quiz attempts: {quizAttempts}</Text>
            <Text style={styles.meta}>Attendance: {attendancePct}%</Text>
            <Text style={[styles.meta, !eligible && { color: COLORS.error }]}>Eligibility: {eligible ? 'Qualified' : 'Need quiz + 75% attendance'}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.meta}>Select Course</Text>
            {courses.map((course) => (
              <TouchableOpacity key={course.id} style={[styles.chip, selectedCourseId === course.id && styles.chipActive]} onPress={() => setSelectedCourseId(course.id)}>
                <Text style={[styles.chipText, selectedCourseId === course.id && styles.chipTextActive]}>{course.name}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.btn, (!eligible || !selectedCourseId) && { opacity: 0.5 }]} disabled={!eligible || !selectedCourseId} onPress={generateCertificate}>
              <Text style={styles.btnText}>Generate & Share Certificate</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.meta}>My Certificates</Text>
            {certs.length === 0 ? <Text style={styles.empty}>No certificates yet.</Text> : certs.map((cert) => (
              <View key={cert.id} style={styles.certRow}>
                <Text style={styles.certTitle}>{cert.course_name}</Text>
                <Text style={styles.certSub}>{cert.completion_date}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.surface, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border, ...SHADOWS.header },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.primary },
  subtitle: { fontSize: 13, color: COLORS.textMuted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: SPACING.md, gap: 10, paddingBottom: 20 },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.md, ...SHADOWS.card, gap: 8 },
  meta: { color: COLORS.textMain, fontSize: 13, fontWeight: '600' },
  chip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, paddingHorizontal: 10, paddingVertical: 8 },
  chipActive: { borderColor: COLORS.primary, backgroundColor: '#EEF6F2' },
  chipText: { color: COLORS.textMain, fontSize: 13 },
  chipTextActive: { color: COLORS.primary, fontWeight: '700' },
  btn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontWeight: '700' },
  certRow: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8 },
  certTitle: { color: COLORS.textMain, fontWeight: '700' },
  certSub: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  empty: { color: COLORS.textMuted, fontSize: 13 },
});
