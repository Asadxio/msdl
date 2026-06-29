import { Query, onSnapshot, QuerySnapshot, DocumentData } from 'firebase/firestore';

type Unsub = () => void;

type ListenerEntry = {
  count: number;
  unsub: Unsub;
  listeners: Set<(snap: QuerySnapshot<DocumentData>) => void>;
};

const registry = new Map<string, ListenerEntry>();

export function stableQueryKey(parts: (string | number | boolean | undefined | null)[]): string {
  return parts.map((p) => String(p ?? '')).join('|');
}

export function subscribeDeduped(
  key: string,
  queryRef: Query<DocumentData>,
  cb: (snap: QuerySnapshot<DocumentData>) => void,
  onError?: (err: unknown) => void,
): Unsub {
  const existing = registry.get(key);
  if (existing) {
    existing.count += 1;
    existing.listeners.add(cb);
    return () => releaseListener(key, cb);
  }

  const listeners = new Set<(snap: QuerySnapshot<DocumentData>) => void>([cb]);
  const unsub = onSnapshot(queryRef, (snap) => {
    const current = registry.get(key);
    if (!current) return;
    current.listeners.forEach((fn) => fn(snap));
  }, (err) => {
    onError?.(err);
  });

  registry.set(key, { count: 1, unsub, listeners });
  return () => releaseListener(key, cb);
}

function releaseListener(key: string, cb: (snap: QuerySnapshot<DocumentData>) => void) {
  const existing = registry.get(key);
  if (!existing) return;
  existing.listeners.delete(cb);
  existing.count = Math.max(0, existing.count - 1);
  if (existing.count === 0) {
    existing.unsub();
    registry.delete(key);
  }
}

export function getListenerMetrics() {
  return { active_keys: registry.size, active_subscriptions: Array.from(registry.values()).reduce((a, b) => a + b.count, 0) };
}
