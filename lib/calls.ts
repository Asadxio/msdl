import { collection, doc, onSnapshot, query, runTransaction, serverTimestamp, setDoc, updateDoc, where, type Unsubscribe } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { AGORA_APP_ID, getAgoraUid } from '@/lib/liveClasses';
import { dispatchNotification } from '@/lib/dispatchNotification';

export type CallState = 'initiating' | 'ringing' | 'connecting' | 'connected' | 'reconnecting' | 'failed' | 'ended' | 'declined' | 'missed';

export type CallSession = {
  id: string;
  caller_id: string;
  callee_id: string;
  status: CallState;
  mode: 'audio' | 'video';
  channel_name: string;
  created_at?: { toDate?: () => Date } | null;
  updated_at?: { toDate?: () => Date } | null;
  expires_at_epoch?: number;
  last_heartbeat_at?: number;
  caller_last_seen?: number;
  callee_last_seen?: number;
  finalized_at?: { toDate?: () => Date } | null;
  termination_reason?: 'missed' | 'expired' | 'reconnect_timeout' | 'heartbeat_timeout' | 'remote_end' | 'local_end' | 'network_failure' | '';
  cleanup_reason?: string;
};
export type CallFailureCategory =
  | 'token_failure'
  | 'rtc_disconnect'
  | 'reconnect_timeout'
  | 'heartbeat_timeout'
  | 'remote_end'
  | 'local_end'
  | 'permission_denied'
  | 'engine_init_failure'
  | 'join_failure'
  | 'unknown';

const CALL_TRANSITIONS: Record<CallState, CallState[]> = {
  initiating: ['ringing', 'failed', 'ended'],
  ringing: ['connecting', 'declined', 'missed', 'ended', 'failed'],
  connecting: ['connected', 'failed', 'ended', 'reconnecting'],
  connected: ['reconnecting', 'ended', 'failed'],
  reconnecting: ['connected', 'failed', 'ended'],
  failed: [],
  ended: [],
  declined: [],
  missed: [],
};

export function validateCallTransition(fromState: CallState, toState: CallState): boolean {
  return CALL_TRANSITIONS[fromState]?.includes(toState) === true;
}

export function subscribeCallSession(callId: string, cb: (call: CallSession | null) => void): Unsubscribe {
  return onSnapshot(doc(db, 'calls', callId), (snap) => {
    if (!snap.exists()) return cb(null);
    const d = snap.data() as any;
    cb({
      id: snap.id,
      caller_id: String(d.caller_id || ''),
      callee_id: String(d.callee_id || ''),
      status: d.status || 'failed',
      mode: d.mode === 'audio' ? 'audio' : 'video',
      channel_name: String(d.channel_name || ''),
      created_at: d.created_at || null,
      updated_at: d.updated_at || null,
      expires_at_epoch: Number(d.expires_at_epoch || 0),
      last_heartbeat_at: Number(d.last_heartbeat_at || 0) || undefined,
      caller_last_seen: Number(d.caller_last_seen || 0) || undefined,
      callee_last_seen: Number(d.callee_last_seen || 0) || undefined,
      finalized_at: d.finalized_at || null,
      termination_reason: String(d.termination_reason || '') as CallSession['termination_reason'],
      cleanup_reason: String(d.cleanup_reason || ''),
    });
  }, () => cb(null));
}

export function subscribeIncomingCalls(userId: string, cb: (calls: CallSession[]) => void): Unsubscribe {
  const q = query(collection(db, 'calls'), where('callee_id', '==', userId), where('status', 'in', ['initiating', 'ringing', 'connecting', 'reconnecting']));
  return onSnapshot(q, (snap) => cb(snap.docs.map((s) => ({ id: s.id, ...(s.data() as any) } as CallSession))), () => cb([]));
}

export async function createOutgoingCall(calleeId: string, mode: 'audio' | 'video'): Promise<string> {
  const caller = auth.currentUser;
  if (!caller?.uid) throw new Error('Please sign in again.');
  if (!calleeId || calleeId === caller.uid) throw new Error('Invalid recipient.');
  const callRef = doc(collection(db, 'calls'));
  const channel = `call_${caller.uid.slice(0, 8)}_${calleeId.slice(0, 8)}_${callRef.id.slice(0, 12)}`;
  await setDoc(callRef, {
    caller_id: caller.uid,
    callee_id: calleeId,
    status: 'ringing',
    mode,
    channel_name: channel,
    agora_app_id: AGORA_APP_ID,
    caller_agora_uid: getAgoraUid(caller.uid),
    callee_agora_uid: getAgoraUid(calleeId),
    expires_at_epoch: Math.floor(Date.now() / 1000) + 120,
    last_heartbeat_at: Date.now(),
    caller_last_seen: Date.now(),
    callee_last_seen: 0,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  await dispatchNotification({
    channel: 'calls',
    event: 'call_incoming',
    title: 'Incoming call',
    body: mode === 'video' ? 'Video call incoming' : 'Voice call incoming',
    recipientIds: [calleeId],
    data: { call_id: callRef.id },
    dedupeId: `call_incoming:${callRef.id}`,
  }).catch(() => {});
  return callRef.id;
}

export async function setCallState(callId: string, status: CallState, extra: Record<string, unknown> = {}): Promise<void> {
  const terminal = status === 'ended' || status === 'declined' || status === 'missed' || status === 'failed';
  await updateDoc(doc(db, 'calls', callId), { status, ...extra, ...(terminal ? { finalized_at: serverTimestamp() } : {}), updated_at: serverTimestamp() });
}

export async function transitionCallState(
  callId: string,
  expectedState: CallState | CallState[],
  nextState: CallState,
  extra: Record<string, unknown> = {},
): Promise<boolean> {
  const expected = Array.isArray(expectedState) ? expectedState : [expectedState];
  return runTransaction(db, async (tx) => {
    const ref = doc(db, 'calls', callId);
    const snap = await tx.get(ref);
    if (!snap.exists()) return false;
    const current = String((snap.data() as any).status || 'failed') as CallState;
    const finalizedAt = (snap.data() as any).finalized_at;
    if (finalizedAt) return false;
    if (!expected.includes(current)) return false;
    if (!validateCallTransition(current, nextState)) return false;
    const terminal = nextState === 'ended' || nextState === 'declined' || nextState === 'missed' || nextState === 'failed';
    tx.update(ref, { status: nextState, ...extra, ...(terminal ? { finalized_at: serverTimestamp() } : {}), updated_at: serverTimestamp() });
    return true;
  }).catch(() => false);
}

export async function requestCallToken(callId: string): Promise<{ appId: string; rtcToken: string; expiresAtEpoch: number; agoraUid: number; channelName: string }> {
  if (!auth.currentUser) throw new Error('Please sign in again.');
  const idToken = await auth.currentUser.getIdToken();
  const base = String(
    process.env.EXPO_PUBLIC_LIVE_API_URL
    || process.env.EXPO_PUBLIC_PUSH_API_URL
    || String(process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/api\/?$/, ''),
  ).replace(/\/$/, '');
  if (!base) throw new Error('Live API unavailable');
  const runFetch = () => fetch(`${base}/api/call/token`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ call_id: callId }),
  });
  let res: Response | null = await runFetch().catch(() => null);
  if (!res) {
    await new Promise((r) => setTimeout(r, 500));
    res = await runFetch().catch(() => null);
  }
  if (!res) throw new Error('Token request failed');
  const payload = await res.json().catch(() => ({} as any));
  if (!res.ok) throw new Error(String(payload.detail || `Token failed (${res.status})`));
  return {
    appId: String(payload.app_id || ''),
    rtcToken: String(payload.rtc_token || ''),
    expiresAtEpoch: Number(payload.expires_at_epoch || 0),
    agoraUid: Number(payload.agora_uid || 0),
    channelName: String(payload.channel_name || ''),
  };
}

export async function updateHeartbeat(callId: string, participantRole: 'caller' | 'callee'): Promise<void> {
  const uid = auth.currentUser?.uid || '';
  if (!uid) return;
  const now = Date.now();
  await updateDoc(doc(db, 'calls', callId), {
    last_heartbeat_at: now,
    ...(participantRole === 'caller' ? { caller_last_seen: now } : { callee_last_seen: now }),
    updated_at: serverTimestamp(),
  }).catch(() => {});
  await setDoc(doc(db, 'calls', callId, 'participants', uid), {
    joined: true,
    reconnecting: false,
    muted: false,
    last_seen: now,
    device_platform: 'mobile',
    updated_at: serverTimestamp(),
  }, { merge: true }).catch(() => {});
}

export function evaluateCallTimeout(call: CallSession): { nextState: CallState; reason: string } | null {
  const nowSec = Math.floor(Date.now() / 1000);
  const nowMs = Date.now();
  if ((call.status === 'ringing' || call.status === 'initiating') && call.expires_at_epoch && nowSec > call.expires_at_epoch) {
    return { nextState: 'missed', reason: 'ring_timeout' };
  }
  if (call.status === 'connecting' && call.updated_at?.toDate && nowMs - call.updated_at.toDate().getTime() > 45000) {
    return { nextState: 'failed', reason: 'connect_timeout' };
  }
  if (call.status === 'reconnecting' && call.updated_at?.toDate && nowMs - call.updated_at.toDate().getTime() > 60000) {
    return { nextState: 'failed', reason: 'reconnect_timeout' };
  }
  if (call.status === 'connected' && call.last_heartbeat_at && nowMs - call.last_heartbeat_at > 65000) {
    return { nextState: 'ended', reason: 'heartbeat_stale' };
  }
  return null;
}

export function classifyCallFailure(reason: string): CallFailureCategory {
  const normalized = String(reason || '').toLowerCase();
  if (!normalized) return 'unknown';
  if (normalized.includes('token')) return 'token_failure';
  if (normalized.includes('permission')) return 'permission_denied';
  if (normalized.includes('heartbeat')) return 'heartbeat_timeout';
  if (normalized.includes('reconnect')) return 'reconnect_timeout';
  if (normalized.includes('remote_end')) return 'remote_end';
  if (normalized.includes('local_end')) return 'local_end';
  if (normalized.includes('engine')) return 'engine_init_failure';
  if (normalized.includes('join')) return 'join_failure';
  if (normalized.includes('disconnect') || normalized.includes('network')) return 'rtc_disconnect';
  return 'unknown';
}
