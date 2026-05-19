import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableWithoutFeedback, Animated, PanResponder, ActivityIndicator, Image, AppState } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Video, ResizeMode } from 'expo-av';
import { COLORS } from '@/constants/theme';
import { clearAsyncOp, clearMediaRef, clearTimerTrack, getLifecycleMetrics, trackAsyncOp, trackMediaRef, trackTimer } from '@/lib/lifecycleDiagnostics';
import { trackPerformanceMetric } from '@/lib/performanceEngine';

const DURATION_MS = 5000;

export default function StatusPlayer() {
  const router = useRouter();
  const { itemsJson, start } = useLocalSearchParams<{ itemsJson: string; start: string }>();
  const items = useMemo(() => { try { return JSON.parse(itemsJson || '[]'); } catch { return []; } }, [itemsJson]);
  const [index, setIndex] = useState(Math.max(0, Number(start || 0) || 0));
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const progress = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const prefetchSeqRef = useRef(0);

  const current = items[index];
  useEffect(() => {
    setLoading(true);
    progress.setValue(0);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      clearTimerTrack('status_player_advance');
    }
    if (!current) return;
    if (!paused) {
      Animated.timing(progress, { toValue: 1, duration: DURATION_MS, useNativeDriver: false }).start(({ finished }) => {
        if (finished) setIndex((i: number) => (i + 1 < items.length ? i + 1 : i));
      });
      timerRef.current = setTimeout(() => {
        setIndex((i: number) => (i + 1 < items.length ? i + 1 : i));
      }, DURATION_MS);
      trackTimer('status_player_advance');
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        clearTimerTrack('status_player_advance');
      }
    };
  }, [index, paused, current, items.length, progress]);

  const pan = useRef(PanResponder.create({ onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 15, onPanResponderRelease: (_, g) => { if (g.dy > 80) router.back(); } })).current;

  useEffect(() => {
    const next = items[index + 1];
    if (next?.media_type === 'image' && next?.media_url) {
      const opId = `status_player_prefetch_${++prefetchSeqRef.current}`;
      trackAsyncOp(opId);
      trackMediaRef(next.media_url);
      Image.prefetch(next.media_url).catch(() => {}).finally(() => {
        clearAsyncOp(opId);
        clearMediaRef(next.media_url);
      });
    }
  }, [index, items]);

  useEffect(() => {
    mountedRef.current = true;
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') setPaused(true);
    });
    return () => {
      mountedRef.current = false;
      sub.remove();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        clearTimerTrack('status_player_advance');
      }
    };
  }, []);

  useEffect(() => {
    if (!__DEV__) return;
    const m = getLifecycleMetrics();
    trackPerformanceMetric('status_player_lifecycle', m.active_timers + m.active_async_ops + m.active_media_refs, m);
  }, [index, paused]);

  if (!current) return <View style={styles.center}><Text>No story</Text></View>;

  return (
    <View style={styles.root} {...pan.panHandlers}>
      <View style={styles.progressRow}>{items.map((_: any, i: number) => <View key={i} style={styles.seg}><Animated.View style={[styles.segFill, { width: i < index ? '100%' : i === index ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) : '0%' }]} /></View>)}</View>
      <TouchableWithoutFeedback onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} onPress={(e) => {
        const x = e.nativeEvent.locationX;
        if (x < 120) setIndex((i) => Math.max(0, i - 1));
        else setIndex((i) => Math.min(items.length - 1, i + 1));
      }}>
        <View style={styles.mediaWrap}>
          {current.media_type === 'video' ? (
            <Video source={{ uri: current.media_url }} style={styles.media} shouldPlay={!paused} resizeMode={ResizeMode.COVER} onLoad={() => setLoading(false)} onError={() => setLoading(false)} />
          ) : current.media_url ? (
            <Image source={{ uri: current.media_url }} style={styles.media} onLoadEnd={() => setLoading(false)} />
          ) : <View style={styles.center}><Text style={{ color: '#fff' }}>{current.text || ''}</Text></View>}
          {loading ? <ActivityIndicator color="#fff" style={styles.loader} /> : null}
        </View>
      </TouchableWithoutFeedback>
      <View style={styles.reply}><Text style={{ color: '#fff' }}>Reply…</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: '#000' }, progressRow: { flexDirection: 'row', gap: 4, padding: 10 }, seg: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.25)' }, segFill: { height: 3, backgroundColor: '#fff' }, mediaWrap: { flex: 1 }, media: { width: '100%', height: '100%' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, loader: { position: 'absolute', top: '50%', left: '50%' }, reply: { position: 'absolute', bottom: 24, left: 16, right: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', borderRadius: 18, padding: 10 } });
