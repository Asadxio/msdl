import { ScreenRefreshControl } from '@/components/ui';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Switch, ScrollView, FlatList, Image } from 'react-native';
import { dispatchNotification } from '@/lib/notificationCenter';
import { collection, getDocs, query, where, orderBy, limit as limitQ } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function AdminSendPush() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sendToAll, setSendToAll] = useState(true);
  const [userIdsText, setUserIdsText] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; email?: string; photoURL?: string }>>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedUsers = searchResults.filter((item) => selectedIds.includes(item.id));

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const q = String(search || '').trim();
        if (!q || q.length < 2) {
          if (mounted) setSearchResults([]);
          return;
        }
        const prefix = q;
        const end = `${prefix}\uf8ff`;
        const col = collection(db, 'users');
        const nameQuery = query(col, where('displayName', '>=', prefix), where('displayName', '<=', end), orderBy('displayName'), limitQ(20));
        let snaps = await getDocs(nameQuery);
        let rows: any[] = [];
        if (!snaps.empty) {
          snaps.forEach((d) => {
            const data = d.data() as any;
            rows.push({ id: d.id, name: data.displayName || data.name || d.id, email: data.email, photoURL: data.photoURL || data.avatarURL });
          });
        } else {
          const emailQuery = query(col, where('email', '>=', prefix), where('email', '<=', end), orderBy('email'), limitQ(20));
          snaps = await getDocs(emailQuery);
          snaps.forEach((d) => {
            const data = d.data() as any;
            rows.push({ id: d.id, name: data.displayName || data.name || d.id, email: data.email, photoURL: data.photoURL || data.avatarURL });
          });
        }
        if (mounted) setSearchResults(rows as any[]);
      } catch (err) {
        console.warn('user search failed', err);
        if (mounted) setSearchResults([]);
      }
    };
    void run();
    return () => { mounted = false; };
  }, [search]);

  const send = async () => {
    setResult(null);
    setSending(true);
    try {
      const user_ids = sendToAll ? [] : (selectedIds.length ? selectedIds : userIdsText.split(/[,\n\s]+/).filter(Boolean));
      const dedupe = `admin:${Date.now()}`;
      await dispatchNotification({
        channel: 'admin',
        type: 'announcement',
        title: title || 'Announcement',
        message: body || '',
        user_ids: user_ids,
        send_to_all: sendToAll,
        dedupe_id: dedupe,
      });
      setResult('Sent');
    } catch (err: any) {
      console.warn('admin send push failed', err);
      setResult(String(err?.message || err || 'Failed'));
    } finally {
      setSending(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.h}>Admin: Send Push</Text>
      <Text style={styles.label}>Title</Text>
      <TextInput value={title} onChangeText={setTitle} style={styles.input} placeholder="Title" />
      <Text style={styles.label}>Body</Text>
      <TextInput value={body} onChangeText={setBody} style={[styles.input, { height: 100 }]} placeholder="Message body" multiline />

      <View style={styles.rowSpace}>
        <Text style={styles.label}>Send to all users</Text>
        <Switch value={sendToAll} onValueChange={setSendToAll} />
      </View>

      {!sendToAll && (
        <>
          <Text style={styles.label}>Search users by name or email (min 2 chars)</Text>
          <TextInput value={search} onChangeText={setSearch} style={styles.input} placeholder="Search name or email" />
          <FlatList
            data={searchResults}
            keyExtractor={(i) => i.id}
            style={{ maxHeight: 220, marginTop: 8 }}
            renderItem={({ item }) => {
              const selected = selectedIds.includes(item.id);
            
  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    await new Promise(r => setTimeout(r, 500));
  });
  return (
                <TouchableOpacity
                  onPress={() => {
                    setSelectedIds((prev) => selected ? prev.filter((p) => p !== item.id) : [...prev, item.id]);
                  }}
                  style={styles.searchRow}
                >
                  <View style={styles.searchAvatarWrapper}>
                    {item.photoURL ? (
                      <Image source={{ uri: item.photoURL }} style={styles.searchAvatar} />
                    ) : (
                      <View style={styles.searchAvatarPlaceholder}>
                        <Text style={styles.searchAvatarInitial}>{item.name.charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.searchInfo}>
                    <Text style={styles.searchName}>{item.name}</Text>
                    {!!item.email && <Text style={styles.searchEmail}>{item.email}</Text>}
                  </View>
                  <View style={styles.searchAction}>
                    <Text style={selected ? styles.searchSelectedText : styles.searchSelectText}>{selected ? 'Selected' : 'Select'}</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />

          <Text style={{ marginTop: 8, color: '#333' }}>Selected: {selectedIds.length}</Text>
          <View style={styles.selectedChips}> 
            {selectedUsers.map((item) => (
              <View key={item.id} style={styles.chip}>
                <Text style={styles.chipText}>{item.name}</Text>
              </View>
            ))}
            {selectedIds.filter((id) => !selectedUsers.some((item) => item.id === id)).map((id) => (
              <View key={id} style={styles.chip}>
                <Text style={styles.chipText}>{id}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.label}>(Or paste user IDs)</Text>
          <TextInput value={userIdsText} onChangeText={setUserIdsText} style={[styles.input, { height: 80 }]} multiline placeholder="uid1, uid2" />
        </>
      )}

      <TouchableOpacity onPress={send} style={styles.btn} disabled={sending}>
        <Text style={styles.btnText}>{sending ? 'Sending…' : 'Send Push'}</Text>
      </TouchableOpacity>

      {result && <Text style={styles.result}>Result: {result}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#fff', flexGrow: 1 },
  h: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  label: { marginTop: 12, marginBottom: 6, color: '#333' },
  input: { borderWidth: 1, borderColor: '#eee', padding: 10, borderRadius: 8, backgroundColor: '#fafafa' },
  btn: { backgroundColor: '#0FA958', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 16 },
  btnText: { color: '#fff', fontWeight: '600' },
  rowSpace: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  searchRow: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  searchAvatarWrapper: { marginRight: 12 },
  searchAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#ddd' },
  searchAvatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center' },
  searchAvatarInitial: { color: '#555', fontWeight: '700' },
  searchInfo: { flex: 1, marginRight: 12 },
  searchName: { fontWeight: '600' },
  searchEmail: { color: '#666', fontSize: 13, marginTop: 2 },
  searchAction: { minWidth: 70, alignItems: 'flex-end' },
  searchSelectText: { color: '#666' },
  searchSelectedText: { color: '#0FA958', fontWeight: '600' },
  selectedChips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  chip: { backgroundColor: '#eef8f2', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, marginTop: 8 },
  chipText: { fontSize: 12, color: '#0A6D42' },
  result: { marginTop: 12, color: '#444' },
});
