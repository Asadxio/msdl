import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { useActiveOrganization, DEFAULT_ORGANIZATION_ID } from '@/lib/tenantContext';
import { SabaqDiaryEntry, getCachedStudentSabaqDiary } from '@/lib/sabaqDiary';

export function StudentTodayHeroCard() {
  const router = useRouter();
  const { user } = useAuth();
  const { activeOrgId } = useActiveOrganization();

  const [activeLiveClass, setActiveLiveClass] = useState<any | null>(null);
  const [latestSabaq, setLatestSabaq] = useState<SabaqDiaryEntry | null>(null);
  const [loading, setLoading] = useState(true);

  const todayStr = new Date().toISOString().slice(0, 10);

  // 1. Listen for active Live Class in real-time
  useEffect(() => {
    const orgId = activeOrgId || DEFAULT_ORGANIZATION_ID;
    const qLive = query(
      collection(db, 'live_classes'),
      where('status', '==', 'live'),
      limit(3)
    );

    const unsubLive = onSnapshot(
      qLive,
      (snap) => {
        let found: any = null;
        snap.forEach((d) => {
          const data = d.data();
          if (!data.organization_id || data.organization_id === orgId) {
            if (!found) {
              found = { id: d.id, ...data };
            }
          }
        });
        setActiveLiveClass(found);
      },
      (err) => {
        console.warn('[StudentTodayHeroCard] Live class listener error:', err);
      }
    );

    return () => unsubLive();
  }, [activeOrgId]);

  // 2. Fetch latest Sabaq entry (cached first, then real-time Firestore)
  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    // Load from cache first for instant offline UI
    getCachedStudentSabaqDiary(user.uid).then((cached) => {
      if (cached && cached.length > 0) {
        setLatestSabaq(cached[0]);
        setLoading(false);
      }
    });

    const qSabaq = query(
      collection(db, 'sabaq_records'),
      where('student_id', '==', user.uid),
      orderBy('date', 'desc'),
      limit(1)
    );

    const unsubSabaq = onSnapshot(
      qSabaq,
      (snap) => {
        if (!snap.empty) {
          const docData = snap.docs[0].data() as SabaqDiaryEntry;
          setLatestSabaq({
            ...docData,
            id: snap.docs[0].id,
          });
        }
        setLoading(false);
      },
      (err) => {
        console.warn('[StudentTodayHeroCard] Sabaq listener error:', err);
        setLoading(false);
      }
    );

    return () => unsubSabaq();
  }, [user?.uid]);

  const isSabaqFromToday = latestSabaq?.date === todayStr;

  const getGradeColor = (grade?: string) => {
    switch (grade) {
      case 'Mumtaz':
        return '#059669';
      case 'Jayyid Jiddan':
        return '#2563EB';
      case 'Jayyid':
        return '#D97706';
      case 'Maqbool':
        return '#7C3AED';
      case 'Doharayein':
        return '#DC2626';
      default:
        return COLORS.textSecondary;
    }
  };

  return (
    <View style={styles.container}>
      {/* 🔴 ACTIVE LIVE CLASS HERO BANNER (Top Priority) */}
      {activeLiveClass && (
        <TouchableOpacity
          style={styles.liveHeroCard}
          onPress={() => router.push(`/live-class/${activeLiveClass.id}` as any)}
          activeOpacity={0.9}
        >
          <View style={styles.liveHeroTop}>
            <View style={styles.livePulseBadge}>
              <View style={styles.livePulseDot} />
              <Text style={styles.livePulseText}>LIVE CLASS NOW • جاری کلاس</Text>
            </View>
            <Text style={styles.liveUrduText}>استاد لائیو پڑھا رہے ہیں</Text>
          </View>

          <Text style={styles.liveClassTitle} numberOfLines={1}>
            {activeLiveClass.title || activeLiveClass.course_name || 'Live Islamic Dars'}
          </Text>
          <Text style={styles.liveTeacherName} numberOfLines={1}>
            Ustadh: {activeLiveClass.teacher_name || 'Ustaadha'}
          </Text>

          <View style={styles.joinLiveBtn}>
            <Ionicons name="radio" size={16} color="#FFFFFF" />
            <Text style={styles.joinLiveBtnText}>⚡ Join Live Dars Now • کلاس میں شامل ہوں</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* 📖 TODAY'S SABAQ DIARY HERO CARD */}
      <View style={styles.sabaqCard}>
        <View style={styles.sabaqCardHeader}>
          <View style={styles.headerLeft}>
            <View style={styles.iconCircle}>
              <Ionicons name="book" size={16} color={COLORS.primary} />
            </View>
            <View>
              <Text style={styles.sabaqCardTitle}>
                {isSabaqFromToday ? "Today's Sabaq Diary" : "Daily Sabaq & Dars Diary"}
              </Text>
              <Text style={styles.sabaqCardUrdu}>
                {isSabaqFromToday ? 'آج کا سبق، سبقی اور منزل' : 'روزانہ حفظ و درس ڈائری'}
              </Text>
            </View>
          </View>

          {latestSabaq && (
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    latestSabaq.status === 'present'
                      ? '#DCFCE7'
                      : latestSabaq.status === 'absent'
                      ? '#FEE2E2'
                      : '#FEF3C7',
                },
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  {
                    color:
                      latestSabaq.status === 'present'
                        ? '#15803D'
                        : latestSabaq.status === 'absent'
                        ? '#B91C1C'
                        : '#B45309',
                  },
                ]}
              >
                {latestSabaq.status.toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {loading ? (
          <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: SPACING.md }} />
        ) : latestSabaq ? (
          <View style={styles.sabaqBody}>
            {/* 3 Pillars Grid */}
            <View style={styles.pillarsGrid}>
              {/* Sabaq */}
              <View style={styles.pillarItem}>
                <View style={styles.pillarTopRow}>
                  <Text style={styles.pillarLabel}>SABAQ (سبق)</Text>
                  {latestSabaq.sabaq?.grade && (
                    <Text style={[styles.pillarGrade, { color: getGradeColor(latestSabaq.sabaq.grade) }]}>
                      {latestSabaq.sabaq.grade}
                    </Text>
                  )}
                </View>
                <Text style={styles.pillarText} numberOfLines={2}>
                  {latestSabaq.sabaq?.text || 'No entry'}
                </Text>
                {typeof latestSabaq.sabaq?.mistakes === 'number' && latestSabaq.sabaq.mistakes > 0 && (
                  <Text style={styles.mistakesText}>⚠️ {latestSabaq.sabaq.mistakes} mistakes</Text>
                )}
              </View>

              {/* Sabqi */}
              <View style={styles.pillarItem}>
                <View style={styles.pillarTopRow}>
                  <Text style={styles.pillarLabel}>SABQI (سبقی)</Text>
                  {latestSabaq.sabqi?.grade && (
                    <Text style={[styles.pillarGrade, { color: getGradeColor(latestSabaq.sabqi.grade) }]}>
                      {latestSabaq.sabqi.grade}
                    </Text>
                  )}
                </View>
                <Text style={styles.pillarText} numberOfLines={2}>
                  {latestSabaq.sabqi?.text || 'No review'}
                </Text>
              </View>

              {/* Manzil */}
              <View style={styles.pillarItem}>
                <View style={styles.pillarTopRow}>
                  <Text style={styles.pillarLabel}>MANZIL (منزل)</Text>
                  {latestSabaq.manzil?.grade && (
                    <Text style={[styles.pillarGrade, { color: getGradeColor(latestSabaq.manzil.grade) }]}>
                      {latestSabaq.manzil.grade}
                    </Text>
                  )}
                </View>
                <Text style={styles.pillarText} numberOfLines={2}>
                  {latestSabaq.manzil?.text || 'No cycle'}
                </Text>
              </View>
            </View>

            {/* Teacher Note / Feedback */}
            {latestSabaq.teacher_notes && (
              <View style={styles.teacherNoteBox}>
                <Ionicons name="chatbox-ellipses-outline" size={14} color="#047857" />
                <Text style={styles.teacherNoteText} numberOfLines={2}>
                  &ldquo;{latestSabaq.teacher_notes}&rdquo; — {latestSabaq.teacher_name || 'Ustaad'}
                </Text>
              </View>
            )}

            {/* Quick Actions Row */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.openDiaryBtn}
                onPress={() => router.push('/sabaq-diary' as any)}
                activeOpacity={0.8}
              >
                <Ionicons name="journal-outline" size={15} color={COLORS.primary} />
                <Text style={styles.openDiaryBtnText}>Open Full Diary • مکمل ڈائری</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.openQuranBtn}
                onPress={() => router.push('/(tabs)/quran' as any)}
                activeOpacity={0.8}
              >
                <Ionicons name="book-outline" size={15} color="#065F46" />
                <Text style={styles.openQuranBtnText}>Open Quran</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.emptySabaqBody}>
            <Text style={styles.emptySabaqTitle}>No Sabaq record entered yet</Text>
            <Text style={styles.emptySabaqSubtitle}>
              Open your Sabaq diary to review daily recitation targets or read Quran.
            </Text>
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.openDiaryBtn}
                onPress={() => router.push('/sabaq-diary' as any)}
                activeOpacity={0.8}
              >
                <Ionicons name="journal-outline" size={15} color={COLORS.primary} />
                <Text style={styles.openDiaryBtnText}>Open Diary • ڈائری دیکھیں</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.openQuranBtn}
                onPress={() => router.push('/(tabs)/quran' as any)}
                activeOpacity={0.8}
              >
                <Ionicons name="book-outline" size={15} color="#065F46" />
                <Text style={styles.openQuranBtnText}>Read Quran</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  liveHeroCard: {
    backgroundColor: '#7F1D1D',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#DC2626',
    ...SHADOWS.card,
  },
  liveHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  livePulseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    gap: 6,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  livePulseText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FEE2E2',
    letterSpacing: 0.5,
  },
  liveUrduText: {
    fontSize: 12,
    color: '#FECACA',
    fontWeight: '600',
  },
  liveClassTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  liveTeacherName: {
    fontSize: 12,
    color: '#FCA5A5',
    marginTop: 2,
    marginBottom: SPACING.sm,
  },
  joinLiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    gap: 8,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  joinLiveBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  sabaqCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  sabaqCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  sabaqCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textMain,
  },
  sabaqCardUrdu: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  sabaqBody: {
    marginTop: SPACING.sm,
  },
  pillarsGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  pillarItem: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: RADIUS.md,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pillarTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  pillarLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.textSecondary,
  },
  pillarGrade: {
    fontSize: 9,
    fontWeight: '800',
  },
  pillarText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMain,
    lineHeight: 16,
  },
  mistakesText: {
    fontSize: 9,
    color: '#DC2626',
    fontWeight: '600',
    marginTop: 3,
  },
  teacherNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    marginTop: SPACING.xs,
    gap: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  teacherNoteText: {
    flex: 1,
    fontSize: 11,
    fontStyle: 'italic',
    color: '#065F46',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: SPACING.sm,
  },
  openDiaryBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
    paddingVertical: 9,
    borderRadius: RADIUS.md,
    gap: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  openDiaryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  openQuranBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 9,
    borderRadius: RADIUS.md,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  openQuranBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  emptySabaqBody: {
    paddingVertical: SPACING.sm,
  },
  emptySabaqTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  emptySabaqSubtitle: {
    fontSize: 11,
    color: COLORS.textSecondary,
    lineHeight: 16,
    marginTop: 2,
    marginBottom: SPACING.xs,
  },
});
