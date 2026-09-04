/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableWithoutFeedback,
  Animated,
  PanResponder,
  ActivityIndicator,
  Image,
  AppState,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { goBackOrReplace } from '@/lib/navigation';
import { Video, ResizeMode, Audio, type AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import {
  clearAsyncOp,
  clearMediaRef,
  clearTimerTrack,
  getLifecycleMetrics,
  trackAsyncOp,
  trackMediaRef,
  trackTimer,
} from '@/lib/lifecycleDiagnostics';
import { trackPerformanceMetric } from '@/lib/performanceEngine';
import { COLORS, RADIUS, SPACING, SHADOWS } from '@/constants/theme';

const DEFAULT_IMAGE_DURATION_MS = 5000;
const AUDIO_STATUS_DURATION_MS = 30000;

export default function StatusPlayer() {
  const router = useRouter();
  const { itemsJson, start, data } = useLocalSearchParams<{
    itemsJson?: string;
    start?: string;
    data?: string;
  }>();

  const items = useMemo(() => {
    try {
      if (itemsJson) return JSON.parse(itemsJson);
      if (data) return JSON.parse(data);
      return [];
    } catch {
      return [];
    }
  }, [itemsJson, data]);

  const [index, setIndex] = useState(Math.max(0, Number(start || 0) || 0));
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const progress = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const prefetchSeqRef = useRef(0);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Sound wave animation for audio playback
  const waveAnim = useRef(new Animated.Value(0.4)).current;

  const current = items[index];

  // Play audio when status is of type audio
  useEffect(() => {
    let activeSound: Audio.Sound | null = null;
    let isCancelled = false;

    const startAudio = async () => {
      if (soundRef.current) {
        await soundRef.current.stopAsync().catch(() => {});
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }

      if (!current || current.media_type !== 'audio' || !current.media_url) {
        return;
      }

      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });

        const { sound } = await Audio.Sound.createAsync(
          { uri: current.media_url },
          { shouldPlay: !paused },
          (status: AVPlaybackStatus) => {
            if (!status.isLoaded) return;
            if (status.didJustFinish) {
              setIndex((i: number) => (i + 1 < items.length ? i + 1 : i));
            }
          }
        );

        if (isCancelled) {
          sound.unloadAsync().catch(() => {});
        } else {
          soundRef.current = sound;
          activeSound = sound;
        }
      } catch (err) {
        console.warn('[StatusPlayer] Error playing audio status', err);
      }
    };

    startAudio();

    return () => {
      isCancelled = true;
      if (activeSound) {
        activeSound.stopAsync().catch(() => {});
        activeSound.unloadAsync().catch(() => {});
      }
      if (soundRef.current) {
        soundRef.current.stopAsync().catch(() => {});
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, [current, items.length]);

  // Pause or resume audio on user hold
  useEffect(() => {
    if (!soundRef.current || current?.media_type !== 'audio') return;
    if (paused) {
      soundRef.current.pauseAsync().catch(() => {});
    } else {
      soundRef.current.playAsync().catch(() => {});
    }
  }, [paused, current?.media_type]);

  // Loop pulsing wave animation when audio status is active and not paused
  useEffect(() => {
    if (current?.media_type === 'audio' && !paused) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(waveAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(waveAnim, {
            toValue: 0.35,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      waveAnim.setValue(0.5);
    }
  }, [current?.media_type, paused, waveAnim]);

  // Story duration calculation: 30s for audio status, 5s for images/text
  const effectiveDuration = useMemo(() => {
    if (!current) return DEFAULT_IMAGE_DURATION_MS;
    if (current.media_type === 'audio') {
      return Number(current.duration_ms) || AUDIO_STATUS_DURATION_MS;
    }
    return DEFAULT_IMAGE_DURATION_MS;
  }, [current]);

  useEffect(() => {
    setLoading(true);
    progress.setValue(0);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      clearTimerTrack('status_player_advance');
    }
    if (!current) return;
    if (!paused) {
      Animated.timing(progress, {
        toValue: 1,
        duration: effectiveDuration,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) setIndex((i: number) => (i + 1 < items.length ? i + 1 : i));
      });
      timerRef.current = setTimeout(() => {
        setIndex((i: number) => (i + 1 < items.length ? i + 1 : i));
      }, effectiveDuration);
      trackTimer('status_player_advance');
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        clearTimerTrack('status_player_advance');
      }
    };
  }, [index, paused, current, items.length, progress, effectiveDuration]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 15,
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80) goBackOrReplace(router, '/status');
      },
    })
  ).current;

  useEffect(() => {
    const next = items[index + 1];
    if (next?.media_type === 'image' && next?.media_url) {
      const opId = `status_player_prefetch_${++prefetchSeqRef.current}`;
      trackAsyncOp(opId);
      trackMediaRef(next.media_url);
      Image.prefetch(next.media_url)
        .catch(() => {})
        .finally(() => {
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
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (!__DEV__) return;
    const m = getLifecycleMetrics();
    trackPerformanceMetric(
      'status_player_lifecycle',
      m.active_timers + m.active_async_ops + m.active_media_refs,
      m
    );
  }, [index, paused]);

  if (!current) {
    return (
      <View style={styles.center}>
        <Text style={{ color: '#fff' }}>No story</Text>
      </View>
    );
  }

  const isTeacherOrAdmin = current.role === 'teacher' || current.role === 'admin';

  return (
    <View style={styles.root} {...pan.panHandlers}>
      {/* Progress Bars */}
      <View style={styles.progressRow}>
        {items.map((_: any, i: number) => (
          <View key={i} style={styles.seg}>
            <Animated.View
              style={[
                styles.segFill,
                {
                  width:
                    i < index
                      ? '100%'
                      : i === index
                      ? progress.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        })
                      : '0%',
                },
              ]}
            />
          </View>
        ))}
      </View>

      {/* Top Header: Author & Ustaadha Verified Badge */}
      <View style={styles.headerRow}>
        <View style={styles.authorGroup}>
          <Text style={styles.authorName}>{current.user_name || 'Ustaadha'}</Text>
          {isTeacherOrAdmin ? (
            <View style={styles.verifiedPill}>
              <Ionicons name="shield-checkmark" size={13} color="#10B981" />
              <Text style={styles.verifiedPillText}>مستند معلمہ</Text>
            </View>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={() => goBackOrReplace(router, '/status')}
          style={styles.closeBtn}
        >
          <Ionicons name="close" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Media Playback View */}
      <TouchableWithoutFeedback
        onLongPress={() => setPaused(true)}
        onPressOut={() => setPaused(false)}
        onPress={(e) => {
          const x = e.nativeEvent.locationX;
          if (x < 120) setIndex((i) => Math.max(0, i - 1));
          else setIndex((i) => Math.min(items.length - 1, i + 1));
        }}
      >
        <View style={styles.mediaWrap}>
          {current.media_type === 'video' ? (
            <Video
              source={{ uri: current.media_url }}
              style={styles.media}
              shouldPlay={!paused}
              resizeMode={ResizeMode.COVER}
              onLoad={() => setLoading(false)}
              onError={() => setLoading(false)}
            />
          ) : current.media_type === 'audio' ? (
            <View style={styles.audioPlayerContainer}>
              {/* Islamic Pattern & Disc Visualizer */}
              <Animated.View
                style={[
                  styles.audioGlowDisc,
                  {
                    transform: [{ scale: waveAnim }],
                  },
                ]}
              />
              <View style={styles.audioCenterDisc}>
                <Ionicons name="musical-notes" size={48} color="#10B981" />
              </View>

              {/* Title & Tag */}
              <Text style={styles.audioTilawatTitle}>
                {current.audio_title || 'تلاوت کلام پاک / Tilawat'}
              </Text>
              <Text style={styles.audioTilawatSub}>
                30 سیکنڈ تلاوت و نصیحت • مستند معلمہ
              </Text>

              {/* Waveform Visualization Bars */}
              <View style={styles.waveBarsRow}>
                {[0.4, 0.7, 1.0, 0.6, 0.85, 0.5, 0.9, 0.35, 0.75].map((h, i) => (
                  <Animated.View
                    key={i}
                    style={[
                      styles.waveBar,
                      {
                        height: 24 * h,
                        opacity: waveAnim.interpolate({
                          inputRange: [0.35, 1],
                          outputRange: [0.4, 1],
                        }),
                      },
                    ]}
                  />
                ))}
              </View>

              {current.text ? (
                <View style={styles.audioTextCard}>
                  <Text style={styles.audioTextCardContent}>{current.text}</Text>
                </View>
              ) : null}
            </View>
          ) : current.media_url ? (
            <Image
              source={{ uri: current.media_url }}
              style={styles.media}
              onLoadEnd={() => setLoading(false)}
            />
          ) : (
            <View style={styles.center}>
              <Text style={{ color: '#fff', fontSize: 18, paddingHorizontal: 24, textAlign: 'center' }}>
                {current.text || ''}
              </Text>
            </View>
          )}

          {loading && current.media_type !== 'audio' ? (
            <ActivityIndicator color={COLORS.primary} style={styles.loader} />
          ) : null}
        </View>
      </TouchableWithoutFeedback>

      {/* Footer Reply Bar */}
      <View style={styles.reply}>
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
          {current.media_type === 'audio' ? 'جزاک اللہ خیراً لکھیں…' : 'Reply…'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#06130B' },
  progressRow: { flexDirection: 'row', gap: 4, paddingHorizontal: 10, paddingTop: 10 },
  seg: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 2 },
  segFill: { height: 3, backgroundColor: '#10B981', borderRadius: 2 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    zIndex: 10,
  },
  authorGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  authorName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  verifiedPillText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 6,
  },
  mediaWrap: { flex: 1 },
  media: { width: '100%', height: '100%' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loader: { position: 'absolute', top: '50%', left: '50%' },
  reply: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  audioPlayerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  audioGlowDisc: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
  },
  audioCenterDisc: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 2,
    borderColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  audioTilawatTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  audioTilawatSub: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  waveBarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  waveBar: {
    width: 5,
    backgroundColor: '#10B981',
    borderRadius: 3,
  },
  audioTextCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: RADIUS.lg,
    padding: 14,
    maxWidth: '90%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  audioTextCardContent: {
    color: '#E2E8F0',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
