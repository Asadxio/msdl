import { ENV } from '@/config/environments';

export function isFeatureEnabled(name: string, fallback = false): boolean {
  const key = `EXPO_PUBLIC_FLAG_${name.toUpperCase()}`;
  const raw = (process.env as any)[key];
  if (raw == null || raw === '') return fallback;
  return String(raw).toLowerCase() === 'true' || String(raw) === '1';
}

export function rolloutEnabled(name: string, seed: string, fallbackPercent = ENV === 'production' ? 0 : 100): boolean {
  const key = `EXPO_PUBLIC_ROLLOUT_${name.toUpperCase()}`;
  const raw = (process.env as any)[key];
  const pct = Math.max(0, Math.min(100, Number(raw ?? fallbackPercent) || 0));
  let hash = 0;
  const source = `${name}:${seed}`;
  for (let i = 0; i < source.length; i += 1) hash = (hash * 31 + source.charCodeAt(i)) % 1000;
  return (hash % 100) < pct;
}
