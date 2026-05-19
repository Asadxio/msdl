type MetricPayload = Record<string, string | number | boolean | null | undefined>;

const counters: Record<string, number> = {};
const samples: Array<{ name: string; at: number; payload: MetricPayload }> = [];

export function recordLiveMetric(name: string, payload: MetricPayload = {}): void {
  counters[name] = (counters[name] || 0) + 1;
  samples.push({ name, at: Date.now(), payload });
  if (samples.length > 400) samples.shift();
  if (__DEV__) {
    console.log('[LiveMetric]', name, { count: counters[name], ...payload });
  }
}

export function getLiveMetricCount(name: string): number {
  return counters[name] || 0;
}

export function getLiveMetricSnapshot(): Record<string, number> {
  return { ...counters };
}

export function getLiveMetricSamples(limit = 50): Array<{ name: string; at: number; payload: MetricPayload }> {
  return samples.slice(Math.max(0, samples.length - Math.max(1, limit)));
}
