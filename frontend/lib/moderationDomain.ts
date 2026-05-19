export const MODERATION_STATES = ['pending', 'under_review', 'actioned', 'dismissed', 'appealed', 'resolved'] as const;
export type ModerationState = (typeof MODERATION_STATES)[number];
export const MODERATION_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type ModerationSeverity = (typeof MODERATION_SEVERITIES)[number];
export const MODERATION_ACTIONS = ['warn_user', 'mute_user', 'temporary_suspension', 'permanent_suspension', 'remove_content', 'shadow_restriction', 'escalate_to_admin', 'dismiss_report'] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

export type EvidenceSnapshot = {
  content_type: 'status' | 'message' | 'profile' | 'live_class' | 'unknown';
  content_id: string;
  content_text?: string;
  media_refs?: string[];
  created_at_ms: number;
  reporter_id: string;
  accused_user_id: string;
  metadata?: Record<string, unknown>;
};

export type ModerationReport = {
  id: string;
  state: ModerationState;
  severity: ModerationSeverity;
  reason: string;
  reporter_id: string;
  accused_user_id: string;
  created_at_ms: number;
  evidence_ref?: string;
};

export function normalizeModerationState(state: unknown): ModerationState {
  const s = String(state || '').trim().toLowerCase();
  return (MODERATION_STATES as readonly string[]).includes(s) ? (s as ModerationState) : 'pending';
}
