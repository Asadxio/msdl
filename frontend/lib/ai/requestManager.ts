import { isFeatureEnabled } from '@/lib/featureFlags';
import { trackAiMetric } from '@/lib/ai/aiMonitor';
import { apiUrl } from '@/lib/api';
import { auth } from '@/lib/firebase';

export async function requestAI<T>(feature: string, payload: Record<string, unknown>, fallback: T): Promise<T> {
  if (!isFeatureEnabled(`ai_${feature}`, true)) return fallback;
  const started = Date.now();
  try {
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch(apiUrl('/ai/infer'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
      body: JSON.stringify({ feature, payload }),
    });
    if (!res.ok) throw new Error(`AI infer failed ${res.status}`);
    const data = await res.json();
    trackAiMetric(feature, true, Date.now() - started, { cache_hit: !!data.cache_hit });
    return (data.result as T) ?? fallback;
  } catch {
    trackAiMetric(feature, false, Date.now() - started);
    return fallback;
  }
}
