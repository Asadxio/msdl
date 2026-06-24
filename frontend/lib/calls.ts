import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, type Unsubscribe } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
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
};

export function subscribeCallSession(callId: string, cb: (call: CallSession | null) => void): Unsubscribe {
  return onSnapshot(doc(db, 'calls', callId), (snap) => {
    if (!snap.exists()) return cb(null);
    cb({ id: snap.id, ...snap.data() } as CallSession);
  }, () => cb(null));
}

export function subscribeIncomingCalls(userId: string, cb: (calls: CallSession[]) => void): Unsubscribe {
  const q = query(collection(db, 'calls'), where('callee_id', '==', userId), where('status', 'in', ['initiating', 'ringing', 'connecting']));
  return onSnapshot(q, (snap) => cb(snap.docs.map((s) => ({ id: s.id, ...(s.data() as any) } as CallSession))), () => cb([]));
}

export async function createOutgoingCall(calleeId: string, mode: 'audio' | 'video'): Promise<string> {
  const caller = auth.currentUser;
  if (!caller?.uid) throw new Error('Please sign in again.');
  if (!calleeId || calleeId === caller.uid) throw new Error('Invalid recipient.');
  const callRef = doc(collection(db, 'calls'));
  const channel = `MSDL-CALL-${caller.uid.slice(0, 8)}-${calleeId.slice(0, 8)}-${callRef.id.slice(0, 8)}`;
  await setDoc(callRef, {
    caller_id: caller.uid,
    callee_id: calleeId,
    status: 'ringing',
    mode,
    channel_name: channel,
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

export async function setCallState(callId: string, status: CallState): Promise<void> {
  await updateDoc(doc(db, 'calls', callId), { status, updated_at: serverTimestamp() });
}

export async function transitionCallState(callId: string, expectedState: CallState | CallState[], nextState: CallState): Promise<boolean> {
  await setCallState(callId, nextState);
  return true;
}

export function classifyCallFailure(reason: string) { return 'unknown'; }
export function evaluateCallTimeout(call: CallSession) { return null; }
