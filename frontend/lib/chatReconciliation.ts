import { logChatMetric } from '@/lib/chatTelemetry';

export type Msg = {
  id: string;
  client_id?: string;
  localOnly?: boolean;
  status?: string;
  created_at?: { toDate?: () => Date } | null;
};

function ms(m: Msg): number {
  if (!m) return 0;
  try {
    const d = m.created_at?.toDate ? m.created_at.toDate() : null;
    if (d && !isNaN(d.getTime())) return d.getTime();
  } catch {
    // ignore
  }
  if (typeof (m as any).created_at_ms === 'number' && (m as any).created_at_ms > 0) {
    return (m as any).created_at_ms;
  }
  if (typeof (m as any).sent_at_ms === 'number' && (m as any).sent_at_ms > 0) {
    return (m as any).sent_at_ms;
  }
  if (m.localOnly || m.status === 'pending' || m.status === 'sending' || !m.created_at) {
    return Date.now();
  }
  return 0;
}

export function mergeServerAndLocal(server: Msg[], local: Msg[]): Msg[] {
  const byId = new Map<string, Msg>();
  const byClient = new Map<string, Msg>();
  for (const s of server) {
    byId.set(s.id, s);
    if (s.client_id) byClient.set(s.client_id, s);
  }
  const out: Msg[] = [...server];
  for (const l of local) {
    if (byId.has(l.id)) continue;
    if (l.client_id && byClient.has(l.client_id)) {
      logChatMetric({ name: 'reconcile_conflict', ts: Date.now(), meta: { reason: 'client_id_replaced' } });
      continue;
    }
    if (l.localOnly && ms(l) + 10 * 60 * 1000 < Date.now()) continue; // stale local cleanup
    out.push(l);
  }
  out.sort((a, b) => ms(b) - ms(a));
  return out;
}

export function dedupeMessages(list: Msg[]): Msg[] {
  const seenId = new Set<string>();
  const seenClient = new Set<string>();
  const out: Msg[] = [];
  for (const m of list) {
    if (seenId.has(m.id)) {
      logChatMetric({ name: 'duplicate_suppressed', ts: Date.now(), meta: { reason: 'id' } });
      continue;
    }
    if (m.client_id && seenClient.has(m.client_id)) {
      logChatMetric({ name: 'duplicate_suppressed', ts: Date.now(), meta: { reason: 'client_id' } });
      continue;
    }
    seenId.add(m.id);
    if (m.client_id) seenClient.add(m.client_id);
    out.push(m);
  }
  return out;
}
