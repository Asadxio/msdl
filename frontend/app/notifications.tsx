import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { collection, onSnapshot, orderBy, query, where, limit } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { v4 as uuidv4 } from 'uuid';
import { dispatchNotification, getCurrentUserId } from '@/lib/notificationCenter';
import { formatDistanceToNow } from 'date-fns';

type NotificationItem = {
  id: string;
  title?: string;
  message?: string;
  created_at_ms?: number;
  data?: Record<string, unknown>;
};

export default function NotificationsScreen() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [sending, setSending] = useState(false);

  const uid = auth.currentUser?.uid;

  const load = useCallback(() => {
    if (!uid) return () => {};
    const q = query(
      collection(db, 'notifications'),
      where('user_id', '==', uid),
      orderBy('created_at_ms', 'desc'),
      limit(50),
    );
    const unsub = onSnapshot(q, (snap) => {
      const rows: NotificationItem[] = [];
      snap.forEach((doc) => {
        const d = doc.data() as any;
        rows.push({ id: doc.id, title: d.title || '', message: d.message || '', created_at_ms: Number(d.created_at_ms || 0), data: d.data || {} });
      });
      setItems(rows);
    }, (err) => {
      console.warn('[Notifications] snapshot error', err);
    });
    return unsub;
  }, [uid]);

  useEffect(() => {
    const unsub = load();
    return () => { if (typeof unsub === 'function') unsub(); };
  }, [load]);

  const renderItem = ({ item }: { item: NotificationItem }) => (
    <TouchableOpacity style={styles.row} onPress={() => { /* future: navigate or mark read */ }}>
      <View style={styles.body}>
        <Text style={styles.title}>{item.title || 'Notification'}</Text>
        <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
      </View>
      <Text style={styles.time}>{item.created_at_ms ? formatDistanceToNow(new Date(item.created_at_ms)) : ''}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={{ padding: 12 }}>
        <TouchableOpacity
          onPress={async () => {
            try {
              if (!auth.currentUser) return;
              setSending(true);
              const uid = getCurrentUserId();
              const dedupe = uuidv4();
              await dispatchNotification({
                channel: 'admin',
                type: 'announcement',
                title: 'Test push',
                message: 'This is a test push notification',
                user_ids: [uid],
                data: { test: true },
                dedupe_id: dedupe,
              });
            } catch (err) {
              console.warn('[Notifications] test push failed', err);
            } finally {
              setSending(false);
            }
          }}
          style={{ backgroundColor: '#0FA958', padding: 12, borderRadius: 8, alignItems: 'center' }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>{sending ? 'Sending…' : 'Send test push'}</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>No notifications</Text></View>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  row: { flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'center' },
  body: { flex: 1, paddingRight: 8 },
  title: { fontWeight: '600', fontSize: 15, marginBottom: 4 },
  message: { color: '#444', fontSize: 13 },
  time: { fontSize: 11, color: '#888' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { color: '#666' },
});
