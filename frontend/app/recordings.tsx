import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar, TouchableOpacity, ActivityIndicator,
  FlatList, Alert, Linking, TextInput, ScrollView, Modal, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { goBackOrReplace } from '@/lib/navigation';
import { Ionicons } from '@expo/vector-icons';
import { collection, deleteDoc, doc, getDocs, orderBy, query, updateDoc } from 'firebase/firestore';
import { Audio, type AVPlaybackStatus } from 'expo-av';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { prepareExternalUrl } from '@/lib/links';
import { EmptyState, FullScreenLoader, RetryState } from '@/components/ui';
import { logFirestoreFailure } from '@/lib/firestoreDebug';
import { formatDuration, formatFileSize, deleteClassRecording } from '@/lib/classRecording';
import {
  isAudioCached,
  getPlayableAudioUri,
  downloadAudioForOffline,
  deleteCachedAudio,
  getCachedAudioSizeMb,
} from '@/lib/offlineAudioCache';

const PLAYBACK_SPEEDS = [0.75, 1.0, 1.25, 1.5, 2.0];

type RecordingItem = {
  id: string;
  title: string;
  description?: string;
  notes_text?: string;
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

  // Audio Playback State
  const [soundObj, setSoundObj] = useState<Audio.Sound | null>(null);
  const [activePlayingId, setActivePlayingId] = useState<string | null>(null);
  const [activePlayingItem, setActivePlayingItem] = useState<RecordingItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackLoadingId, setPlaybackLoadingId] = useState<string | null>(null);
  const [playbackPositionMs, setPlaybackPositionMs] = useState(0);
  const [playbackDurationMs, setPlaybackDurationMs] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [fullPlayerVisible, setFullPlayerVisible] = useState(false);

  // Dars Notes State
  const [editingNotesModal, setEditingNotesModal] = useState(false);
  const [notesInput, setNotesInput] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Offline Caching State
  const [offlineMap, setOfflineMap] = useState<Record<string, boolean>>({});
  const [downloadProgressMap, setDownloadProgressMap] = useState<Record<string, number>>({});

  // Check offline cache status for all items
  const checkOfflineCacheForItems = useCallback(async (recordingsList: RecordingItem[]) => {
    const map: Record<string, boolean> = {};
    for (const rec of recordingsList) {
      map[rec.id] = await isAudioCached(rec.id);
    }
    setOfflineMap(map);
  }, []);

  // Cleanup audio on unmount
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
          notes_text: data.notes_text ? String(data.notes_text) : '',
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
      await checkOfflineCacheForItems(next);
    } catch (error: unknown) {
      logFirestoreFailure(
        {
          collection: 'recordings/courses',
          operation: 'get',
          query: 'recordings orderBy created_at desc and all courses',
          role: profile?.role,
          status: profile?.status,
        },
        error
      );
      setLoadError('Could not load recordings. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [profile?.role, profile?.status, checkOfflineCacheForItems]);

  useEffect(() => {
    fetchRecordings().catch(() => {});
  }, [fetchRecordings]);

  // Audio Play / Pause / Load Handler
  const handleTogglePlayback = async (item: RecordingItem) => {
    // If clicking same track that is already loaded
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
        await stopActiveSound();
      }
      return;
    }

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

      // Get playable URI (local file:// if offline, otherwise remote https:// stream)
      const rawRemoteUrl = prepareExternalUrl(item.file_url) || item.file_url;
      const playUri = await getPlayableAudioUri(item.id, rawRemoteUrl);

      const { sound } = await Audio.Sound.createAsync(
        { uri: playUri },
        { shouldPlay: true, rate: playbackSpeed, shouldCorrectPitch: true },
        (status: AVPlaybackStatus) => {
          if (status.isLoaded) {
            setIsPlaying(status.isPlaying);
            setPlaybackPositionMs(status.positionMillis || 0);
            setPlaybackDurationMs(status.durationMillis || (item.duration_sec ? item.duration_sec * 1000 : 0));
            if (status.didJustFinish) {
              setIsPlaying(false);
              setPlaybackPositionMs(0);
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
    setPlaybackPositionMs(0);
    setPlaybackDurationMs(0);
  };

  // Interactive Seek Scrubber Handler
  const handleSeekByRatio = async (ratio: number) => {
    if (!soundObj || playbackDurationMs <= 0) return;
    const targetMs = Math.max(0, Math.min(playbackDurationMs, Math.floor(ratio * playbackDurationMs)));
    setPlaybackPositionMs(targetMs);
    try {
      await soundObj.setPositionAsync(targetMs);
    } catch (err) {
      console.warn('[Recordings] Seek failed:', err);
    }
  };

  // 10s Forward / Rewind Handler
  const handleSkipSeconds = async (deltaSec: number) => {
    if (!soundObj || playbackDurationMs <= 0) return;
    const deltaMs = deltaSec * 1000;
    const targetMs = Math.max(0, Math.min(playbackDurationMs, playbackPositionMs + deltaMs));
    setPlaybackPositionMs(targetMs);
    try {
      await soundObj.setPositionAsync(targetMs);
    } catch (err) {
      console.warn('[Recordings] Skip failed:', err);
    }
  };

  // Playback Speed Handler
  const handleSetSpeed = async (speed: number) => {
    setPlaybackSpeed(speed);
    if (soundObj) {
      try {
        await soundObj.setRateAsync(speed, true);
      } catch (err) {
        console.warn('[Recordings] SetRate failed:', err);
      }
    }
  };

  // Offline Download Handler
  const handleDownloadOffline = async (item: RecordingItem) => {
    const rawUrl = prepareExternalUrl(item.file_url);
    if (!rawUrl) {
      Alert.alert('Invalid URL', 'Recording download URL is missing.');
      return;
    }

    try {
      setDownloadProgressMap((prev) => ({ ...prev, [item.id]: 1 }));
      await downloadAudioForOffline(item.id, rawUrl, (percent) => {
        setDownloadProgressMap((prev) => ({ ...prev, [item.id]: percent }));
      });
      setOfflineMap((prev) => ({ ...prev, [item.id]: true }));
      Alert.alert('Saved for Offline ✓', `"${item.title}" is saved on your device. You can listen without internet.`);
    } catch (err: any) {
      Alert.alert('Download Error', err?.message || 'Could not download audio.');
    } finally {
      setDownloadProgressMap((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    }
  };

  // Delete Local Offline Cache
  const handleDeleteOffline = async (item: RecordingItem) => {
    Alert.alert('Remove Offline Audio', `Delete the downloaded file for "${item.title}" to free up device space?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteCachedAudio(item.id);
          setOfflineMap((prev) => ({ ...prev, [item.id]: false }));
        },
      },
    ]);
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
            await deleteCachedAudio(item.id);
            if (item.storage_path) {
              await deleteClassRecording(item.id, item.storage_path);
            } else {
              await deleteDoc(doc(db, 'recordings', item.id));
            }
            await fetchRecordings();
          } catch (error: unknown) {
            logFirestoreFailure(
              {
                collection: 'recordings',
                operation: 'delete',
                path: `recordings/${item.id}`,
                query: 'delete recording',
                role: profile?.role,
                status: profile?.status,
              },
              error
            );
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
      const matchSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q) ||
        (item.teacher_name || '').toLowerCase().includes(q) ||
        (courseMap[item.course_id || ''] || '').toLowerCase().includes(q);
      const matchCourse = !selectedCourseId || item.course_id === selectedCourseId;
      return matchSearch && matchCourse;
    });
  }, [items, search, selectedCourseId, courseMap]);

  const courseOptions = useMemo(
    () => Object.entries(courseMap).map(([id, name]) => ({ id, name })),
    [courseMap]
  );

  const progressRatio = playbackDurationMs > 0 ? Math.min(1, playbackPositionMs / playbackDurationMs) : 0;
  const currentPosSec = Math.floor(playbackPositionMs / 1000);
  const totalDurSec = Math.floor(playbackDurationMs / 1000);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => goBackOrReplace(router, '/more')}>
          <Ionicons name="arrow-back" size={20} color={COLORS.textMain} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Class Recordings</Text>
          <Text style={styles.subtitle}>Listen, revise & download Dars sessions</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={() => fetchRecordings()}>
          <Ionicons name="refresh" size={18} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <FullScreenLoader label="Loading recordings…" />
      ) : loadError ? (
        <RetryState
          title="Unable to load recordings"
          message={loadError}
          onRetry={() => {
            void fetchRecordings();
          }}
        />
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
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.courseFilterRow}
              >
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
            contentContainerStyle={[styles.list, activePlayingItem ? { paddingBottom: 130 } : null]}
            renderItem={({ item }) => {
              const isThisPlaying = activePlayingId === item.id && isPlaying;
              const isThisLoaded = activePlayingId === item.id;
              const isLoadingThis = playbackLoadingId === item.id;
              const isOffline = Boolean(offlineMap[item.id]);
              const downloadPercent = downloadProgressMap[item.id];
              const canDelete = isAdmin || (isTeacher && item.teacher_id === user?.uid);

              return (
                <View style={[styles.card, isThisLoaded && styles.cardActive]}>
                  {/* Card Header Info */}
                  <View style={styles.cardHeader}>
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardTitle}>{item.title || 'Live Class Recording'}</Text>
                      <View style={styles.metaRow}>
                        <Text style={styles.cardMetaCourse}>{courseMap[item.course_id || ''] || 'General Session'}</Text>
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
                    <Text style={styles.cardDesc} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}

                  {/* Offline Status Badge */}
                  {isOffline && (
                    <View style={styles.offlineNotice}>
                      <Ionicons name="checkmark-circle" size={13} color={COLORS.success} />
                      <Text style={styles.offlineNoticeText}>Saved on device • Plays without internet</Text>
                    </View>
                  )}

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

                    {/* Offline Download / Delete Button */}
                    {downloadPercent !== undefined ? (
                      <View style={styles.downloadProgressBtn}>
                        <ActivityIndicator size="small" color={COLORS.primary} />
                        <Text style={styles.downloadPercentText}>{downloadPercent}%</Text>
                      </View>
                    ) : isOffline ? (
                      <TouchableOpacity
                        style={styles.cachedBtn}
                        onPress={() => void handleDeleteOffline(item)}
                      >
                        <Ionicons name="cloud-done" size={16} color={COLORS.success} />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.downloadBtn}
                        onPress={() => void handleDownloadOffline(item)}
                      >
                        <Ionicons name="download-outline" size={16} color={COLORS.primary} />
                      </TouchableOpacity>
                    )}

                    {/* External Link Option */}
                    <TouchableOpacity style={styles.externalBtn} onPress={() => void safeOpenExternal(item.file_url)}>
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
                message={
                  search || selectedCourseId
                    ? 'No recordings match your filter.'
                    : 'Live class recordings will appear here once teachers record audio sessions.'
                }
                icon="musical-notes-outline"
              />
            }
          />

          {/* Sticky Bottom Mini-Player with Scrubber & Skip Controls */}
          {activePlayingItem && (
            <View style={[styles.miniPlayer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
              {/* Seek Scrubber Bar on top of miniplayer */}
              <TouchableOpacity
                activeOpacity={1}
                style={styles.scrubberContainer}
                onPress={(e) => {
                  const x = e.nativeEvent.locationX;
                  const width = Dimensions.get('window').width - 32;
                  const ratio = Math.max(0, Math.min(1, x / width));
                  void handleSeekByRatio(ratio);
                }}
              >
                <View style={styles.scrubberTrack}>
                  <View style={[styles.scrubberProgress, { width: `${progressRatio * 100}%` }]} />
                  <View style={[styles.scrubberKnob, { left: `${progressRatio * 100}%` }]} />
                </View>
              </TouchableOpacity>

              <View style={styles.miniPlayerContent}>
                {/* Expand Player Sheet Button */}
                <TouchableOpacity
                  style={styles.miniPlayerDetails}
                  onPress={() => setFullPlayerVisible(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.miniPlayerTitle} numberOfLines={1}>
                    {activePlayingItem.title || 'Playing Recording'}
                  </Text>
                  <View style={styles.miniPlayerSubRow}>
                    <Text style={styles.miniPlayerSub}>
                      {formatDuration(currentPosSec)} / {formatDuration(totalDurSec || activePlayingItem.duration_sec || 0)}
                    </Text>
                    {offlineMap[activePlayingItem.id] && (
                      <View style={styles.miniPlayerOfflineBadge}>
                        <Ionicons name="cloud-done" size={10} color={COLORS.success} />
                        <Text style={styles.miniPlayerOfflineText}>Offline</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>

                {/* Quick Controls Row */}
                <View style={styles.miniPlayerControls}>
                  <TouchableOpacity
                    style={styles.skipBtn}
                    onPress={() => void handleSkipSeconds(-10)}
                  >
                    <Ionicons name="play-back" size={16} color={COLORS.primary} />
                    <Text style={styles.skipBtnText}>10s</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.miniPlayerPlayBtn}
                    onPress={() => void handleTogglePlayback(activePlayingItem)}
                  >
                    <Ionicons name={isPlaying ? 'pause' : 'play'} size={18} color="#fff" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.skipBtn}
                    onPress={() => void handleSkipSeconds(10)}
                  >
                    <Ionicons name="play-forward" size={16} color={COLORS.primary} />
                    <Text style={styles.skipBtnText}>10s</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.speedPill}
                    onPress={() => {
                      const nextIdx = (PLAYBACK_SPEEDS.indexOf(playbackSpeed) + 1) % PLAYBACK_SPEEDS.length;
                      void handleSetSpeed(PLAYBACK_SPEEDS[nextIdx]);
                    }}
                  >
                    <Text style={styles.speedPillText}>{playbackSpeed}x</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.miniPlayerCloseBtn} onPress={() => void stopActiveSound()}>
                    <Ionicons name="close" size={18} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Full Screen / Sheet Audio Player Modal */}
          {activePlayingItem && (
            <Modal
              visible={fullPlayerVisible}
              animationType="slide"
              transparent
              onRequestClose={() => setFullPlayerVisible(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
                  {/* Modal Header */}
                  <View style={styles.modalHeader}>
                    <View style={styles.modalGrabber} />
                    <TouchableOpacity
                      style={styles.modalCloseBtn}
                      onPress={() => setFullPlayerVisible(false)}
                    >
                      <Ionicons name="chevron-down" size={24} color={COLORS.textMain} />
                    </TouchableOpacity>
                  </View>

                  {/* Artwork / Icon Box */}
                  <View style={styles.modalArtwork}>
                    <Ionicons name="mic-circle" size={64} color={COLORS.primary} />
                    <Text style={styles.modalArtworkLabel}>Madrasa Live Session Audio</Text>
                  </View>

                  {/* Title & Teacher Details */}
                  <View style={styles.modalMetaSection}>
                    <Text style={styles.modalTitle} numberOfLines={2}>
                      {activePlayingItem.title || 'Live Class Recording'}
                    </Text>
                    <Text style={styles.modalCourse}>
                      {courseMap[activePlayingItem.course_id || ''] || 'General Course'} • {activePlayingItem.teacher_name || 'Ustaadha'}
                    </Text>
                    {offlineMap[activePlayingItem.id] && (
                      <View style={styles.modalOfflineBadge}>
                        <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                        <Text style={styles.modalOfflineText}>Saved Locally on Device (Zero Data Streaming)</Text>
                      </View>
                    )}
                  </View>

                  {/* Interactive Scrubber Slider */}
                  <View style={styles.modalScrubberSection}>
                    <TouchableOpacity
                      activeOpacity={1}
                      style={styles.modalScrubberTouchArea}
                      onPress={(e) => {
                        const x = e.nativeEvent.locationX;
                        const width = Dimensions.get('window').width - 48;
                        const ratio = Math.max(0, Math.min(1, x / width));
                        void handleSeekByRatio(ratio);
                      }}
                    >
                      <View style={styles.modalScrubberTrack}>
                        <View style={[styles.modalScrubberFill, { width: `${progressRatio * 100}%` }]} />
                        <View style={[styles.modalScrubberThumb, { left: `${progressRatio * 100}%` }]} />
                      </View>
                    </TouchableOpacity>
                    <View style={styles.modalTimeRow}>
                      <Text style={styles.modalTimeText}>{formatDuration(currentPosSec)}</Text>
                      <Text style={styles.modalTimeText}>
                        -{formatDuration(Math.max(0, totalDurSec - currentPosSec))}
                      </Text>
                    </View>
                  </View>

                  {/* Large Controls Row */}
                  <View style={styles.modalControlsRow}>
                    <TouchableOpacity
                      style={styles.modalSkipBtn}
                      onPress={() => void handleSkipSeconds(-10)}
                    >
                      <Ionicons name="play-back" size={24} color={COLORS.primary} />
                      <Text style={styles.modalSkipText}>-10s</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.modalMainPlayBtn}
                      onPress={() => void handleTogglePlayback(activePlayingItem)}
                    >
                      <Ionicons name={isPlaying ? 'pause' : 'play'} size={32} color="#fff" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.modalSkipBtn}
                      onPress={() => void handleSkipSeconds(10)}
                    >
                      <Ionicons name="play-forward" size={24} color={COLORS.primary} />
                      <Text style={styles.modalSkipText}>+10s</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Speed Selector Pills */}
                  <View style={styles.modalSpeedSection}>
                    <Text style={styles.modalSpeedLabel}>Playback Speed:</Text>
                    <View style={styles.modalSpeedPillsRow}>
                      {PLAYBACK_SPEEDS.map((spd) => (
                        <TouchableOpacity
                          key={spd}
                          style={[
                            styles.modalSpeedChoice,
                            playbackSpeed === spd && styles.modalSpeedChoiceActive,
                          ]}
                          onPress={() => void handleSetSpeed(spd)}
                        >
                          <Text
                            style={[
                              styles.modalSpeedChoiceText,
                              playbackSpeed === spd && styles.modalSpeedChoiceTextActive,
                            ]}
                          >
                            {spd}x
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Dars Notes & Reference Material Section */}
                  <View style={styles.modalNotesSection}>
                    <View style={styles.modalNotesHeader}>
                      <View style={styles.modalNotesTitleRow}>
                        <Ionicons name="book-outline" size={16} color={COLORS.primary} />
                        <Text style={styles.modalNotesTitle}>Dars Notes & Tajweed Rules</Text>
                      </View>
                      {(isAdmin || (isTeacher && activePlayingItem.teacher_id === user?.uid)) && (
                        <TouchableOpacity
                          style={styles.editNotesBtn}
                          onPress={() => {
                            setNotesInput(activePlayingItem.notes_text || '');
                            setEditingNotesModal(true);
                          }}
                        >
                          <Ionicons name="create-outline" size={13} color={COLORS.primary} />
                          <Text style={styles.editNotesBtnText}>
                            {activePlayingItem.notes_text ? 'Edit Notes' : '+ Add Notes'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {activePlayingItem.notes_text ? (
                      <View style={styles.modalNotesCard}>
                        <Text style={styles.modalNotesText}>{activePlayingItem.notes_text}</Text>
                      </View>
                    ) : (
                      <Text style={styles.modalNotesEmpty}>
                        {isTeacher
                          ? 'No notes attached yet. Tap "+ Add Notes" to write Tajweed points for your students.'
                          : 'Ustaadha has not attached written notes for this Dars.'}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            </Modal>
          )}

          {/* Edit Dars Notes Modal */}
          {activePlayingItem && (
            <Modal
              visible={editingNotesModal}
              animationType="fade"
              transparent
              onRequestClose={() => setEditingNotesModal(false)}
            >
              <View style={styles.notesModalOverlay}>
                <View style={styles.notesModalCard}>
                  <View style={styles.notesModalHeader}>
                    <Text style={styles.notesModalTitle}>Edit Dars Notes</Text>
                    <TouchableOpacity onPress={() => setEditingNotesModal(false)}>
                      <Ionicons name="close" size={20} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.notesModalSub}>
                    Write Tajweed guidelines, homework, or lesson summary for students:
                  </Text>
                  <TextInput
                    style={styles.notesTextInput}
                    multiline
                    numberOfLines={4}
                    placeholder="e.g. Surah Al-Mulk Ayah 1-5 Tajweed: focus on Ghunnah on Noon Mushaddad and Ikhfa..."
                    placeholderTextColor={COLORS.textMuted}
                    value={notesInput}
                    onChangeText={setNotesInput}
                    textAlignVertical="top"
                  />
                  <View style={styles.notesModalActions}>
                    <TouchableOpacity
                      style={styles.notesCancelBtn}
                      onPress={() => setEditingNotesModal(false)}
                    >
                      <Text style={styles.notesCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.notesSaveBtn, savingNotes && { opacity: 0.7 }]}
                      onPress={async () => {
                        if (!activePlayingItem) return;
                        setSavingNotes(true);
                        try {
                          await updateDoc(doc(db, 'recordings', activePlayingItem.id), {
                            notes_text: notesInput.trim(),
                          });
                          setActivePlayingItem((prev) =>
                            prev ? { ...prev, notes_text: notesInput.trim() } : null
                          );
                          setItems((prev) =>
                            prev.map((it) =>
                              it.id === activePlayingItem.id
                                ? { ...it, notes_text: notesInput.trim() }
                                : it
                            )
                          );
                          setEditingNotesModal(false);
                          Alert.alert('Notes Saved ✓', 'Dars notes updated successfully.');
                        } catch (err: any) {
                          Alert.alert('Save Failed', err?.message || 'Could not save notes.');
                        } finally {
                          setSavingNotes(false);
                        }
                      }}
                      disabled={savingNotes}
                    >
                      {savingNotes ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.notesSaveText}>Save Notes</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
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
  offlineNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    gap: 5,
  },
  offlineNoticeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#065F46',
  },
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
  downloadBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#C6E8D4',
    backgroundColor: '#E8F5EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cachedBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadProgressBtn: {
    width: 44,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: '#E8F5EE',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  downloadPercentText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.primary,
  },
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
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
  },
  courseChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.surfaceAlt },
  courseChipText: { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
  courseChipTextActive: { color: COLORS.primary },

  /* Mini-Player Styles */
  miniPlayer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    ...SHADOWS.header,
  },
  scrubberContainer: {
    height: 12,
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  scrubberTrack: {
    height: 3,
    backgroundColor: '#D1E7DD',
    borderRadius: 2,
    position: 'relative',
  },
  scrubberProgress: {
    height: 3,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  scrubberKnob: {
    position: 'absolute',
    top: -4,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
    marginLeft: -5,
  },
  miniPlayerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: 4,
    gap: 8,
  },
  miniPlayerDetails: { flex: 1 },
  miniPlayerTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textMain },
  miniPlayerSubRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
  miniPlayerSub: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },
  miniPlayerOfflineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: RADIUS.sm,
    gap: 2,
  },
  miniPlayerOfflineText: { fontSize: 9, fontWeight: '700', color: '#065F46' },
  miniPlayerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  skipBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  skipBtnText: { fontSize: 8, fontWeight: '700', color: COLORS.primary },
  miniPlayerPlayBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedPill: {
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: '#C6E8D4',
  },
  speedPillText: { fontSize: 10, fontWeight: '700', color: COLORS.primary },
  miniPlayerCloseBtn: { padding: 4 },

  /* Modal Full Player Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: SPACING.lg,
    paddingTop: 12,
    gap: SPACING.md,
  },
  modalHeader: {
    alignItems: 'center',
    position: 'relative',
    paddingBottom: 4,
  },
  modalGrabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
  },
  modalCloseBtn: {
    position: 'absolute',
    right: 0,
    top: -4,
    padding: 4,
  },
  modalArtwork: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    backgroundColor: '#F0F7F4',
    borderRadius: RADIUS.lg,
    gap: 8,
  },
  modalArtworkLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  modalMetaSection: {
    gap: 4,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textMain,
  },
  modalCourse: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  modalOfflineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    gap: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  modalOfflineText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#065F46',
  },
  modalScrubberSection: {
    gap: 6,
  },
  modalScrubberTouchArea: {
    height: 24,
    justifyContent: 'center',
  },
  modalScrubberTrack: {
    height: 4,
    backgroundColor: '#D1E7DD',
    borderRadius: 2,
    position: 'relative',
  },
  modalScrubberFill: {
    height: 4,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  modalScrubberThumb: {
    position: 'absolute',
    top: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    marginLeft: -8,
  },
  modalTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalTimeText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  modalControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: SPACING.xs,
  },
  modalSkipBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  modalSkipText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
  },
  modalMainPlayBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.card,
  },
  modalSpeedSection: {
    gap: 8,
    paddingTop: 4,
  },
  modalSpeedLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  modalSpeedPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modalSpeedChoice: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSpeedChoiceActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  modalSpeedChoiceText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  modalSpeedChoiceTextActive: {
    color: '#fff',
  },
  modalNotesSection: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: 8,
    marginTop: 4,
  },
  modalNotesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalNotesTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalNotesTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  editNotesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#E8F5EE',
    borderRadius: RADIUS.sm,
  },
  editNotesBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  modalNotesCard: {
    backgroundColor: COLORS.surface,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalNotesText: {
    fontSize: 12,
    color: COLORS.textMain,
    lineHeight: 18,
  },
  modalNotesEmpty: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  notesModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  notesModalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 450,
    gap: 12,
    ...SHADOWS.card,
  },
  notesModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notesModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textMain,
  },
  notesModalSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  notesTextInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    fontSize: 13,
    color: COLORS.textMain,
    minHeight: 100,
  },
  notesModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  notesCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
  },
  notesCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  notesSaveBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
  },
  notesSaveText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
});


