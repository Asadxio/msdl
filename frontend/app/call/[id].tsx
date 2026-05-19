import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, PermissionsAndroid, Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ChannelProfileType, ClientRoleType, RenderModeType, RtcSurfaceView, VideoSourceType, createAgoraRtcEngine, type IRtcEngine, type IRtcEngineEventHandler } from 'react-native-agora';
import { useAuth } from '@/context/AuthContext';
import { classifyCallFailure, evaluateCallTimeout, requestCallToken, setCallState, subscribeCallSession, transitionCallState, updateHeartbeat, type CallSession } from '@/lib/calls';
import { trackCallMetric } from '@/lib/callTelemetry';

async function grantPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const needed = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, PermissionsAndroid.PERMISSIONS.CAMERA];
  const r = await PermissionsAndroid.requestMultiple(needed);
  return r[needed[0]] === PermissionsAndroid.RESULTS.GRANTED && r[needed[1]] === PermissionsAndroid.RESULTS.GRANTED;
}

export default function CallScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const callId = String(id || '');
  const { user } = useAuth();
  const router = useRouter();
  const [call, setCall] = useState<CallSession | null>(null);
  const [joined, setJoined] = useState(false);
  const [statusText, setStatusText] = useState('Connecting…');
  const engineRef = useRef<IRtcEngine | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutEvalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const joiningLockRef = useRef(false);
  const releaseLockRef = useRef(false);
  const mountedRef = useRef(true);
  const lastHeartbeatWriteRef = useRef(0);
  const tokenRetryRef = useRef(0);
  const callRef = useRef<CallSession | null>(null);
  const joinStartedAtRef = useRef(0);
  const reconnectStartedAtRef = useRef(0);
  const joinedAtRef = useRef(0);
  const permissionLockRef = useRef(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const isCaller = useMemo(() => call?.caller_id === user?.uid, [call?.caller_id, user?.uid]);

  const leave = useCallback(async (finalState: 'ended' | 'declined' | 'missed' = 'ended') => {
    if (releaseLockRef.current) return;
    releaseLockRef.current = true;
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    if (timeoutEvalRef.current) clearInterval(timeoutEvalRef.current);
    heartbeatRef.current = null;
    timeoutEvalRef.current = null;
    try { engineRef.current?.leaveChannel(); } catch {}
    try { engineRef.current?.release(); } catch {}
    engineRef.current = null;
    if (callId) {
      const durationMs = joinedAtRef.current > 0 ? Date.now() - joinedAtRef.current : 0;
      trackCallMetric('avg_call_duration', callId, { duration_ms: durationMs, ended_as: finalState });
      await setCallState(callId, finalState, { termination_reason: finalState === 'ended' ? 'local_end' : finalState }).catch(() => {});
    }
    if (mountedRef.current) router.back();
    releaseLockRef.current = false;
  }, [callId, router]);

  useEffect(() => {
    mountedRef.current = true;
    if (!callId) return;
    return subscribeCallSession(callId, (next) => {
      setCall(next);
      callRef.current = next;
      if (!next) return;
      if (next.finalized_at) setStatusText(`Finalized: ${next.termination_reason || next.status}`);
      else setStatusText(next.status);
      const timeoutDecision = evaluateCallTimeout(next);
      if (timeoutDecision) {
        trackCallMetric('cleanup_cause', next.id, { reason: timeoutDecision.reason, via: 'client_timeout_guard' });
        void transitionCallState(next.id, next.status, timeoutDecision.nextState, {
          timeout_reason: timeoutDecision.reason,
          termination_reason: timeoutDecision.reason === 'ring_timeout' ? 'expired' : timeoutDecision.reason === 'heartbeat_stale' ? 'heartbeat_timeout' : 'network_failure',
        });
      }
      if (next.status === 'ended' || next.status === 'declined' || next.status === 'missed') void leave('ended');
    });
  }, [callId, leave]);

  useEffect(() => () => {
    mountedRef.current = false;
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    if (timeoutEvalRef.current) clearInterval(timeoutEvalRef.current);
    heartbeatRef.current = null;
    timeoutEvalRef.current = null;
    try { engineRef.current?.leaveChannel(); } catch {}
    try { engineRef.current?.release(); } catch {}
    engineRef.current = null;
  }, []);

  useEffect(() => {
    if (!call || !user?.uid || joined || joiningLockRef.current) return;
    (async () => {
      joiningLockRef.current = true;
      joinStartedAtRef.current = Date.now();
      const ok = await grantPermissions();
      if (!ok) {
        if (!permissionLockRef.current) {
          permissionLockRef.current = true;
          trackCallMetric('join_failure', callId, { category: classifyCallFailure('permission_denied') });
          Alert.alert('Permissions required');
        }
        return;
      }
      if (call.expires_at_epoch && Math.floor(Date.now() / 1000) > call.expires_at_epoch) {
        setStatusText('Call expired');
        await transitionCallState(callId, ['ringing', 'initiating', 'connecting'], 'missed', { termination_reason: 'expired' });
        return;
      }
      const token = await requestCallToken(callId).catch(() => null);
      if (!token?.rtcToken || !token.channelName || !token.agoraUid) {
        trackCallMetric('token_renewal_failure', callId, { category: classifyCallFailure('token_failure') });
        return;
      }
      await transitionCallState(callId, ['ringing', 'initiating'], 'connecting').catch(() => false);
      if (engineRef.current) return;
      const engine = createAgoraRtcEngine();
      engineRef.current = engine;
      const h: IRtcEngineEventHandler = {
        onJoinChannelSuccess: async () => {
          reconnectAttemptRef.current = 0;
          setJoined(true);
          setStatusText('Connected');
          await transitionCallState(callId, ['ringing', 'connecting', 'reconnecting'], 'connected').catch(() => false);
        },
        onConnectionStateChanged: async (_c, state) => {
          if (state === 3) {
            if (reconnectStartedAtRef.current === 0) {
              reconnectStartedAtRef.current = Date.now();
              trackCallMetric('reconnect_frequency', callId, { attempt: reconnectAttemptRef.current + 1 });
            }
            reconnectAttemptRef.current += 1;
            setStatusText('Reconnecting…');
            await transitionCallState(callId, ['connected', 'connecting'], 'reconnecting').catch(() => false);
            if (reconnectAttemptRef.current > 8) {
              setStatusText('Connection failed');
              await transitionCallState(callId, 'reconnecting', 'failed', { failed_reason: 'reconnect_attempt_limit', termination_reason: 'reconnect_timeout' });
              void leave('ended');
            }
          }
          if (state === 4) {
            setStatusText('Connected');
            if (reconnectStartedAtRef.current > 0) {
              const durationMs = Date.now() - reconnectStartedAtRef.current;
              reconnectStartedAtRef.current = 0;
              trackCallMetric('reconnect_duration', callId, { duration_ms: durationMs });
              trackCallMetric('rtc_reconnect_recovered', callId, { recovered: true });
            }
          }
          if (state === 5) {
            setStatusText('Connection failed');
            await transitionCallState(callId, ['connecting', 'reconnecting', 'connected'], 'failed', { termination_reason: 'network_failure' }).catch(() => false);
          }
        },
        onRequestToken: async () => {
          if (tokenRetryRef.current >= 3) return;
          tokenRetryRef.current += 1;
          const next = await requestCallToken(callId).catch(() => null);
          if (!next?.rtcToken) return;
          engineRef.current?.renewToken(next.rtcToken);
          tokenRetryRef.current = 0;
        },
      };
      try {
        engine.initialize({ appId: token.appId });
      } catch {
        trackCallMetric('join_failure', callId, { category: classifyCallFailure('engine_init_failure') });
        throw new Error('engine_init_failure');
      }
      engine.registerEventHandler(h);
      engine.enableAudio();
      if (call.mode === 'video') engine.enableVideo();
      engine.joinChannel(token.rtcToken, call.channel_name || token.channelName, token.agoraUid, {
        channelProfile: ChannelProfileType.ChannelProfileCommunication,
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
      });
    })().catch(() => {
      trackCallMetric('join_failure', callId, { category: classifyCallFailure('join_failure') });
      setStatusText('Failed');
    }).finally(() => { joiningLockRef.current = false; });
  }, [call, callId, joined, user?.uid]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (next === 'background') engineRef.current?.muteLocalAudioStream(true);
      if (prev !== 'active' && next === 'active') {
        engineRef.current?.muteLocalAudioStream(!micOn);
        if (callRef.current?.mode === 'video') engineRef.current?.muteLocalVideoStream(!camOn);
      }
    });
    return () => sub.remove();
  }, [micOn]);

  useEffect(() => {
    if (!callId || !joined || heartbeatRef.current || timeoutEvalRef.current) return;
    heartbeatRef.current = setInterval(() => {
      const now = Date.now();
      if (now - lastHeartbeatWriteRef.current < 15000) return;
      lastHeartbeatWriteRef.current = now;
      updateHeartbeat(callId).catch(() => {});
    }, 17000);
    timeoutEvalRef.current = setInterval(() => {
      if (!call) return;
      const timeoutDecision = evaluateCallTimeout(call);
      if (timeoutDecision) {
        trackCallMetric('heartbeat_miss', call.id, { reason: timeoutDecision.reason });
        transitionCallState(call.id, call.status, timeoutDecision.nextState, { timeout_reason: timeoutDecision.reason }).catch(() => false);
      }
    }, 10000);
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (timeoutEvalRef.current) clearInterval(timeoutEvalRef.current);
      heartbeatRef.current = null;
      timeoutEvalRef.current = null;
    };
  }, [call, callId, joined]);

  useEffect(() => {
    if (!joined || !callId) return;
    joinedAtRef.current = Date.now();
    trackCallMetric('call_setup_latency', callId, { latency_ms: joinedAtRef.current - joinStartedAtRef.current });
  }, [joined, callId]);

  if (!call) return <View style={styles.center}><ActivityIndicator /></View>;
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Text style={styles.title}>{isCaller ? 'Calling…' : 'Incoming Call'}</Text>
      <Text style={styles.sub}>{statusText}</Text>
      {call.mode === 'video' ? (
        <RtcSurfaceView style={styles.video} canvas={{ uid: 0, sourceType: VideoSourceType.VideoSourceCameraPrimary, renderMode: RenderModeType.RenderModeHidden }} />
      ) : null}
      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={() => { const n = !micOn; setMicOn(n); engineRef.current?.muteLocalAudioStream(!n); }}><Ionicons name={micOn ? 'mic' : 'mic-off'} size={22} color="#fff" /></TouchableOpacity>
        {call.mode === 'video' ? <TouchableOpacity style={styles.btn} onPress={() => { const n = !camOn; setCamOn(n); engineRef.current?.muteLocalVideoStream(!n); }}><Ionicons name={camOn ? 'videocam' : 'videocam-off'} size={22} color="#fff" /></TouchableOpacity> : null}
        <TouchableOpacity style={[styles.btn, styles.end]} onPress={() => { void leave('ended'); }}><Ionicons name="call" size={22} color="#fff" /></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#081016', alignItems: 'center', justifyContent: 'center', gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 24, fontWeight: '800' },
  sub: { color: 'rgba(255,255,255,0.8)' },
  video: { width: '92%', height: 340, borderRadius: 16, overflow: 'hidden', backgroundColor: '#111827' },
  row: { flexDirection: 'row', gap: 12 },
  btn: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: '#374151' },
  end: { backgroundColor: '#B91C1C', transform: [{ rotate: '135deg' }] },
});
