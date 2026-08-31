import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  SafeAreaView,
  Linking,
  ScrollView,
  Animated,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import {
  subscribeLiveClass,
  endLiveClass,
  canCurrentUserJoinLiveClass,
  updatePurdahBoardState,
  raiseHandForRecitation,
  grantMicrophone,
  lowerHandRecitation,
  type LiveClass,
} from '@/lib/liveClasses';
import { TajweedBoard, type TajweedBoardView } from '@/components/classroom/TajweedBoard';
import {
  startClassRecording,
  stopAndSaveRecording,
  formatDuration,
  type SavedRecording,
} from '@/lib/classRecording';
import type { Audio } from 'expo-av';
import { COLORS, SPACING, RADIUS, SHADOWS } from '@/constants/theme';
import { goBackOrReplace } from '@/lib/navigation';

export default function LiveClassroomScreen() {
  const { id } = useLocalSearchParams();
  const classId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const { user, profile } = useAuth();

  const [liveClass, setLiveClass] = useState<LiveClass | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [micMuted, setMicMuted] = useState(true);
  const [waveAnim] = useState(new Animated.Value(1));

  // Inbuilt Audio Recording State
  const [recordingInstance, setRecordingInstance] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDurationSec, setRecordingDurationSec] = useState(0);
  const [isSavingRecording, setIsSavingRecording] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [savedRecording, setSavedRecording] = useState<SavedRecording | null>(null);

  useEffect(() => {
    if (!classId) {
      setLoading(false);
      return;
    }
    const unsub = subscribeLiveClass(classId, (data) => {
      setLiveClass(data);
      setLoading(false);
      if (data?.status === 'ended') {
        Alert.alert('Class Ended', 'This live class has ended.');
        goBackOrReplace(router, '/(tabs)/courses');
      }
    });
    return () => unsub();
  }, [classId, router]);

  // Audio wave animation pulse
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
        Animated.timing(waveAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [waveAnim]);

  // Recording Timer effect
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (isRecording) {
      timer = setInterval(() => {
        setRecordingDurationSec((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingDurationSec(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRecording]);

  const isTeacher = profile?.role === 'teacher' || profile?.role === 'admin';
  const isSpeaking = liveClass?.active_speaker_uid === user?.uid || (isTeacher && !liveClass?.active_speaker_uid);

  // Inbuilt Class Audio Recording handlers
  const handleStartAudioRecording = async () => {
    if (!isTeacher) return;
    try {
      const rec = await startClassRecording();
      setRecordingInstance(rec);
      setIsRecording(true);
      setSavedRecording(null);
    } catch (err: any) {
      Alert.alert('Recording Error', err?.message || 'Could not start recording. Please check microphone permission.');
    }
  };

  const handleStopAndSaveAudioRecording = () => {
    if (!recordingInstance || !liveClass || !user || !profile) return;
    Alert.alert(
      'Save Audio Recording',
      'Stop recording and upload this session to the Madrasa Recordings library?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop & Save',
          onPress: async () => {
            setIsSavingRecording(true);
            setIsRecording(false);
            try {
              const saved = await stopAndSaveRecording(
                recordingInstance,
                {
                  classId: (classId as string) || '',
                  classTitle: liveClass.title || 'Live Class Session',
                  courseId: liveClass.course_id || '',
                  teacherId: user.uid,
                  teacherName: profile.name || liveClass.teacher_name || 'Ustaadha',
                },
                (progress) => setSaveProgress(progress)
              );
              setRecordingInstance(null);
              setSavedRecording(saved);
              Alert.alert('Recording Saved ✓', `"${saved.title}" is now available in the Recordings library.`);
            } catch (err: any) {
              Alert.alert('Save Failed', err?.message || 'Could not save recording.');
            } finally {
              setIsSavingRecording(false);
              setSaveProgress(0);
            }
          },
        },
      ]
    );
  };

  const handleJoinExternalMeet = async () => {
    if (!liveClass || !user || !profile) return;
    setJoining(true);
    try {
      const allowed = await canCurrentUserJoinLiveClass(liveClass, profile);
      if (!allowed) {
        Alert.alert('Access denied', 'You are not enrolled in this course.');
        return;
      }

      const meetUrl = liveClass.meet_url;
      if (!meetUrl) {
        Alert.alert('Error', 'No Google Meet URL was provided for this class.');
        return;
      }

      const canOpen = await Linking.canOpenURL(meetUrl).catch(() => false);
      if (canOpen) {
        await Linking.openURL(meetUrl);
      } else {
        await WebBrowser.openBrowserAsync(meetUrl, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        });
      }
    } catch (e: any) {
      Alert.alert('Error joining class', e?.message || 'Could not launch Google Meet.');
    } finally {
      setJoining(false);
    }
  };

  const handleEndClass = () => {
    if (!classId || !isTeacher) return;
    Alert.alert('End Class', 'Are you sure you want to end this live class for everyone?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Class',
        style: 'destructive',
        onPress: async () => {
          try {
            await endLiveClass(classId, profile);
            goBackOrReplace(router, '/(tabs)/courses');
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Could not end class.');
          }
        },
      },
    ]);
  };

  // Board state change handlers
  const handleViewModeChange = async (mode: TajweedBoardView) => {
    if (!classId || !isTeacher) return;
    await updatePurdahBoardState(classId, { active_board_view: mode }).catch(() => {});
  };

  const handleToggleHighlight = async (word: string) => {
    if (!classId || !isTeacher) return;
    const current = liveClass?.highlighted_words || [];
    const updated = current.includes(word) ? current.filter((w) => w !== word) : [...current, word];
    await updatePurdahBoardState(classId, { highlighted_words: updated }).catch(() => {});
  };

  // Student Recitation Queue handlers
  const handleRaiseHand = async () => {
    if (!classId || !user || !profile) return;
    try {
      await raiseHandForRecitation(classId, {
        uid: user.uid,
        name: profile.name || 'Taliba',
      });
      Alert.alert('Hand Raised', 'You have been added to the Tilawat queue. The Ustaadha will grant your turn.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not raise hand');
    }
  };

  const handleGrantMic = async (studentUid: string, studentName: string) => {
    if (!classId || !isTeacher) return;
    await grantMicrophone(classId, studentUid, studentName).catch(() => {});
  };

  const handleLowerHand = async (studentUid: string) => {
    if (!classId || !isTeacher) return;
    await lowerHandRecitation(classId, studentUid).catch(() => {});
  };

  const isStudentWaitingInQueue = useMemo(() => {
    if (!user?.uid || !liveClass?.recitation_queue) return false;
    return liveClass.recitation_queue.some((q) => q.uid === user.uid && q.status === 'waiting');
  }, [user?.uid, liveClass?.recitation_queue]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  if (!liveClass) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Class not found</Text>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => goBackOrReplace(router, '/(tabs)/courses')}>
          <Text style={styles.secondaryBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentBoardView: TajweedBoardView = liveClass.active_board_view || 'mushaf';
  const highlightedWords = liveClass.highlighted_words || [];
  const currentAyah = liveClass.current_ayah_or_page || 1;
  const activeSpeakerName = liveClass.active_speaker_name || liveClass.teacher_name;

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, '/(tabs)/courses')} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {liveClass.title}
          </Text>
          <Text style={styles.subtitle}>Ustaadha: {liveClass.teacher_name}</Text>
        </View>
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.livePillText}>LIVE</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Purdah Protection Banner */}
        <View style={styles.purdahBanner}>
          <View style={styles.purdahIconBox}>
            <Ionicons name="shield-checkmark" size={18} color="#92400E" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.purdahRow}>
              <Text style={styles.purdahTitle}>Purdah Mode Active</Text>
              <View style={styles.cameraOffBadge}>
                <Ionicons name="videocam-off" size={11} color="#92400E" />
                <Text style={styles.cameraOffText}>Camera Locked OFF</Text>
              </View>
            </View>
            <Text style={styles.purdahSub}>Audio-first Quranic recitation & modesty protection enabled for all sisters.</Text>
          </View>
        </View>

        {/* Audio Wave & Active Reciter Bar */}
        <View style={styles.speakerCard}>
          <View style={styles.speakerAvatar}>
            <Ionicons name="person" size={20} color={COLORS.primary} />
            <Animated.View style={[styles.pulseRing, { transform: [{ scale: waveAnim }] }]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.speakerLabel}>Current Reciter / Speaker:</Text>
            <Text style={styles.speakerName} numberOfLines={1}>
              {activeSpeakerName} {isSpeaking && '(Speaking)'}
            </Text>
          </View>
          <View style={styles.audioWaveIndicator}>
            <Ionicons name="volume-high" size={18} color={COLORS.primary} />
            <Text style={styles.waveText}>HD Audio</Text>
          </View>
        </View>

        {/* Interactive Tajweed & Makharij Board */}
        <View style={styles.boardSection}>
          <TajweedBoard
            viewMode={currentBoardView}
            isTeacher={isTeacher}
            highlightedWords={highlightedWords}
            currentAyahOrPage={currentAyah}
            onViewModeChange={handleViewModeChange}
            onToggleHighlight={handleToggleHighlight}
          />
        </View>

        {/* Tilawat / Recitation Queue */}
        <View style={styles.queueCard}>
          <View style={styles.queueHeader}>
            <View style={styles.queueTitleRow}>
              <Ionicons name="people-outline" size={16} color={COLORS.primary} />
              <Text style={styles.queueTitle}>Tilawat Recitation Queue ({liveClass.recitation_queue?.length || 0})</Text>
            </View>
            {!isTeacher && (
              <TouchableOpacity
                style={[styles.raiseHandBtn, isStudentWaitingInQueue && styles.raiseHandBtnActive]}
                onPress={handleRaiseHand}
                disabled={isStudentWaitingInQueue}
              >
                <Ionicons name="hand-right" size={14} color="#fff" />
                <Text style={styles.raiseHandBtnText}>
                  {isStudentWaitingInQueue ? 'In Recitation Queue' : 'Raise Hand for Tilawat'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {(!liveClass.recitation_queue || liveClass.recitation_queue.length === 0) ? (
            <Text style={styles.emptyQueueText}>No students in recitation queue. Tap "Raise Hand" to recite for Ustaadha.</Text>
          ) : (
            <View style={styles.queueList}>
              {liveClass.recitation_queue.map((q, idx) => (
                <View key={idx} style={styles.queueItem}>
                  <View style={styles.queueItemLeft}>
                    <Text style={styles.queueNum}>#{idx + 1}</Text>
                    <Text style={styles.queueItemName}>{q.name}</Text>
                    {q.status === 'speaking' && (
                      <View style={styles.speakingBadge}>
                        <Text style={styles.speakingBadgeText}>RECITE NOW</Text>
                      </View>
                    )}
                  </View>
                  {isTeacher && (
                    <View style={styles.queueItemActions}>
                      {q.status !== 'speaking' ? (
                        <TouchableOpacity
                          style={styles.grantBtn}
                          onPress={() => handleGrantMic(q.uid, q.name)}
                        >
                          <Ionicons name="mic" size={12} color="#fff" />
                          <Text style={styles.grantBtnText}>Grant Mic</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={styles.lowerBtn}
                          onPress={() => handleLowerHand(q.uid)}
                        >
                          <Ionicons name="checkmark" size={12} color="#fff" />
                          <Text style={styles.lowerBtnText}>Done</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Inbuilt Live Class Audio Recording (Teacher Controls / Student Indicator) */}
        {isTeacher ? (
          <View style={[styles.recordingCard, isRecording && styles.recordingCardActive]}>
            <View style={styles.recordingHeader}>
              <View style={styles.recordingTitleRow}>
                <Ionicons name="mic-circle" size={22} color={isRecording ? COLORS.error : COLORS.primary} />
                <View>
                  <Text style={styles.recordingTitle}>Inbuilt Class Audio Recording</Text>
                  <Text style={styles.recordingSub}>
                    {isRecording
                      ? 'Microphone audio recording in progress'
                      : 'Auto-saves to Madrasa Recordings library'}
                  </Text>
                </View>
              </View>
              {isRecording && (
                <View style={styles.recBadge}>
                  <View style={styles.recDot} />
                  <Text style={styles.recText}>REC {formatDuration(recordingDurationSec)}</Text>
                </View>
              )}
            </View>

            {isSavingRecording ? (
              <View style={styles.savingRow}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.savingText}>Uploading to Madrasa Cloud Storage ({saveProgress}%)...</Text>
              </View>
            ) : isRecording ? (
              <TouchableOpacity
                style={styles.stopRecBtn}
                onPress={handleStopAndSaveAudioRecording}
              >
                <Ionicons name="stop" size={18} color="#fff" />
                <Text style={styles.stopRecBtnText}>Stop & Save Class Recording</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.startRecBtn}
                onPress={handleStartAudioRecording}
              >
                <Ionicons name="radio-button-on" size={18} color="#fff" />
                <Text style={styles.startRecBtnText}>Start Audio Recording</Text>
              </TouchableOpacity>
            )}

            {savedRecording && !isRecording && !isSavingRecording && (
              <View style={styles.savedNotice}>
                <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                <Text style={styles.savedNoticeText} numberOfLines={1}>
                  Saved: {savedRecording.title} ({formatDuration(savedRecording.duration_sec)})
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.studentAudioBadge}>
            <Ionicons name="volume-medium" size={16} color={COLORS.primary} />
            <Text style={styles.studentAudioText}>
              High-fidelity Quranic audio stream active • Modesty protected
            </Text>
          </View>
        )}

        {/* Audio Controls & External Bridge */}
        <View style={styles.controlsCard}>
          <TouchableOpacity
            style={[styles.micBtn, !micMuted && styles.micBtnActive]}
            onPress={() => setMicMuted(!micMuted)}
          >
            <Ionicons name={micMuted ? 'mic-off' : 'mic'} size={20} color={micMuted ? COLORS.textSecondary : '#fff'} />
            <Text style={[styles.micBtnText, !micMuted && styles.micBtnTextActive]}>
              {micMuted ? 'Microphone Muted' : 'Microphone Active'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.meetBridgeBtn, joining && { opacity: 0.7 }]}
            onPress={handleJoinExternalMeet}
            disabled={joining}
          >
            {joining ? (
              <ActivityIndicator color={COLORS.primary} size="small" />
            ) : (
              <>
                <Ionicons name="share-social-outline" size={16} color={COLORS.primary} />
                <Text style={styles.meetBridgeBtnText}>Open Screen Share / Google Meet Bridge</Text>
              </>
            )}
          </TouchableOpacity>

          {isTeacher && (
            <TouchableOpacity style={styles.dangerBtn} onPress={handleEndClass}>
              <Ionicons name="stop-circle-outline" size={16} color={COLORS.error} />
              <Text style={styles.dangerBtnText}>End Live Class Session</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  errorTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700', marginBottom: SPACING.md },
  secondaryBtn: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
    paddingHorizontal: SPACING.lg,
  },
  secondaryBtnText: { color: COLORS.text, fontSize: 15, fontWeight: '500' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { padding: SPACING.xs },
  headerTitleContainer: { flex: 1, marginLeft: SPACING.sm },
  title: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  subtitle: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '400' },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDECEC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    gap: 4,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.error },
  livePillText: { fontSize: 10, fontWeight: '700', color: COLORS.error },
  scroll: { flex: 1 },
  scrollContent: { padding: SPACING.md, gap: SPACING.md },
  purdahBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 10,
  },
  purdahIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  purdahRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  purdahTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  cameraOffBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDE68A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    gap: 3,
  },
  cameraOffText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#92400E',
  },
  purdahSub: {
    fontSize: 10,
    color: '#B45309',
    lineHeight: 14,
  },
  speakerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
    ...SHADOWS.card,
  },
  speakerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8F5EE',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  pulseRing: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: COLORS.primary,
    opacity: 0.5,
  },
  speakerLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  speakerName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  audioWaveIndicator: {
    alignItems: 'center',
    gap: 2,
  },
  waveText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.primary,
  },
  boardSection: {
    width: '100%',
  },
  queueCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  queueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  queueTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  queueTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  raiseHandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    gap: 4,
  },
  raiseHandBtnActive: {
    backgroundColor: COLORS.secondary,
  },
  raiseHandBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  emptyQueueText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    paddingVertical: 4,
  },
  queueList: {
    gap: 6,
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
    padding: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  queueItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  queueNum: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  queueItemName: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  speakingBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  speakingBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#065F46',
  },
  queueItemActions: {
    flexDirection: 'row',
    gap: 6,
  },
  grantBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    gap: 3,
  },
  grantBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  lowerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    gap: 3,
  },
  lowerBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  controlsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
    ...SHADOWS.card,
  },
  micBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.full,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  micBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  micBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  micBtnTextActive: {
    color: '#fff',
  },
  meetBridgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5EE',
    borderRadius: RADIUS.full,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#C6E8D4',
    gap: 8,
  },
  meetBridgeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDECEC',
    borderRadius: RADIUS.full,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    gap: 6,
  },
  dangerBtnText: {
    color: COLORS.error,
    fontSize: 12,
    fontWeight: '700',
  },
  recordingCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
    ...SHADOWS.card,
  },
  recordingCardActive: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFF8F8',
  },
  recordingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recordingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  recordingTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  recordingSub: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  recBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDE8E8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    gap: 5,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.error,
  },
  recText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.error,
  },
  startRecBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingVertical: 12,
    gap: 8,
  },
  startRecBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  stopRecBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.error,
    borderRadius: RADIUS.full,
    paddingVertical: 12,
    gap: 8,
  },
  stopRecBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  savingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    padding: 12,
    borderRadius: RADIUS.md,
    gap: 8,
  },
  savingText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  savedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    gap: 6,
  },
  savedNoticeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.success,
    flex: 1,
  },
  studentAudioBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5EE',
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
    gap: 8,
    borderWidth: 1,
    borderColor: '#C6E8D4',
  },
  studentAudioText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
    flex: 1,
  },
});
