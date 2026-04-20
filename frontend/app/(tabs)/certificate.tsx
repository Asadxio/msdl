import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, ActivityIndicator, Share, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp, where } from 'firebase/firestore';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';

type Certificate = { id: string; user_name: string; course_name: string; completion_date: string };

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
    const load = async () => {
      if (!user?.uid) return;
      setLoading(true);
      const [quizSnap, attendanceSnap, certSnap] = await Promise.all([
        getDocs(query(collection(db, 'quiz_results'), where('user_id', '==', user.uid))),
        getDocs(query(collection(db, 'attendance'), where('user_id', '==', user.uid))),
        getDocs(query(collection(db, 'certificates'), where('user_id', '==', user.uid), orderBy('created_at', 'desc'))),
      ]);
      const present = attendanceSnap.docs.filter((d) => (d.data() as any).status === 'present').length;
      setQuizAttempts(quizSnap.size);
      setAttendancePct(attendanceSnap.size ? Math.round((present / attendanceSnap.size) * 100) : 0);
      const arr: Certificate[] = [];
      certSnap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
      setCerts(arr);
      setLoading(false);
    };
    load().catch(() => setLoading(false));
  }, [user?.uid]);

  const eligible = useMemo(() => quizAttempts > 0 && attendancePct >= 75, [quizAttempts, attendancePct]);

  const generateCertificate = async () => {
    if (!user?.uid || !profile?.name || !selectedCourseId) return;
    if (!eligible) return;
    const course = courses.find((c) => c.id === selectedCourseId);
    if (!course) return;
    await addDoc(collection(db, 'certificates'), {
      user_id: user.uid,
      user_name: profile.name,
      course_name: course.name,
      completion_date: new Date().toISOString().slice(0, 10),
      created_at: serverTimestamp(),
    });
    const certText = `Certificate of Completion\n\nAwarded to: ${profile.name}\nCourse: ${course.name}\nDate: ${new Date().toDateString()}`;
    await Share.share({ message: certText });
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
