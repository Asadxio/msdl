import AsyncStorage from '@react-native-async-storage/async-storage';

type CacheRecord<T> = { value: T; expiry: number; stored_at: number };

const mem = new Map<string, CacheRecord<unknown>>();
const MAX_MEM_KEYS = 200;

function trim() {
  if (mem.size <= MAX_MEM_KEYS) return;
  const keys = Array.from(mem.keys());
  for (let i = 0; i < keys.length - MAX_MEM_KEYS; i += 1) mem.delete(keys[i]);
}

export async function cacheSet<T>(key: string, value: T, ttlMs: number): Promise<void> {
  const entry: CacheRecord<T> = { value, expiry: Date.now() + Math.max(1000, ttlMs), stored_at: Date.now() };
  mem.set(key, entry);
  trim();
  await AsyncStorage.setItem(`cache_${key}`, JSON.stringify(entry)).catch(() => {});
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const memVal = mem.get(key) as CacheRecord<T> | undefined;
  if (memVal && memVal.expiry > Date.now()) return memVal.value;
  const raw = await AsyncStorage.getItem(`cache_${key}`).catch(() => null);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CacheRecord<T>;
    if (parsed.expiry <= Date.now()) return null;
    mem.set(key, parsed as CacheRecord<unknown>);
    return parsed.value;
  } catch {
    return null;
  }
}
