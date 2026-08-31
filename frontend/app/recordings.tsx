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
import { Audio, type AVPlaybackStatus } from 'expo-av';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { prepareExternalUrl } from '@/lib/links';
import { EmptyState, FullScreenLoader, RetryState } from '@/components/ui';
import { logFirestoreFailure } from '@/lib/firestoreDebug';
import { formatDuration, formatFileSize, deleteClassRecording } from '@/lib/classRecording';

type RecordingItem = {
  id: string;
  title: string;
  description?: string;
  file_url: string;
  storage_path?: string;
  course_id?: string;
  lesson_id?: string;
  teacher_id?: string;
  teacher_name?: string;
  duration_sec?: number;
  size_bytes?: number;
  recorded_at?: any;
  created_at?: any;
};

type CourseMap = Record<string, string>;

export default function RecordingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
  const isTeacher = profile?.role === 'teacher' || isAdmin;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [items, setItems] = useState<RecordingItem[]>([]);
  const [courseMap, setCourseMap] = useState<CourseMap>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');

  // In-App Audio Player State
  const [soundObj, setSoundObj] = useState<Audio.Sound | null>(null);
  const [activePlayingId, setActivePlayingId] = useState<string | null>(null);
  const [activePlayingItem, setActivePlayingItem] = useState<RecordingItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackLoadingId, setPlaybackLoadingId] = useState<string | null>(null);
  const [playbackPositionSec, setPlaybackPositionSec] = useState(0);
  const [playbackDurationSec, setPlaybackDurationSec] = useState(0);

  // Unload audio on unmount
  useEffect(() => {
    return () => {
      if (soundObj) {
        soundObj.unloadAsync().catch(() => {});
      }
    };
  }, [soundObj]);

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
          storage_path: data.storage_path ? String(data.storage_path) : '',
          course_id: data.course_id ? String(data.course_id) : '',
          lesson_id: data.lesson_id ? String(data.lesson_id) : '',
          teacher_id: data.teacher_id ? String(data.teacher_id) : '',
          teacher_name: data.teacher_name ? String(data.teacher_name) : '',
          duration_sec: typeof data.duration_sec === 'number' ? data.duration_sec : 0,
          size_bytes: typeof data.size_bytes === 'number' ? data.size_bytes : 0,
          recorded_at: data.recorded_at,
          created_at: data.created_at,
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

  // Audio Playback handler
  const handleTogglePlayback = async (item: RecordingItem) => {
    const rawUrl = prepareExternalUrl(item.file_url);
    if (!rawUrl) {
      Alert.alert('Invalid URL', 'Recording URL is missing or invalid.');
      return;
    }

    // If tapping the same track that is already loaded
    if (activePlayingId === item.id && soundObj) {
      try {
        if (isPlaying) {
          await soundObj.pauseAsync();
          setIsPlaying(false);
        } else {
          await soundObj.playAsync();
          setIsPlaying(true);
        }
      } catch {
        // Fallback: reload
        await stopActiveSound();
      }
      return;
    }

    // Switching to a new track or starting fresh
    setPlaybackLoadingId(item.id);
    try {
      if (soundObj) {
        await soundObj.stopAsync().catch(() => {});
        await soundObj.unloadAsync().catch(() => {});
        setSoundObj(null);
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: rawUrl },
        { shouldPlay: true },
        (status: AVPlaybackStatus) => {
          if (status.isLoaded) {
            setIsPlaying(status.isPlaying);
            setPlaybackPositionSec(Math.floor((status.positionMillis || 0) / 1000));
            setPlaybackDurationSec(Math.floor((status.durationMillis || 0) / 1000));
            if (status.didJustFinish) {
              setIsPlaying(false);
              setPlaybackPositionSec(0);
            }
          }
        }
      );

      setSoundObj(sound);
      setActivePlayingId(item.id);
      setActivePlayingItem(item);
      setIsPlaying(true);
    } catch (err: any) {
      console.warn('[Recordings] Playback failed, trying external open:', err);
      Alert.alert(
        'In-App Playback Unavailable',
        'Could not stream this recording directly. Would you like to open or download it?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open / Download', onPress: () => void safeOpenExternal(item.file_url) },
        ]
      );
    } finally {
      setPlaybackLoadingId(null);
    }
  };

  const stopActiveSound = async () => {
    if (soundObj) {
      await soundObj.stopAsync().catch(() => {});
      await soundObj.unloadAsync().catch(() => {});
      setSoundObj(null);
    }
    setActivePlayingId(null);
    setActivePlayingItem(null);
    setIsPlaying(false);
    setPlaybackPositionSec(0);
    setPlaybackDurationSec(0);
  };

  const safeOpenExternal = async (rawUrl: string) => {
    const url = prepareExternalUrl(rawUrl);
    if (!url) {
      Alert.alert('Invalid URL', 'Recording URL is missing or invalid.');
      return;
    }
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Open Unavailable', 'No external app available to open this audio file.');
      }
    } catch {
      Alert.alert('Open Failed', 'Could not open recording.');
    }
  };

  const handleDeleteRecording = (item: RecordingItem) => {
    const canDelete = isAdmin || (isTeacher && item.teacher_id === user?.uid);
    if (!canDelete) return;

    Alert.alert('Delete Recording', `Delete "${item.title || 'recording'}" permanently from the Madrasa library?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (activePlayingId === item.id) {
            await stopActiveSound();
          }
          setUpdatingId(item.id);
          try {
            if (item.storage_path) {
              await deleteClassRecording(item.id, item.storage_path);
            } else {
              await deleteDoc(doc(db, 'recordings', item.id));
            }
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
        || (item.teacher_name || '').toLowerCase().includes(q)
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
          <Text style={styles.title}>Class Recordings</Text>
          <Text style={styles.subtitle}>Listen to past Dars & Live Class sessions</Text>
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
              placeholder="Search recordings by title, teacher, or course…"
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
            removeClippedSubviews
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            data={sortedItems}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.list, activePlayingItem ? { paddingBottom: 110 } : null]}
            renderItem={({ item }) => {
              const isThisPlaying = activePlayingId === item.id && isPlaying;
              const isThisLoaded = activePlayingId === item.id;
              const isLoadingThis = playbackLoadingId === item.id;
              const canDelete = isAdmin || (isTeacher && item.teacher_id === user?.uid);

              return (
                <View style={[styles.card, isThisLoaded && styles.cardActive]}>
                  {/* Card Header Info */}
                  <View style={styles.cardHeader}>
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardTitle}>{item.title || 'Live Class Recording'}</Text>
                      <View style={styles.metaRow}>
                        <Text style={styles.cardMetaCourse}>
                          {courseMap[item.course_id || ''] || 'General Session'}
                        </Text>
                        {item.teacher_name ? (
                          <Text style={styles.cardMetaTeacher}> • {item.teacher_name}</Text>
                        ) : null}
                      </View>
                    </View>

                    {/* Duration / File Size Badge */}
                    {item.duration_sec && item.duration_sec > 0 ? (
                      <View style={styles.durationBadge}>
                        <Ionicons name="time-outline" size={11} color={COLORS.primary} />
                        <Text style={styles.durationText}>{formatDuration(item.duration_sec)}</Text>
                      </View>
                    ) : item.size_bytes && item.size_bytes > 0 ? (
                      <View style={styles.durationBadge}>
                        <Text style={styles.durationText}>{formatFileSize(item.size_bytes)}</Text>
                      </View>
                    ) : null}
                  </View>

                  {item.description ? (
                    <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
                  ) : null}

                  {/* Actions Row */}
                  <View style={styles.cardActionsRow}>
                    {/* Primary In-App Play Button */}
                    <TouchableOpacity
                      style={[styles.playBtn, isThisPlaying && styles.playBtnActive]}
                      onPress={() => void handleTogglePlayback(item)}
                      disabled={isLoadingThis}
                    >
                      {isLoadingThis ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons
                            name={isThisPlaying ? 'pause' : 'play'}
                            size={16}
                            color={isThisPlaying ? '#fff' : COLORS.primary}
                          />
                          <Text style={[styles.playBtnText, isThisPlaying && styles.playBtnTextActive]}>
                            {isThisPlaying ? 'Pause' : isThisLoaded ? 'Resume' : 'Listen In-App'}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>

                    {/* External Link Option */}
                    <TouchableOpacity
                      style={styles.externalBtn}
                      onPress={() => void safeOpenExternal(item.file_url)}
                    >
                      <Ionicons name="open-outline" size={15} color={COLORS.textSecondary} />
                    </TouchableOpacity>

                    {/* Delete Option */}
                    {canDelete && (
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => handleDeleteRecording(item)}
                        disabled={updatingId === item.id}
                      >
                        {updatingId === item.id ? (
                          <ActivityIndicator size="small" color={COLORS.error} />
                        ) : (
                          <Ionicons name="trash-outline" size={15} color={COLORS.error} />
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <EmptyState
                title="No recordings yet"
                message={search || selectedCourseId ? 'No recordings match your filter.' : 'Live class recordings will appear here once teachers record audio sessions.'}
                icon="musical-notes-outline"
              />
            }
          />

          {/* Sticky Bottom Mini-Player when a track is active */}
          {activePlayingItem && (
            <View style={[styles.miniPlayer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              <View style={styles.miniPlayerContent}>
                <View style={styles.miniPlayerIcon}>
                  <Ionicons name="radio" size={18} color={COLORS.primary} />
                </View>
                <View style={styles.miniPlayerDetails}>
                  <Text style={styles.miniPlayerTitle} numberOfLines={1}>
                    {activePlayingItem.title || 'Playing Recording'}
                  </Text>
                  <Text style={styles.miniPlayerSub}>
                    {formatDuration(playbackPositionSec)} / {formatDuration(playbackDurationSec || activePlayingItem.duration_sec || 0)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.miniPlayerPlayBtn}
                  onPress={() => void handleTogglePlayback(activePlayingItem)}
                >
                  <Ionicons name={isPlaying ? 'pause' : 'play'} size={20} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.miniPlayerCloseBtn} onPress={() => void stopActiveSound()}>
                  <Ionicons name="close" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          )}
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
  list: { padding: SPACING.md, gap: 10, paddingBottom: 32 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    ...SHADOWS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  cardActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#F0FAF5',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textMain },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  cardMetaCourse: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  cardMetaTeacher: { fontSize: 12, color: COLORS.textSecondary },
  cardDesc: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    gap: 3,
  },
  durationText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  playBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: '#E8F5EE',
    gap: 6,
  },
  playBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  playBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  playBtnTextActive: { color: '#fff' },
  externalBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FFF1F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterArea: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  searchInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
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
  miniPlayer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingTop: 10,
    ...SHADOWS.header,
  },
  miniPlayerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  miniPlayerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8F5EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniPlayerDetails: { flex: 1 },
  miniPlayerTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textMain },
  miniPlayerSub: { fontSize: 11, color: COLORS.primary, fontWeight: '600', marginTop: 1 },
  miniPlayerPlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniPlayerCloseBtn: {
    padding: 6,
  },
});

