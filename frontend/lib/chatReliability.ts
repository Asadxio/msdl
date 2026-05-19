import AsyncStorage from '@react-native-async-storage/async-storage';

export type QueueStatus = 'pending' | 'uploading' | 'retrying' | 'failed' | 'completed';
export type QueueMessageType = 'text' | 'image' | 'video' | 'audio';

export type QueueItem = {
  id: string;
  chat_id: string;
  created_at_ms: number;
  status: QueueStatus;
  retry_count: number;
  next_retry_at_ms: number;
  locked_until_ms?: number;
  message_type: QueueMessageType;
  text: string;
  sender_id: string;
  sender_name: string;
  read_by: string[];
  media_local_uri?: string;
  media_url?: string;
  media_name?: string;
  media_size?: number;
  content_type?: string;
  ext?: string;
  push_dedupe_id: string;
  failed_reason?: string;
};

const PREFIX = 'chat_outbox_v3';
const LOCK_MS = 30000;

function key(chatId: string) { return `${PREFIX}:${chatId}`; }

export async function getQueue(chatId: string): Promise<QueueItem[]> {
  const raw = await AsyncStorage.getItem(key(chatId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v) => v && typeof v.id === 'string').sort((a, b) => (a.created_at_ms || 0) - (b.created_at_ms || 0));
  } catch {
    return [];
  }
}

export async function setQueue(chatId: string, items: QueueItem[]) {
  await AsyncStorage.setItem(key(chatId), JSON.stringify(items));
}

export async function enqueue(chatId: string, item: QueueItem) {
  const q = await getQueue(chatId);
  if (q.some((x) => x.id === item.id)) return;
  q.push(item);
  await setQueue(chatId, q);
}

export async function patchItem(chatId: string, id: string, patch: Partial<QueueItem>) {
  const q = await getQueue(chatId);
  const next = q.map((x) => (x.id === id ? { ...x, ...patch } : x));
  await setQueue(chatId, next);
}

export async function completeItem(chatId: string, id: string) {
  const q = await getQueue(chatId);
  const next = q.map((x) => (x.id === id ? { ...x, status: 'completed', locked_until_ms: 0 } : x));
  await setQueue(chatId, next);
}

export async function lockReadyItems(chatId: string, now: number): Promise<QueueItem[]> {
  const q = await getQueue(chatId);
  const ready = q.filter((x) => x.status !== 'completed' && x.status !== 'failed' && (x.next_retry_at_ms || 0) <= now && (!x.locked_until_ms || x.locked_until_ms <= now));
  if (ready.length === 0) return [];
  const ids = new Set(ready.map((x) => x.id));
  const next = q.map((x) => (ids.has(x.id) ? { ...x, locked_until_ms: now + LOCK_MS } : x));
  await setQueue(chatId, next);
  return ready;
}

export function nextBackoffMs(retryCount: number) {
  return Math.min(60000, 1000 * Math.pow(2, Math.max(1, retryCount)));
}
