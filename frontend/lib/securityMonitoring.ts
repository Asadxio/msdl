import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type SecuritySeverity = 'low' | 'medium' | 'high' | 'critical';

export function classifySecuritySeverity(event: string, countWindow = 1): SecuritySeverity {
  if (event.includes('mass_delete') || event.includes('role_escalation')) return 'critical';
  if (event.includes('failed_admin') || event.includes('abnormal_moderation')) return countWindow > 5 ? 'high' : 'medium';
  return 'low';
}

export async function fetchSecurityEvents(filters: { q?: string; severity?: SecuritySeverity | 'all'; sinceMs?: number; pageSize?: number }) {
  const size = Math.min(100, Math.max(10, Number(filters.pageSize || 50)));
  const constraints: any[] = [orderBy('created_at', 'desc'), limit(size)];
  if (filters.severity && filters.severity !== 'all') constraints.unshift(where('severity', '==', filters.severity));
  if (filters.sinceMs) constraints.unshift(where('created_at_ms', '>=', filters.sinceMs));
  const snap = await getDocs(query(collection(db, 'security_events_immutable'), ...constraints));
  const all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  const q = String(filters.q || '').toLowerCase();
  return all.filter((e) => !q || String(e.event || '').toLowerCase().includes(q) || JSON.stringify(e.payload || {}).toLowerCase().includes(q));
}

export function buildIncidentTimeline(events: any[]) {
  return [...events].sort((a, b) => Number(a.created_at_ms || 0) - Number(b.created_at_ms || 0));
}

export function detectAnomalies(events: any[]) {
  const byActor: Record<string, number> = {};
  const anomalies: { type: string; score: number; actor?: string }[] = [];
  for (const e of events) {
    const actor = String(e.payload?.uid || e.payload?.actor || 'unknown');
    byActor[actor] = (byActor[actor] || 0) + 1;
  }
  Object.entries(byActor).forEach(([actor, c]) => {
    if (c >= 20) anomalies.push({ type: 'abnormal_admin_activity', score: c, actor });
  });
  const failures = events.filter((e) => String(e.event).includes('denied') || String(e.event).includes('failed_admin')).length;
  if (failures >= 10) anomalies.push({ type: 'failed_admin_burst', score: failures });
  return anomalies;
}

export function toCsvIncidentReport(events: any[]) {
  const header = 'id,event,severity,created_at_ms,payload';
  const rows = events.map((e) => [e.id, e.event, e.severity || '', e.created_at_ms || '', JSON.stringify(e.payload || {}).replace(/"/g, '""')].map((v) => `"${String(v)}"`).join(','));
  return [header, ...rows].join('\n');
}
