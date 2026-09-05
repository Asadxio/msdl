import { isFeatureEnabled } from '@/lib/featureFlags';
import { trackAiMetric } from '@/lib/ai/aiMonitor';
import { apiUrl } from '@/lib/api';
import { auth } from '@/lib/firebase';

export async function requestAI<T>(feature: string, payload: Record<string, unknown>, fallback: T): Promise<T> {
  // Remote /ai/infer removed — Shariah & Fatawa queries must be answered by certified human scholars
  trackAiMetric(feature, true, 0, { offline_fallback: true });
  return fallback;
}
