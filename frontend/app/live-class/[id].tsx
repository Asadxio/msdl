import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Linking,
  PermissionsAndroid,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  ChannelProfileType,
  ClientRoleType,
  RenderModeType,
  RtcSurfaceView,
  VideoSourceType,
  createAgoraRtcEngine,
  type IRtcEngine,
  type IRtcEngineEventHandler,
} from 'react-native-agora';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { isExpoGo } from '@/lib/runtime';
import { useAuth } from '@/context/AuthContext';
import {
  canCurrentUserJoinLiveClass,
  endLiveClassAndSyncAttendance,
  getLiveApiSetupMessage,
  isLiveApiConfigured,
  markParticipantJoined,
  markParticipantLeft,
  requestLiveClassToken,
  setLiveClassStatus,
  startCloudRecording,
  stopCloudRecording,
  subscribeLiveClass,
  subscribeLiveParticipants,
  updateParticipantMediaState,
  updateParticipantModerationState,
  writeParticipantHeartbeat,
  cleanupStaleParticipants,
  type LiveClass,
  type LiveClassParticipant,
} from '@/lib/liveClasses';
import {
  HEARTBEAT_INTERVAL_MS,
  buildReconnectDiagnostics,
  getReconnectDelayMs,
  shallowChanged,
  type ReconnectDiagnostics,
} from '@/lib/liveClassReliability';
import { applySingleModerationAction, runModerationBurst, type ModerationAction, type RecordingEngineState } from '@/lib/liveClassOps';
import { clearLiveClassRecovery, loadLiveClassRecovery, saveLiveClassRecovery } from '@/lib/liveClassRecoveryCache';
import { recordLiveMetric } from '@/lib/liveClassObservability';
import { buildSyntheticModerationBurst } from '@/lib/liveClassDevLoadTools';
import { LIVE_OPS } from '@/lib/liveOpsConfig';

type RemoteUser = { uid: number; audioMuted?: boolean; videoMuted?: boolean; lastSpokeAtMs?: number };

const MAX_REMOTE_VIDEO_TILES = 8;

type TileItem = {
  key: string;
  uid: number;
  name: string;
  role: 'teacher' | 'student' | 'admin';
  isLocal: boolean;
  audioEnabled: boolean;
  videoEnabled: boolean;
  forceMuted?: boolean;
};

async function requestClassroomPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const permissions = [
    PermissionsAndroid.PERMISSIONS.CAMERA,
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  ];
  const alreadyGranted = await Promise.all(permissions.map((permission) => PermissionsAndroid.check(permission)));
  if (alreadyGranted.every(Boolean)) return true;
  const result = await PermissionsAndroid.requestMultiple(permissions);
  const cameraGranted = result[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED;
  const micGranted = result[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
  const blocked = Object.values(result).some((status) => status === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN);
  if (blocked) {
    Alert.alert(
      'Permissions blocked',
      'Camera or microphone access is blocked. Open device settings to enable permissions before joining.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => { Linking.openSettings().catch(() => {}); } },
      ],
    );
  }
  return cameraGranted && micGranted;
}

function getParticipantJoinDate(participant?: LiveClassParticipant | null): Date | null {
  try {
    return participant?.last_joined_at?.toDate ? participant.last_joined_at.toDate() : null;
  } catch {
    return null;
  }
}

function assertAgoraResult(operation: string, result: number | void): void {
  if (typeof result === 'number' && result < 0) {
    throw new Error(`${operation} failed (${result}). Please restart the app and try again.`);
  }
}

export default function LiveClassroomScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const classId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const engineRef = useRef<IRtcEngine | null>(null);
  const eventHandlerRef = useRef<IRtcEngineEventHandler | null>(null);
  const tokenRenewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const joinedRef = useRef(false);
  const leavingRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectingGuardRef = useRef(false);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectStartedAtRef = useRef(0);
  const prevMediaSyncRef = useRef<{ audio_enabled?: boolean; video_enabled?: boolean } | null>(null);
  const moderationQueueRef = useRef<ModerationAction[]>([]);
  const moderationBusyRef = useRef(false);
  const recordingPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const joiningLockRef = useRef(false);
  const recordingRecoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatLastWriteRef = useRef(0);

  const [liveClass, setLiveClass] = useState<LiveClass | null>(null);
  const [participants, setParticipants] = useState<LiveClassParticipant[]>([]);
  const [remoteUsers, setRemoteUsers] = useState<RemoteUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const liveApiReady = isLiveApiConfigured();
  const [joined, setJoined] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [recordingBusy, setRecordingBusy] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [error, setError] = useState('');
  const [networkHint, setNetworkHint] = useState('');
  const [reconnectDiag, setReconnectDiag] = useState<ReconnectDiagnostics>({
    phase: 'idle',
    lastReconnectReason: '',
    lastReconnectAtMs: 0,
    reconnectLatencyMs: 0,
    reconnectAttemptCount: 0,
  });
  const [recordingState, setRecordingState] = useState<RecordingEngineState>('idle');
  const [recordingMessage, setRecordingMessage] = useState('');
  const [opsMessage, setOpsMessage] = useState('');
  const expoGo = isExpoGo();
  const isLowEndAndroid = Platform.OS === 'android';

  const isTeacher = profile?.role === 'teacher' || profile?.role === 'admin';
  const localParticipant = useMemo(
    () => participants.find((p) => p.user_id === user?.uid) || null,
    [participants, user?.uid],
  );
  const participantsByAgoraUid = useMemo(() => {
    const map: Record<number, LiveClassParticipant> = {};
    participants.forEach((p) => {
      if (p.agora_uid) map[p.agora_uid] = p;
    });
    return map;
  }, [participants]);
  const activeParticipants = useMemo(() => participants.filter((p) => p.joined), [participants]);
  const participantPriority = useMemo(() => {
    const teacherUid = liveClass?.teacher_id || '';
    const speakerNow = new Set(remoteUsers.filter((r) => (r.lastSpokeAtMs || 0) > Date.now() - 12000).map((r) => r.uid));
    return activeParticipants.slice().sort((a, b) => {
      const rank = (p: LiveClassParticipant) => {
        if (p.user_id === teacherUid || p.role === 'teacher') return 0;
        if (speakerNow.has(p.agora_uid)) return 1;
        if (p.role === 'admin') return 2;
        return 3;
      };
      return rank(a) - rank(b);
    });
  }, [activeParticipants, liveClass?.teacher_id, remoteUsers]);


  const cleanupAgora = useCallback(() => {
    if (tokenRenewTimerRef.current) {
      clearTimeout(tokenRenewTimerRef.current);
      tokenRenewTimerRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    if (recordingPollRef.current) {
      clearInterval(recordingPollRef.current);
      recordingPollRef.current = null;
    }
    if (recordingRecoverTimerRef.current) {
      clearTimeout(recordingRecoverTimerRef.current);
      recordingRecoverTimerRef.current = null;
    }
    const engine = engineRef.current;
    if (!engine) return;
    const handler = eventHandlerRef.current;
    if (handler) engine.unregisterEventHandler(handler);
    try { engine.stopPreview(); } catch {}
    try { engine.leaveChannel(); } catch {}
    try { engine.release(); } catch {}
    engineRef.current = null;
    eventHandlerRef.current = null;
    setReconnecting(false);
    recordLiveMetric('rtc_cleanup', { classId: classId || '' });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanupAgora();
    };
  }, [cleanupAgora]);

  const syncMediaState = useCallback(async (next: { audio_enabled?: boolean; video_enabled?: boolean }) => {
    if (!classId || !user?.uid) return;
    if (!shallowChanged(prevMediaSyncRef.current, next)) return;
    prevMediaSyncRef.current = next;
    await updateParticipantMediaState(classId, user.uid, next).catch(() => {});
  }, [classId, user?.uid]);

  const leaveClass = useCallback(async (navigateBack = true, syncAttendance = true) => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    try {
      cleanupAgora();
      if (syncAttendance && joinedRef.current && classId && user?.uid) {
        await markParticipantLeft(classId, user.uid, getParticipantJoinDate(localParticipant)).catch(() => {});
      }
      joinedRef.current = false;
      setJoined(false);
      setReconnecting(false);
      setRemoteUsers([]);
      if (navigateBack) router.back();
      if (classId && user?.uid) void clearLiveClassRecovery(classId, user.uid);
      setOpsMessage('');
    } finally {
      leavingRef.current = false;
    }
  }, [classId, cleanupAgora, localParticipant, router, user?.uid]);

  const postOpsEvent = useCallback(async (event: string, payload: Record<string, unknown> = {}) => {
    if (!LIVE_OPS.telemetryEnabled || !LIVE_OPS.opsEndpoint) return;
    const base = String(LIVE_OPS.opsEndpoint || '').replace(/\/$/, '');
    const body = {
      event,
      class_id: classId || '',
      user_role: profile?.role || 'unknown',
      participant_count: activeParticipants.length,
      reconnect_phase: reconnectDiag.phase,
      device_tier: isLowEndAndroid ? 'low_end_android' : Platform.OS,
      ...payload,
    };
    fetch(`${base}/api/live-ops/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {});
  }, [activeParticipants.length, classId, isLowEndAndroid, profile?.role, reconnectDiag.phase]);

  useEffect(() => {
    if (!classId || !user?.uid) return;
    loadLiveClassRecovery(classId, user.uid).then((cached) => {
      if (!cached) return;
      if (cached.handRaised && !localParticipant?.hand_raised) {
        updateParticipantModerationState(classId, user.uid, { hand_raised: true }).catch(() => {});
      }
      if (cached.recordingState === 'recovering' && isTeacher) {
        setRecordingState('recovering');
        setRecordingMessage('Recovering recording…');
      }
    });
  }, [classId, isTeacher, localParticipant?.hand_raised, user?.uid]);

  useEffect(() => {
    if (!classId || !user?.uid) return;
    saveLiveClassRecovery({
      classId,
      userId: user.uid,
      reconnectPhase: reconnectDiag.phase,
      handRaised: localParticipant?.hand_raised === true,
      recordingState,
      pendingModerationCount: moderationQueueRef.current.length,
      savedAtMs: Date.now(),
    }).catch(() => {});
  }, [classId, localParticipant?.hand_raised, reconnectDiag.phase, recordingState, user?.uid]);

  useEffect(() => {
    if (!classId) return;
    const unsubClass = subscribeLiveClass(classId, (next) => {
      setLiveClass(next);
      setLoading(false);
    });
    const unsubParticipants = subscribeLiveParticipants(classId, setParticipants);
    return () => {
      unsubClass();
      unsubParticipants();
    };
  }, [classId]);

  useEffect(() => {
    if (liveClass?.status === 'ended' && joinedRef.current) {
      Alert.alert('Class ended', 'The teacher ended this live class.');
      void leaveClass(false, false);
    }
  }, [leaveClass, liveClass?.status]);

  useEffect(() => {
    if (!joined || !localParticipant?.force_muted || !classId || !user?.uid) return;
    engineRef.current?.muteLocalAudioStream(true);
    setMicOn(false);
    updateParticipantMediaState(classId, user.uid, { audio_enabled: false }).catch(() => {});
    Alert.alert('Muted by teacher', 'Your microphone was muted by the teacher.');
  }, [classId, joined, localParticipant?.force_muted, user?.uid]);

  useEffect(() => {
    if (!joined || !localParticipant?.moderation?.removed) return;
    Alert.alert('Removed by teacher', 'You were removed from this class by the host.');
    void leaveClass(true, false);
  }, [joined, leaveClass, localParticipant?.moderation?.removed]);

  useEffect(() => () => {
    if (joinedRef.current && classId && user?.uid) {
      markParticipantLeft(classId, user.uid, getParticipantJoinDate(localParticipant)).catch(() => {});
      joinedRef.current = false;
    }
  }, [classId, localParticipant, user?.uid]);

  const scheduleTokenRenewal = useCallback((expiresAtEpoch: number) => {
    if (tokenRenewTimerRef.current) clearTimeout(tokenRenewTimerRef.current);
    const renewInMs = Math.max(30000, (expiresAtEpoch - Math.floor(Date.now() / 1000) - 60) * 1000);
    tokenRenewTimerRef.current = setTimeout(async () => {
      if (!classId || !engineRef.current || !joinedRef.current) return;
      try {
        const nextToken = await requestLiveClassToken(classId);
        engineRef.current?.renewToken(nextToken.rtcToken);
        scheduleTokenRenewal(nextToken.expiresAtEpoch);
      } catch (err) {
        console.log('[LiveClass] token renewal failed', err);
      }
    }, renewInMs);
  }, [classId]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      const previous = appStateRef.current;
      appStateRef.current = nextState;
      if (!joinedRef.current || !classId || !user?.uid) return;
      if (nextState === 'background' || nextState === 'inactive') {
        try { engineRef.current?.muteLocalVideoStream(true); } catch {}
        try { engineRef.current?.muteLocalAudioStream(true); } catch {}
        setCameraOn(false);
        setMicOn(false);
        await syncMediaState({ video_enabled: false, audio_enabled: false });
      } else if (previous.match(/inactive|background/) && nextState === 'active') {
        try { engineRef.current?.setEnableSpeakerphone(speakerOn); } catch {}
        const resumeVideoOn = localParticipant?.video_enabled !== false;
        const resumeAudioOn = localParticipant?.audio_enabled !== false && !localParticipant?.force_muted;
        try { engineRef.current?.muteLocalVideoStream(!resumeVideoOn); } catch {}
        try { engineRef.current?.muteLocalAudioStream(!resumeAudioOn); } catch {}
        setCameraOn(resumeVideoOn);
        setMicOn(resumeAudioOn);
        await syncMediaState({
          video_enabled: resumeVideoOn,
          audio_enabled: resumeAudioOn,
        });
      }
    });
    return () => sub.remove();
  }, [classId, localParticipant?.audio_enabled, localParticipant?.force_muted, localParticipant?.video_enabled, speakerOn, syncMediaState, user?.uid]);

  useEffect(() => {
    if (!joined || !classId || !user?.uid) return;
    heartbeatTimerRef.current = setInterval(() => {
      const now = Date.now();
      if (now - heartbeatLastWriteRef.current < HEARTBEAT_INTERVAL_MS - 1000) return;
      heartbeatLastWriteRef.current = now;
      writeParticipantHeartbeat(classId, user.uid).catch(() => {});
    }, HEARTBEAT_INTERVAL_MS);
    return () => {
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    };
  }, [classId, joined, user?.uid]);

  const joinClass = useCallback(async () => {
    if (expoGo) {
      Alert.alert('Development Build Required', 'Live Classes require Development Build or APK.');
      return;
    }
    if (!classId || !user?.uid || !profile || !liveClass || joining || joined || joiningLockRef.current) return;
    joiningLockRef.current = true;
    setError('');
    setJoining(true);
    try {
      const allowed = await canCurrentUserJoinLiveClass(liveClass, profile);
      if (!allowed) {
        Alert.alert('Access denied', 'You are not enrolled for this live class.');
        return;
      }
      const permissionsOk = await requestClassroomPermissions();
      if (!permissionsOk) {
        Alert.alert('Permissions required', 'Camera and microphone permissions are required to join live class.');
        return;
      }
      if (engineRef.current) cleanupAgora();
      const rtcToken = await requestLiveClassToken(classId);
      if (!rtcToken.appId || !rtcToken.rtcToken || !rtcToken.channelName || !rtcToken.agoraUid) {
        Alert.alert('Live token unavailable', 'Could not get a secure live class token.');
        return;
      }
      const engine = createAgoraRtcEngine();
      engineRef.current = engine;
      const handler: IRtcEngineEventHandler = {
        onJoinChannelSuccess: () => {
          setReconnecting(false);
          joinedRef.current = true;
          setJoined(true);
          void markParticipantJoined(classId, profile, user.uid, rtcToken.agoraUid).catch(() => {});
        },
        onConnectionStateChanged: (_connection, state, reason) => {
          if (state === 3) {
            reconnectAttemptsRef.current += 1;
            reconnectStartedAtRef.current = Date.now();
            setReconnecting(true);
            setNetworkHint('Network unstable. Trying to reconnect…');
            setReconnectDiag(buildReconnectDiagnostics('reconnecting', `state_${reason}`, reconnectStartedAtRef.current, reconnectAttemptsRef.current));
            recordLiveMetric('reconnect_attempt', { reason, attempt: reconnectAttemptsRef.current });
            void postOpsEvent('reconnect_attempt', { reason, attempt: reconnectAttemptsRef.current });
            if (isTeacher) setLiveClassStatus(classId, 'reconnecting').catch(() => {});
            if (!reconnectingGuardRef.current) {
              reconnectingGuardRef.current = true;
              const attempt = reconnectAttemptsRef.current;
              const delay = getReconnectDelayMs(attempt);
              reconnectTimerRef.current = setTimeout(() => {
                reconnectingGuardRef.current = false;
                if (!joinedRef.current || !engineRef.current) return;
                if (attempt >= 8) {
                  setReconnectDiag(buildReconnectDiagnostics('failed', 'max_attempts', reconnectStartedAtRef.current || Date.now(), attempt));
                  setNetworkHint('Reconnect failed');
                  recordLiveMetric('reconnect_failed', { attempt });
                  void postOpsEvent('reconnect_failed', { attempt });
                  return;
                }
                setReconnectDiag(buildReconnectDiagnostics('rejoining', 'scheduled_rejoin', reconnectStartedAtRef.current || Date.now(), attempt));
                try { engineRef.current?.leaveChannel(); } catch {}
              }, delay);
            }
          }
          if (state === 5) {
            setReconnecting(false);
            setError(`Connection failed (${reason}). Tap Join to re-enter safely.`);
            setRemoteUsers([]);
          }
          if (state === 1 || state === 4) {
            setReconnecting(false);
            setNetworkHint('Recovered connection');
            reconnectAttemptsRef.current = 0;
            setReconnectDiag(buildReconnectDiagnostics('recovered', 'connected', reconnectStartedAtRef.current || Date.now(), 0));
            recordLiveMetric('reconnect_recovered', { latency_ms: Date.now() - (reconnectStartedAtRef.current || Date.now()) });
            void postOpsEvent('reconnect_recovered', { latency_ms: Date.now() - (reconnectStartedAtRef.current || Date.now()) });
            if (isTeacher && liveClass?.status === 'reconnecting') setLiveClassStatus(classId, 'live').catch(() => {});
          }
        },
        onUserJoined: (_connection, remoteUid) => {
          setRemoteUsers((prev) => {
            if (prev.some((u) => u.uid === remoteUid)) return prev;
            const videoMuted = prev.length >= MAX_REMOTE_VIDEO_TILES;
            if (videoMuted) {
              try { engineRef.current?.muteRemoteVideoStream(remoteUid, true); } catch {}
            }
            return [...prev, { uid: remoteUid, videoMuted }];
          });
        },
        onUserOffline: (_connection, remoteUid) => {
          setRemoteUsers((prev) => prev.filter((u) => u.uid !== remoteUid));
        },
        onUserMuteAudio: (_connection, remoteUid, muted) => {
          setRemoteUsers((prev) => prev.map((u) => (u.uid === remoteUid ? { ...u, audioMuted: muted } : u)));
        },
        onAudioVolumeIndication: (_connection, speakers) => {
          setRemoteUsers((prev) => prev.map((u) => (speakers.some((s) => s.uid === u.uid && s.volume > 15) ? { ...u, lastSpokeAtMs: Date.now() } : u)));
        },
        onUserMuteVideo: (_connection, remoteUid, muted) => {
          setRemoteUsers((prev) => prev.map((u) => (u.uid === remoteUid ? { ...u, videoMuted: muted } : u)));
        },
        onTokenPrivilegeWillExpire: async () => {
          try {
            const nextToken = await requestLiveClassToken(classId);
            engineRef.current?.renewToken(nextToken.rtcToken);
            scheduleTokenRenewal(nextToken.expiresAtEpoch);
          } catch (err) {
            console.log('[LiveClass] token privilege renewal failed', err);
          }
        },
        onRequestToken: async () => {
          try {
            const nextToken = await requestLiveClassToken(classId);
            engineRef.current?.renewToken(nextToken.rtcToken);
            scheduleTokenRenewal(nextToken.expiresAtEpoch);
          } catch (err) {
            console.log('[LiveClass] token request renewal failed', err);
          }
        },
      };
      eventHandlerRef.current = handler;
      assertAgoraResult('Agora initialize', engine.initialize({ appId: rtcToken.appId }));
      engine.registerEventHandler(handler);
      assertAgoraResult('Enable audio', engine.enableAudio());
      assertAgoraResult('Enable video', engine.enableVideo());
      assertAgoraResult('Enable speaker', engine.setEnableSpeakerphone(true));
      if (isLowEndAndroid) {
        try { engine.setParameters(JSON.stringify({ "che.video.lowBitRateStreamParameter": { width: 160, height: 120, frameRate: 10, bitrate: 65 } })); } catch {}
      }
      assertAgoraResult('Start camera preview', engine.startPreview());
      scheduleTokenRenewal(rtcToken.expiresAtEpoch);
      const joinResult = engine.joinChannel(rtcToken.rtcToken, rtcToken.channelName, rtcToken.agoraUid, {
        channelProfile: ChannelProfileType.ChannelProfileCommunication,
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        publishMicrophoneTrack: true,
        publishCameraTrack: true,
        autoSubscribeAudio: true,
        autoSubscribeVideo: true,
      });
      assertAgoraResult('Agora join', joinResult);
    } catch (err: any) {
      cleanupAgora();
      setError(err?.message || 'Could not join live class.');
      Alert.alert('Join failed', err?.message || 'Could not join live class.');
    } finally {
      joiningLockRef.current = false;
      setJoining(false);
    }
  }, [classId, cleanupAgora, expoGo, isLowEndAndroid, isTeacher, joining, joined, liveClass, profile, scheduleTokenRenewal, user?.uid]);

  const toggleMic = useCallback(async () => {
    if (!classId || !user?.uid || localParticipant?.force_muted) {
      Alert.alert('Microphone disabled', 'Your microphone is muted by the teacher.');
      return;
    }
    const next = !micOn;
    try { engineRef.current?.muteLocalAudioStream(!next); } catch {}
    setMicOn(next);
    await syncMediaState({ audio_enabled: next }).catch(() => {});
  }, [classId, localParticipant?.force_muted, micOn, syncMediaState, user?.uid]);

  const toggleCamera = useCallback(async () => {
    if (!classId || !user?.uid) return;
    const next = !cameraOn;
    try { engineRef.current?.muteLocalVideoStream(!next); } catch {}
    setCameraOn(next);
    await syncMediaState({ video_enabled: next }).catch(() => {});
  }, [cameraOn, classId, syncMediaState, user?.uid]);

  const toggleSpeaker = useCallback(() => {
    const next = !speakerOn;
    try { engineRef.current?.setEnableSpeakerphone(next); } catch {}
    setSpeakerOn(next);
  }, [speakerOn]);

  const muteParticipant = useCallback(async (participant: LiveClassParticipant) => {
    if (!isTeacher || !classId || participant.user_id === user?.uid) return;
    try { engineRef.current?.muteRemoteAudioStream(participant.agora_uid, true); } catch {}
    moderationQueueRef.current.push({ type: 'mute', classId, target: participant, reason: 'Teacher muted participant' });
  }, [classId, isTeacher, user?.uid]);

  const removeParticipant = useCallback(async (participant: LiveClassParticipant) => {
    if (!isTeacher || !classId || participant.user_id === user?.uid) return;
    moderationQueueRef.current.push({ type: 'remove', classId, target: participant, reason: 'Teacher removed participant' });
  }, [classId, isTeacher, user?.uid]);

  const toggleHandRaise = useCallback(async () => {
    if (!classId || !user?.uid) return;
    await updateParticipantModerationState(classId, user.uid, { hand_raised: !localParticipant?.hand_raised }).catch(() => {});
  }, [classId, localParticipant?.hand_raised, user?.uid]);

  const toggleRecording = useCallback(async () => {
    if (!classId || !isTeacher || recordingBusy) return;
    if (LIVE_OPS.emergencyRecordingDisabled) {
      setOpsMessage('Recording temporarily disabled by operations.');
      return;
    }
    setRecordingBusy(true);
    try {
      const status = liveClass?.recording?.status || 'not_started';
      if (status === 'recording' || status === 'starting') {
        setRecordingState('stopping');
        await stopCloudRecording(classId);
        setRecordingState('idle');
        setRecordingMessage('Recording stopped');
      } else {
        setRecordingState('starting');
        await startCloudRecording(classId);
        setRecordingState('active');
        setRecordingMessage('Recording restored');
        void postOpsEvent('recording_restored');
      }
    } catch (err: any) {
      setRecordingState('recovering');
      setRecordingMessage('Recovering recording…');
      recordingRecoverTimerRef.current = setTimeout(() => {
        if (!mountedRef.current || !classId) return;
        startCloudRecording(classId).then(() => {
          if (!mountedRef.current) return;
          setRecordingState('active');
          setRecordingMessage('Recording restored');
        }).catch(() => {
          if (!mountedRef.current) return;
          setRecordingState('failed');
          setRecordingMessage('Recording verification failed');
          void postOpsEvent('recording_recovery_failed');
        });
      }, 1500);
      void postOpsEvent('recording_toggle_failed', { error: String(err?.message || 'unknown') });
      Alert.alert('Recording failed', err?.message || 'Could not update cloud recording.');
    } finally {
      setRecordingBusy(false);
    }
  }, [classId, isTeacher, liveClass?.recording?.status, postOpsEvent, recordingBusy]);

  useEffect(() => {
    if (!isTeacher || !classId || !joined) return;
    recordingPollRef.current = setInterval(() => {
      const status = liveClass?.recording?.status || 'not_started';
      if (status === 'recording' && recordingState !== 'active') setRecordingState('active');
      if (status === 'failed' && recordingState !== 'failed') {
        setRecordingState('recovering');
        setRecordingMessage('Recovering recording…');
      }
    }, 20000);
    return () => {
      if (recordingPollRef.current) clearInterval(recordingPollRef.current);
      recordingPollRef.current = null;
    };
  }, [classId, isTeacher, joined, liveClass?.recording?.status, recordingState]);

  useEffect(() => {
    if (!isTeacher || !classId) return;
    const timer = setInterval(async () => {
      if (moderationBusyRef.current || moderationQueueRef.current.length === 0) return;
      moderationBusyRef.current = true;
      const chunk = moderationQueueRef.current.splice(0, 20);
      try {
        if (chunk.length > 1) await runModerationBurst(chunk);
        else await applySingleModerationAction(chunk[0]);
      } catch {
        moderationQueueRef.current.unshift(...chunk);
      } finally {
        moderationBusyRef.current = false;
      }
    }, 450);
    return () => clearInterval(timer);
  }, [classId, isTeacher]);

  useEffect(() => {
    if (!__DEV__ || !isTeacher || !classId || participants.length < 5) return;
    const synthetic = buildSyntheticModerationBurst(classId, participants, 6);
    if (synthetic.length > 0 && moderationQueueRef.current.length === 0) {
      recordLiveMetric('dev_moderation_burst_seeded', { size: synthetic.length });
    }
  }, [classId, isTeacher, participants]);

  const endClass = useCallback(() => {
    if (!classId || !liveClass || !isTeacher) return;
    Alert.alert('End live class', 'End this class for everyone and sync attendance?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Class',
        style: 'destructive',
        onPress: async () => {
          try {
            if (liveClass.recording?.status === 'recording' || liveClass.recording?.status === 'starting') {
              await stopCloudRecording(classId).catch(() => {});
            }
            await endLiveClassAndSyncAttendance(classId, liveClass, profile);
            await leaveClass(true, false);
          } catch (err: any) {
            Alert.alert('End failed', err?.message || 'Could not end class.');
          }
        },
      },
    ]);
  }, [classId, isTeacher, leaveClass, liveClass, profile]);

  const tiles = useMemo<TileItem[]>(() => {
    const teacherParticipant = participants.find((p) => p.role === 'teacher' || p.user_id === liveClass?.teacher_id);
    const localTile: TileItem | null = joined && user?.uid ? {
      key: `local-${user.uid}`,
      uid: 0,
      name: profile?.name || 'You',
      role: profile?.role === 'admin' ? 'admin' : profile?.role === 'teacher' ? 'teacher' : 'student',
      isLocal: true,
      audioEnabled: micOn,
      videoEnabled: cameraOn,
      forceMuted: localParticipant?.force_muted,
    } : null;
    const remoteTiles = remoteUsers
      .slice(0, isLowEndAndroid ? 12 : 24)
      .map((remote) => {
      const participant = participantsByAgoraUid[remote.uid];
      return {
        key: `remote-${remote.uid}`,
        uid: remote.uid,
        name: participant?.name || `Participant ${remote.uid}`,
        role: participant?.role || 'student',
        isLocal: false,
        audioEnabled: !remote.audioMuted && participant?.audio_enabled !== false,
        videoEnabled: !remote.videoMuted && participant?.video_enabled !== false,
        forceMuted: participant?.force_muted,
      } as TileItem;
    });
    const all = [localTile, ...remoteTiles].filter(Boolean) as TileItem[];
    return all.sort((a, b) => {
      const aTeacher = a.role === 'teacher' || a.uid === teacherParticipant?.agora_uid;
      const bTeacher = b.role === 'teacher' || b.uid === teacherParticipant?.agora_uid;
      if (aTeacher !== bTeacher) return aTeacher ? -1 : 1;
      if (a.isLocal !== b.isLocal) return a.isLocal ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [cameraOn, isLowEndAndroid, joined, liveClass?.teacher_id, localParticipant?.force_muted, micOn, participants, participantsByAgoraUid, profile?.name, profile?.role, remoteUsers, user?.uid]);

  const renderTile = useCallback(({ item, index }: { item: TileItem; index: number }) => (
    <View style={[styles.tile, item.role === 'teacher' && styles.teacherTile]}>
      {item.videoEnabled && index < (isLowEndAndroid ? 6 : MAX_REMOTE_VIDEO_TILES) ? (
        <RtcSurfaceView
          style={styles.video}
          canvas={{
            uid: item.isLocal ? 0 : item.uid,
            sourceType: item.isLocal ? VideoSourceType.VideoSourceCameraPrimary : undefined,
            renderMode: RenderModeType.RenderModeHidden,
          }}
        />
      ) : (
        <View style={styles.videoOff}>
          <Ionicons name="person-circle-outline" size={52} color="rgba(255,255,255,0.8)" />
        </View>
      )}
      <View style={styles.tileMeta}>
        <Text style={styles.tileName} numberOfLines={1}>{item.isLocal ? `${item.name} (You)` : item.name}</Text>
        <View style={styles.tileIcons}>
          {item.role === 'teacher' ? <Text style={styles.teacherBadge}>Teacher</Text> : null}
          {item.forceMuted ? <Ionicons name="hand-left" size={14} color="#FDE68A" /> : null}
          <Ionicons name={item.audioEnabled ? 'mic' : 'mic-off'} size={14} color="#fff" />
          <Ionicons name={item.videoEnabled ? 'videocam' : 'videocam-off'} size={14} color="#fff" />
        </View>
      </View>
      {isTeacher && !item.isLocal ? (
        <TouchableOpacity
          style={styles.muteSmallBtn}
          onPress={() => {
            const target = participantsByAgoraUid[item.uid];
            if (target) void muteParticipant(target);
          }}
        >
          <Ionicons name="mic-off" size={14} color="#fff" />
        </TouchableOpacity>
      ) : null}
    </View>
  ), [isLowEndAndroid, isTeacher, muteParticipant, participantsByAgoraUid]);

  useEffect(() => {
    if (!classId || !isTeacher) return;
    const t = setInterval(() => { cleanupStaleParticipants(classId).catch(() => {}); }, 60000);
    return () => clearInterval(t);
  }, [classId, isTeacher]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;
  }

  if (!liveClass) {
    return (
      <View style={[styles.center, { padding: SPACING.lg }]}> 
        <Text style={styles.errorTitle}>Live class not found</Text>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}><Text style={styles.secondaryBtnText}>Go Back</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      {expoGo ? (
        <View style={styles.expoGoBanner}>
          <Ionicons name="information-circle" size={16} color="#7C2D12" />
          <Text style={styles.expoGoBannerText}>Live Classes require Development Build or APK</Text>
        </View>
      ) : null}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}> 
        <TouchableOpacity style={styles.iconBtn} onPress={() => { void leaveClass(true); }}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{liveClass.title}</Text>
          <Text style={styles.subtitle}>{liveClass.status === 'live' ? 'Live now' : liveClass.status} • {activeParticipants.length} joined</Text>
          {!!reconnectDiag.lastReconnectReason ? (
            <Text style={styles.diagText}>Reconnect: {reconnectDiag.phase} • attempts {reconnectDiag.reconnectAttemptCount}</Text>
          ) : null}
          {!!recordingMessage ? <Text style={styles.diagText}>{recordingMessage}</Text> : null}
          {!!opsMessage ? <Text style={styles.diagText}>{opsMessage}</Text> : null}
        </View>
        {isTeacher ? (
          <TouchableOpacity style={styles.recordBtn} onPress={toggleRecording} disabled={recordingBusy}>
            {recordingBusy ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name={liveClass.recording?.status === 'recording' ? 'stop-circle' : 'radio'} size={16} color="#fff" />}
          </TouchableOpacity>
        ) : null}
        {isTeacher ? (
          <TouchableOpacity style={styles.endBtn} onPress={endClass}>
            <Text style={styles.endBtnText}>End</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {!joined ? (
        <View style={styles.joinPanel}>
          <Ionicons name="videocam" size={50} color={COLORS.primary} />
          <Text style={styles.joinTitle}>Ready to join?</Text>
          <Text style={styles.joinText}>Camera and microphone permissions are required for the built-in classroom.</Text>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <TouchableOpacity style={[styles.joinBtn, joining && styles.disabledBtn]} disabled={joining} onPress={joinClass}>
            {joining ? <ActivityIndicator color="#fff" /> : <Text style={styles.joinBtnText}>{expoGo ? 'Development Build Required' : 'Join Live Class'}</Text>}
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {reconnecting ? (
            <View style={styles.reconnectBanner}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.reconnectText}>{networkHint || 'Reconnecting…'}</Text>
            </View>
          ) : null}
          <FlatList
            data={tiles}
            keyExtractor={(item) => item.key}
            renderItem={renderTile}
            numColumns={tiles.length <= 2 ? 1 : 2}
            key={tiles.length <= 2 ? 'one' : 'two'}
            contentContainerStyle={styles.grid}
            removeClippedSubviews={false}
            initialNumToRender={6}
            maxToRenderPerBatch={6}
            windowSize={5}
            updateCellsBatchingPeriod={60}
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          />
        </>
      )}

      {joined ? (
        <View style={[styles.controls, { paddingBottom: insets.bottom + 12 }]}> 
          <TouchableOpacity style={[styles.controlBtn, !micOn && styles.controlBtnOff]} onPress={toggleMic}>
            <Ionicons name={micOn ? 'mic' : 'mic-off'} size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.controlBtn, !cameraOn && styles.controlBtnOff]} onPress={toggleCamera}>
            <Ionicons name={cameraOn ? 'videocam' : 'videocam-off'} size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlBtn} onPress={() => { try { engineRef.current?.switchCamera(); } catch {} }}>
            <Ionicons name="camera-reverse" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.controlBtn, !speakerOn && styles.controlBtnOff]} onPress={toggleSpeaker}>
            <Ionicons name={speakerOn ? 'volume-high' : 'volume-mute'} size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.controlBtn, localParticipant?.hand_raised && styles.controlBtnOff]} onPress={toggleHandRaise}>
            <Ionicons name="hand-left" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.leaveBtn} onPress={() => { void leaveClass(true); }}>
            <Ionicons name="call" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : null}

      {isTeacher && joined ? (
        <View style={styles.teacherDock}>
          <Text style={styles.teacherDockTitle}>Raised hands: {participants.filter((p) => p.hand_raised && p.joined).length}</Text>
          {participantPriority.filter((p) => p.user_id !== user?.uid).slice(0, 8).map((p) => (
            <View key={p.user_id} style={styles.teacherRow}>
              <Text style={styles.teacherName} numberOfLines={1}>{p.name}</Text>
              <TouchableOpacity style={styles.smallDockBtn} onPress={() => { void muteParticipant(p); }}><Text style={styles.smallDockBtnText}>Mute</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.smallDockBtn, styles.smallDockDanger]} onPress={() => { void removeParticipant(p); }}><Text style={styles.smallDockBtnText}>Remove</Text></TouchableOpacity>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07130D' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm, backgroundColor: '#0B1F14' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.72)', fontSize: 12, marginTop: 2 },
  diagText: { color: 'rgba(255,255,255,0.62)', fontSize: 10, marginTop: 2 },
  reconnectBanner: { marginHorizontal: SPACING.md, marginTop: SPACING.sm, borderRadius: RADIUS.full, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: 'rgba(180,83,9,0.95)', alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8 },
  reconnectText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  recordBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#B45309' },
  endBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: RADIUS.full, backgroundColor: COLORS.error },
  endBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  joinPanel: { margin: SPACING.lg, padding: SPACING.lg, borderRadius: RADIUS.xl, backgroundColor: COLORS.surface, alignItems: 'center', ...SHADOWS.card },
  joinTitle: { marginTop: SPACING.sm, fontSize: 22, fontWeight: '800', color: COLORS.textMain },
  joinText: { marginTop: SPACING.xs, fontSize: 13, textAlign: 'center', color: COLORS.textMuted, lineHeight: 20 },
  joinBtn: { marginTop: SPACING.lg, backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingHorizontal: 28, paddingVertical: 14, minWidth: 180, alignItems: 'center' },
  joinBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  disabledBtn: { opacity: 0.65 },
  errorText: { marginTop: SPACING.sm, color: COLORS.error, fontSize: 13, textAlign: 'center' },
  errorTitle: { color: COLORS.textMain, fontSize: 18, fontWeight: '800', marginBottom: SPACING.md },
  secondaryBtn: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.full, paddingHorizontal: 20, paddingVertical: 10 },
  secondaryBtnText: { color: COLORS.primary, fontWeight: '800' },
  grid: { padding: SPACING.sm, gap: SPACING.sm, paddingBottom: 110 },
  tile: { flex: 1, minHeight: 210, margin: 5, borderRadius: RADIUS.xl, overflow: 'hidden', backgroundColor: '#111827', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  teacherTile: { borderColor: COLORS.secondary, borderWidth: 2 },
  video: { flex: 1, minHeight: 210 },
  videoOff: { flex: 1, minHeight: 210, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1F2937' },
  tileMeta: { position: 'absolute', left: 10, right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  tileName: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 },
  tileIcons: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  teacherBadge: { color: '#111827', backgroundColor: COLORS.secondary, borderRadius: 8, overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 2, fontSize: 10, fontWeight: '800' },
  muteSmallBtn: { position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(239,68,68,0.9)', alignItems: 'center', justifyContent: 'center' },
  controls: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 14, paddingHorizontal: SPACING.md, backgroundColor: 'rgba(7,19,13,0.95)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  controlBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' },
  controlBtnOff: { backgroundColor: '#B91C1C' },
  leaveBtn: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.error, transform: [{ rotate: '135deg' }] },
  teacherDock: { position: 'absolute', left: 12, right: 12, bottom: 92, backgroundColor: 'rgba(5,10,8,0.92)', borderRadius: 14, padding: 10, gap: 8 },
  teacherDockTitle: { color: '#fff', fontSize: 12, fontWeight: '800' },
  teacherRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  teacherName: { flex: 1, color: '#fff', fontSize: 12, fontWeight: '700' },
  smallDockBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: '#1F2937' },
  smallDockBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  smallDockDanger: { backgroundColor: '#7F1D1D' },
});
