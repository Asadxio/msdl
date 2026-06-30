import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar, TouchableOpacity, ActivityIndicator,
  FlatList, Alert, Linking, TextInput, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { goBackOrReplace } from '@/lib/navigation';
import { Ionicons } from '@expo/vector-icons';
import { collection, deleteDoc, doc, getDocs, orderBy, query } from 'firebase/firestore';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { prepareExternalUrl } from '@/lib/links';
import { EmptyState, FullScreenLoader, RetryState } from '@/components/ui';
import { logFirestoreFailure } from '@/lib/firestoreDebug';

type RecordingItem = {
  id: string;
  title: string;
  description?: string;
  file_url: string;
  course_id?: string;
  lesson_id?: string;
};

type CourseMap = Record<string, string>;

export default function RecordingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [items, setItems] = useState<RecordingItem[]>([]);
  const [courseMap, setCourseMap] = useState<CourseMap>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');

  const fetchRecordings = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [recordingSnap, courseSnap] = await Promise.all([
        getDocs(query(collection(db, 'recordings'), orderBy('created_at', 'desc'))),
        getDocs(collection(db, 'courses')),
      ]);
      const next: RecordingItem[] = [];
      recordingSnap.forEach((d) => {
        const data = d.data() as Partial<RecordingItem>;
        next.push({
          id: d.id,
          title: String(data.title || ''),
          description: data.description ? String(data.description) : '',
          file_url: String(data.file_url || ''),
          course_id: data.course_id ? String(data.course_id) : '',
          lesson_id: data.lesson_id ? String(data.lesson_id) : '',
        });
      });
      const nextMap: CourseMap = {};
      courseSnap.forEach((d) => {
        const data = d.data() as { name?: string };
        nextMap[d.id] = data.name || 'Course';
      });
      setItems(next);
      setCourseMap(nextMap);
    } catch (error: unknown) {
      logFirestoreFailure({ collection: 'recordings/courses', operation: 'get', query: 'recordings orderBy created_at desc and all courses', role: profile?.role, status: profile?.status }, error);
      setLoadError('Could not load recordings. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [profile?.role, profile?.status]);

  useEffect(() => {
    fetchRecordings().catch(() => {});
  }, [fetchRecordings]);

  const safeOpenRecording = async (rawUrl: string, id?: string) => {
    const url = prepareExternalUrl(rawUrl);
    if (!url) {
      Alert.alert('Invalid URL', 'Recording URL is missing or invalid.');
      return;
    }
    try {
      if (id) setOpeningId(id);
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert('Open Unavailable', 'No app is available to play this recording.');
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert('Open Failed', 'Could not open recording. Please try again later.');
    } finally {
      if (id) setOpeningId(null);
    }
  };

  const downloadRecording = async (rawUrl: string) => {
    const url = prepareExternalUrl(rawUrl);
    if (!url) {
      Alert.alert('Invalid URL', 'Download URL is missing or invalid.');
      return;
    }
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert('Download Unavailable', 'No app is available to open this file.');
        return;
      }
      await Linking.openURL(url);
    } catch (error) {
      console.log('[Recordings] downloadRecording ERROR', error);
      Alert.alert('Download Failed', 'Could not start download. Opening externally instead.');
      await safeOpenRecording(url);
    }
  };

  const deleteRecording = (item: RecordingItem) => {
    if (!isAdmin) return;
    Alert.alert('Delete Recording', `Delete "${item.title || 'recording'}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setUpdatingId(item.id);
          try {
            await deleteDoc(doc(db, 'recordings', item.id));
            await fetchRecordings();
          } catch (error: unknown) {
            logFirestoreFailure({ collection: 'recordings', operation: 'delete', path: `recordings/${item.id}`, query: 'delete recording', role: profile?.role, status: profile?.status }, error);
            Alert.alert('Delete Failed', 'Could not delete recording.');
          } finally {
            setUpdatingId(null);
          }
        },
      },
    ]);
  };

  const sortedItems = useMemo(() => {
    const base = Array.isArray(items) ? items : [];
    const q = search.trim().toLowerCase();
    return base.filter((item) => {
      const matchSearch = !q
        || item.title.toLowerCase().includes(q)
        || (item.description || '').toLowerCase().includes(q)
        || (courseMap[item.course_id || ''] || '').toLowerCase().includes(q);
      const matchCourse = !selectedCourseId || item.course_id === selectedCourseId;
      return matchSearch && matchCourse;
    });
  }, [items, search, selectedCourseId, courseMap]);

  const courseOptions = useMemo(() =>
    Object.entries(courseMap).map(([id, name]) => ({ id, name })),
  [courseMap]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => goBackOrReplace(router, '/more')}>
          <Ionicons name="arrow-back" size={20} color={COLORS.textMain} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Recordings</Text>
          <Text style={styles.subtitle}>Watch class recordings</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={() => fetchRecordings()}>
          <Ionicons name="refresh" size={18} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <FullScreenLoader label="Loading recordings…" />
      ) : loadError ? (
        <RetryState title="Unable to load recordings" message={loadError} onRetry={() => { void fetchRecordings(); }} />
      ) : (
        <>
          {/* Search + Course filter */}
          <View style={styles.filterArea}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search recordings by title or description…"
              placeholderTextColor={COLORS.textMuted}
              value={search}
              onChangeText={setSearch}
            />
            {courseOptions.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.courseFilterRow}>
                <TouchableOpacity
                  style={[styles.courseChip, !selectedCourseId && styles.courseChipActive]}
                  onPress={() => setSelectedCourseId('')}
                >
                  <Text style={[styles.courseChipText, !selectedCourseId && styles.courseChipTextActive]}>All</Text>
                </TouchableOpacity>
                {courseOptions.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.courseChip, selectedCourseId === c.id && styles.courseChipActive]}
                    onPress={() => setSelectedCourseId(c.id)}
                  >
                    <Text style={[styles.courseChipText, selectedCourseId === c.id && styles.courseChipTextActive]}>
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

        <FlatList
          data={sortedItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.title || 'Recording'}</Text>
                <Text style={styles.cardMeta}>{courseMap[item.course_id || ''] || 'Course'}</Text>
                <Text style={styles.cardDesc}>{item.description || 'Tap to open recording'}</Text>
              </View>
              <TouchableOpacity
                style={styles.playBtn}
                onPress={() => { void safeOpenRecording(item.file_url, item.id); }}
                disabled={openingId === item.id}
              >
                {openingId === item.id ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Ionicons name="play-circle-outline" size={16} color={COLORS.primary} />}
                <Text style={styles.downloadText}>{openingId === item.id ? 'Opening...' : 'Play'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.downloadBtn} onPress={() => { void downloadRecording(item.file_url); }}>
                <Ionicons name="download-outline" size={16} color={COLORS.primary} />
                <Text style={styles.downloadText}>Download</Text>
              </TouchableOpacity>
              {isAdmin ? (
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => deleteRecording(item)}
                  disabled={updatingId === item.id}
                >
                  {updatingId === item.id ? <ActivityIndicator size="small" color={COLORS.error} /> : <Text style={styles.deleteText}>Delete</Text>}
                </TouchableOpacity>
              ) : null}
            </View>
          )}
          ListEmptyComponent={<EmptyState title="No recordings yet" message={search || selectedCourseId ? 'No recordings match your filter.' : 'Live class recordings will appear here once available.'} icon="videocam-outline" />}
        />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceAlt,
  },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
  subtitle: { fontSize: 12, color: COLORS.textMuted },
  list: { padding: SPACING.md, gap: 8, paddingBottom: 24 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    ...SHADOWS.card,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textMain },
  cardMeta: { fontSize: 12, color: COLORS.primary, marginTop: 2 },
  cardDesc: { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
  deleteBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: RADIUS.md, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FFF1F2' },
  deleteText: { fontSize: 12, fontWeight: '700', color: COLORS.error },
  playBtn: { paddingHorizontal: 8, paddingVertical: 8, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center', gap: 2 },
  downloadBtn: { paddingHorizontal: 8, paddingVertical: 8, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center', gap: 2 },
  downloadText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
  empty: { fontSize: 13, color: COLORS.textMuted },
  filterArea: { backgroundColor: COLORS.surface, paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 8 },
  searchInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    color: COLORS.textMain,
    fontSize: 14,
  },
  courseFilterRow: { gap: 8, paddingBottom: 4 },
  courseChip: {
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.background,
    borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: 6,
  },
  courseChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.surfaceAlt },
  courseChipText: { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
  courseChipTextActive: { color: COLORS.primary },
});
