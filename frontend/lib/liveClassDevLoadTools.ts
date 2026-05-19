import type { ModerationAction } from '@/lib/liveClassOps';
import type { LiveClassParticipant } from '@/lib/liveClasses';

export function buildSyntheticReconnectStorm(count: number): number[] {
  return Array.from({ length: Math.max(0, count) }, (_, i) => i + 10000);
}

export function buildSyntheticModerationBurst(classId: string, participants: LiveClassParticipant[], limit = 20): ModerationAction[] {
  return participants
    .filter((p) => p.joined && p.role === 'student')
    .slice(0, limit)
    .map((p, idx) => ({ type: idx % 2 === 0 ? 'mute' : 'remove', classId, target: p, reason: 'dev_load_test' }));
}
