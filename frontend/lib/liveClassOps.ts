import { addDoc, collection, serverTimestamp, writeBatch, doc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { updateParticipantMediaState, updateParticipantModerationState, type LiveClassParticipant } from '@/lib/liveClasses';

export type RecordingEngineState = 'idle' | 'starting' | 'active' | 'recovering' | 'stopping' | 'failed';

export type ModerationAction = {
  type: 'mute' | 'remove';
  classId: string;
  target: LiveClassParticipant;
  reason?: string;
};

export async function logModerationEvent(input: {
  classId: string;
  type: 'mute' | 'remove';
  targetUser: string;
  reason?: string;
  success: boolean;
}): Promise<void> {
  await addDoc(collection(db, 'live_classes', input.classId, 'moderation_events'), {
    type: input.type,
    target_user: input.targetUser,
    moderated_by: auth.currentUser?.uid || '',
    timestamp: serverTimestamp(),
    reason: input.reason || '',
    success: input.success,
  }).catch(() => {});
}

export async function runModerationBurst(actions: ModerationAction[]): Promise<void> {
  if (!actions.length) return;
  const classId = actions[0].classId;
  const batch = writeBatch(db);
  for (const action of actions) {
    const pRef = doc(db, 'live_classes', classId, 'participants', action.target.user_id);
    if (action.type === 'mute') {
      batch.set(pRef, {
        force_muted: true,
        audio_enabled: false,
        'moderation.mic_allowed': false,
        'moderation.moderated_by': auth.currentUser?.uid || '',
        'moderation.moderation_reason': action.reason || '',
        'moderation.moderated_at': serverTimestamp(),
        updated_at: serverTimestamp(),
      }, { merge: true });
    } else {
      batch.set(pRef, {
        joined: false,
        force_muted: true,
        audio_enabled: false,
        video_enabled: false,
        'moderation.removed': true,
        'moderation.mic_allowed': false,
        'moderation.camera_allowed': false,
        'moderation.moderated_by': auth.currentUser?.uid || '',
        'moderation.moderation_reason': action.reason || '',
        'moderation.moderated_at': serverTimestamp(),
        updated_at: serverTimestamp(),
      }, { merge: true });
    }
  }
  await batch.commit();
  await Promise.all(actions.map((a) => logModerationEvent({
    classId: a.classId,
    type: a.type,
    targetUser: a.target.user_id,
    reason: a.reason,
    success: true,
  })));
}

export async function applySingleModerationAction(action: ModerationAction): Promise<void> {
  if (action.type === 'mute') {
    await updateParticipantModerationState(action.classId, action.target.user_id, { force_muted: true, mic_allowed: false });
    await updateParticipantMediaState(action.classId, action.target.user_id, { audio_enabled: false });
  } else {
    await updateParticipantModerationState(action.classId, action.target.user_id, {
      removed: true, mic_allowed: false, camera_allowed: false, force_muted: true,
    });
    await updateParticipantMediaState(action.classId, action.target.user_id, { audio_enabled: false, video_enabled: false });
  }
}
