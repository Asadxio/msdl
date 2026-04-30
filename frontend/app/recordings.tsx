import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar, TouchableOpacity, ActivityIndicator, FlatList, Alert, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { collection, deleteDoc, doc, getDocs, orderBy, query } from 'firebase/firestore';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { prepareExternalUrl } from '@/lib/links';

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
  const isAdmin = profile?.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<RecordingItem[]>([]);
  const [courseMap, setCourseMap] = useState<CourseMap>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchRecordings = useCallback(async () => {
    setLoading(true);
    try {
      const [recordingSnap, courseSnap] = await Promise.all([
        getDocs(query(collection(db, 'recordings'), orderBy('created_at', 'desc'))),
        getDocs(collection(db, 'courses')),
      ]);
      const next: RecordingItem[] = [];
      recordingSnap.forEach((d) => {
        try {
          const data = d.data() as any;
          next.push({ 
            id: d.id, 
            title: String(data?.title || 'Recording'),
            description: typeof data?.description === 'string' ? data.description : '',
            file_url: String(data?.file_url || ''),
            course_id: data?.course_id,
            lesson_id: data?.lesson_id,
          });
        } catch (e) {
          console.log('[Recordings] item parse ERROR:', e);
        }
      });
      const nextMap: CourseMap = {};
      courseSnap.forEach((d) => {
        try {
          const data = d.data() as any;
          nextMap[d.id] = String(data?.name || 'Course');
        } catch (e) {
          console.log('[Recordings] course parse ERROR:', e);
        }
      });
      setItems(Array.isArray(next) ? next : []);
      setCourseMap(nextMap);
    } catch (e) {
      console.log('[Recordings] fetchRecordings ERROR:', e);
      Alert.alert('Error', 'Could not load recordings. Please refresh.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecordings().catch((e) => console.log('[Recordings] useEffect fetchRecordings ERROR:', e));
  }, [fetchRecordings]);

  const safeOpenRecording = async (rawUrl: string) => {
    const url = prepareExternalUrl(rawUrl);
    if (!url) {
      Alert.alert('Invalid URL', 'Recording URL is missing or invalid.');
      return;
    }
    await Linking.openURL(url).catch(() => {
      Alert.alert('Open Failed', 'Could not open recording. Please try again later.');
    });
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
    if (!isAdmin || !item?.id) return;
    Alert.alert('Delete Recording', `Delete "${item?.title || 'recording'}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setUpdatingId(item.id);
          try {
            await deleteDoc(doc(db, 'recordings', item.id));
            await fetchRecordings();
          } catch (e) {
            console.log('[Recordings] deleteRecording ERROR:', e);
            Alert.alert('Delete Failed', 'Could not delete recording.');
          } finally {
            setUpdatingId(null);
          }
        },
      },
    ]);
  };

  const sortedItems = useMemo(() => (Array.isArray(items) ? items : []), [items]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
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
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <FlatList
          data={sortedItems}
          keyExtractor={(item) => item?.id || Math.random().toString()}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => { void safeOpenRecording(item?.file_url || ''); }}>
                <Text style={styles.cardTitle}>{item?.title || 'Recording'}</Text>
                <Text style={styles.cardMeta}>{courseMap[item?.course_id || ''] || 'Course'}</Text>
                <Text style={styles.cardDesc}>{item?.description || 'Tap to open recording'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.downloadBtn} onPress={() => { void downloadRecording(item?.file_url || ''); }}>
                <Ionicons name="download-outline" size={16} color={COLORS.primary} />
                <Text style={styles.downloadText}>Download</Text>
              </TouchableOpacity>
              {isAdmin ? (
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => deleteRecording(item)}
                  disabled={updatingId === item?.id}
                >
                  {updatingId === item?.id ? <ActivityIndicator size="small" color={COLORS.error} /> : <Text style={styles.deleteText}>Delete</Text>}
                </TouchableOpacity>
              ) : null}
            </View>
          )}
          ListEmptyComponent={<View style={styles.center}><Text style={styles.empty}>No recordings available yet.</Text></View>}
        />
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
  downloadBtn: { paddingHorizontal: 8, paddingVertical: 8, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center', gap: 2 },
  downloadText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
  empty: { fontSize: 13, color: COLORS.textMuted },
});
