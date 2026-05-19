import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, PanResponder, Image, ActivityIndicator, Pressable, BackHandler } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS } from '@/constants/theme';

const DURATION_MS = 5000;

type Story = { id: string; user_name: string; text: string; media_url?: string; media_type?: 'image'|'video'|'' };

export default function StatusPlayer() {
  const { data } = useLocalSearchParams<{ data?: string }>();
  const router = useRouter();
  const stories = useMemo<Story[]>(() => {
    try { return JSON.parse(decodeURIComponent(String(data || '[]'))); } catch { return []; }
  }, [data]);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isNavigatingRef = useRef(false);

  const current = stories[idx];

  const goNext = () => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    setIdx((p) => (p + 1 < stories.length ? p + 1 : p));
    setTimeout(() => { isNavigatingRef.current = false; }, 180);
  };
  const goPrev = () => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    setIdx((p) => (p - 1 >= 0 ? p - 1 : 0));
    setTimeout(() => { isNavigatingRef.current = false; }, 180);
  };

  useEffect(() => {
    if (!current) return;
    setLoading(Boolean(current.media_url));
    setFailed(false);
    progress.setValue(0);
    if (timerRef.current) clearTimeout(timerRef.current);
    const run = () => {
      Animated.timing(progress, { toValue: 1, duration: DURATION_MS, useNativeDriver: false }).start(({ finished }) => {
        if (finished && !paused) {
          if (idx + 1 < stories.length) setIdx(idx + 1);
          else router.back();
        }
      });
      timerRef.current = setTimeout(() => {}, DURATION_MS + 50);
    };
    if (!paused) run();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); progress.stopAnimation(); };
  }, [idx, paused, current, stories.length, router, progress]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      router.back();
      return true;
    });
    return () => sub.remove();
  }, [router]);

  useEffect(() => {
    if (!stories[idx + 1]?.media_url) return;
    Image.prefetch(String(stories[idx + 1].media_url)).catch(() => {});
  }, [idx, stories]);

  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 16,
    onPanResponderRelease: (_, g) => { if (g.dy > 80) router.back(); },
  })).current;

  if (!current) return <View style={styles.center}><Text style={styles.txt}>No stories</Text></View>;

  return (
    <View style={styles.container} {...pan.panHandlers}>
      <View style={styles.progressRow}>{stories.map((s, i) => (
        <View key={s.id} style={styles.track}>
          <Animated.View style={[styles.fill, i < idx ? { width: '100%' } : i === idx ? { width: progress.interpolate({ inputRange: [0,1], outputRange: ['0%','100%'] }) } : { width: '0%' }]} />
        </View>
      ))}</View>
      <View style={styles.header}><Text style={styles.txt}>{current.user_name}</Text><TouchableOpacity onPress={() => router.back()}><Text style={styles.txt}>Close</Text></TouchableOpacity></View>
      <Pressable style={styles.mediaWrap} onPressIn={() => setPaused(true)} onPressOut={() => setPaused(false)}>
        {current.media_url ? (
          current.media_type === 'video'
            ? <View style={styles.video}><Text style={styles.txt}>Video story</Text>{loading ? <ActivityIndicator color="#fff"/>:null}</View>
            : <Image source={{ uri: current.media_url }} style={styles.media} onLoadStart={() => { setLoading(true); setFailed(false); }} onLoadEnd={() => setLoading(false)} onError={() => { setLoading(false); setFailed(true); }} fadeDuration={180} />
        ) : <View style={styles.video}><Text style={styles.txt}>{current.text || 'Story'}</Text></View>}
        {failed ? <TouchableOpacity style={styles.retry} onPress={() => { setFailed(false); setLoading(true); setIdx((p) => p); }}><Text style={styles.txt}>Retry media</Text></TouchableOpacity> : null}
      </Pressable>
      <View style={styles.nav}>
        <TouchableOpacity style={styles.half} onPress={goPrev} />
        <TouchableOpacity style={styles.half} onPress={goNext} />
      </View>
      <View style={styles.reply}><Text style={styles.replyText}>Reply…</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' }, center: { flex:1, alignItems:'center', justifyContent:'center', backgroundColor:'#000' },
  txt: { color: '#fff' }, progressRow: { flexDirection: 'row', gap: 4, padding: 12, paddingTop: 44 },
  track: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 2 },
  fill: { height: 3, backgroundColor: '#fff', borderRadius: 2 }, header: { flexDirection:'row', justifyContent:'space-between', paddingHorizontal: 12, paddingBottom: 8 },
  mediaWrap: { flex: 1, justifyContent: 'center' }, media: { width: '100%', height: '100%' }, video: { flex:1, alignItems:'center', justifyContent:'center' },
  nav: { ...StyleSheet.absoluteFillObject, flexDirection:'row' }, half: { flex:1 },
  retry: { position: 'absolute', bottom: 24, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18 },
  reply: { padding: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)' }, replyText: { color: COLORS.textMuted, backgroundColor: 'rgba(255,255,255,0.1)', padding: 10, borderRadius: 20 },
});
