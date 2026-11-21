import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';

interface LiveVoiceWaveformProps {
  isSpeaking: boolean;
  speakerName: string;
  isTeacher: boolean;
  voiceConnected: boolean;
  remoteCount?: number;
}

export function LiveVoiceWaveform({
  isSpeaking,
  speakerName,
  isTeacher,
  voiceConnected,
  remoteCount = 0,
}: LiveVoiceWaveformProps) {
  // 5 animated bars for the multi-frequency audio waveform
  const bar1 = useRef(new Animated.Value(4)).current;
  const bar2 = useRef(new Animated.Value(4)).current;
  const bar3 = useRef(new Animated.Value(4)).current;
  const bar4 = useRef(new Animated.Value(4)).current;
  const bar5 = useRef(new Animated.Value(4)).current;

  // Pulse rings for the speaker avatar
  const pulseRing1 = useRef(new Animated.Value(1)).current;
  const pulseRing2 = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let animLoop: Animated.CompositeAnimation | null = null;
    let pulseLoop: Animated.CompositeAnimation | null = null;

    if (isSpeaking) {
      const createBarAnim = (anim: Animated.Value, maxH: number, duration: number) => {
        return Animated.sequence([
          Animated.timing(anim, {
            toValue: maxH,
            duration,
            useNativeDriver: false,
          }),
          Animated.timing(anim, {
            toValue: 6,
            duration,
            useNativeDriver: false,
          }),
        ]);
      };

      animLoop = Animated.loop(
        Animated.parallel([
          createBarAnim(bar1, 24, 210),
          createBarAnim(bar2, 32, 170),
          createBarAnim(bar3, 20, 230),
          createBarAnim(bar4, 28, 190),
          createBarAnim(bar5, 18, 250),
        ])
      );
      animLoop.start();

      pulseLoop = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseRing1, { toValue: 1.45, duration: 700, useNativeDriver: true }),
            Animated.timing(pulseRing1, { toValue: 1, duration: 700, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(pulseRing2, { toValue: 1.25, duration: 550, useNativeDriver: true }),
            Animated.timing(pulseRing2, { toValue: 1, duration: 550, useNativeDriver: true }),
          ]),
        ])
      );
      pulseLoop.start();
    } else {
      // Smoothly reset bars to resting flat line
      Animated.parallel([
        Animated.timing(bar1, { toValue: 4, duration: 200, useNativeDriver: false }),
        Animated.timing(bar2, { toValue: 4, duration: 200, useNativeDriver: false }),
        Animated.timing(bar3, { toValue: 4, duration: 200, useNativeDriver: false }),
        Animated.timing(bar4, { toValue: 4, duration: 200, useNativeDriver: false }),
        Animated.timing(bar5, { toValue: 4, duration: 200, useNativeDriver: false }),
        Animated.timing(pulseRing1, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(pulseRing2, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }

    return () => {
      if (animLoop) animLoop.stop();
      if (pulseLoop) pulseLoop.stop();
    };
  }, [isSpeaking, bar1, bar2, bar3, bar4, bar5, pulseRing1, pulseRing2]);

  let statusLabel = '🎧 Listening to classroom audio';
  let statusUrdu = 'سماعت جاری ہے';

  if (isSpeaking) {
    if (isTeacher) {
      statusLabel = '🎙️ Ustaadha is speaking...';
      statusUrdu = 'استانی صاحبہ کی تدریس جاری ہے';
    } else {
      statusLabel = `📖 ${speakerName || 'Talibah'} is reciting...`;
      statusUrdu = 'تلاوت جاری ہے';
    }
  }

  return (
    <View style={[styles.card, isSpeaking && styles.cardActiveSpeaking]}>
      {/* Speaker Avatar with Pulsing Acoustic Rings */}
      <View style={styles.avatarWrap}>
        {isSpeaking && (
          <>
            <Animated.View
              style={[
                styles.pulseRingOuter,
                { transform: [{ scale: pulseRing1 }] },
              ]}
            />
            <Animated.View
              style={[
                styles.pulseRingInner,
                { transform: [{ scale: pulseRing2 }] },
              ]}
            />
          </>
        )}
        <View style={[styles.avatarCircle, isSpeaking && styles.avatarCircleSpeaking]}>
          <Ionicons
            name={isSpeaking ? (isTeacher ? 'mic' : 'book') : 'volume-high'}
            size={22}
            color={isSpeaking ? '#FFFFFF' : '#059669'}
          />
        </View>
      </View>

      {/* Speaker Info & Realtime Speaking Indicator */}
      <View style={styles.infoCol}>
        <View style={styles.speakerHeaderRow}>
          <Text style={styles.speakerLabel}>
            {isTeacher ? 'TEACHER / USTAADHA' : 'ACTIVE RECITER'}
          </Text>
          {isSpeaking && (
            <View style={styles.liveSpeakingBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveSpeakingText}>SPEAKING</Text>
            </View>
          )}
        </View>

        <Text style={styles.speakerName} numberOfLines={1}>
          {speakerName || 'Faculty / Reciter'}
        </Text>

        <Text style={styles.speakerSubtext} numberOfLines={1}>
          {statusLabel} • <Text style={styles.urduSubtext}>{statusUrdu}</Text>
        </Text>
      </View>

      {/* 5-Bar Dynamic Audio Waveform Visualizer */}
      <View style={styles.waveformContainer}>
        <View style={styles.waveformBarsRow}>
          <Animated.View style={[styles.waveformBar, { height: bar1 }, isSpeaking && styles.waveformBarActive]} />
          <Animated.View style={[styles.waveformBar, { height: bar2 }, isSpeaking && styles.waveformBarActive]} />
          <Animated.View style={[styles.waveformBar, { height: bar3 }, isSpeaking && styles.waveformBarActive]} />
          <Animated.View style={[styles.waveformBar, { height: bar4 }, isSpeaking && styles.waveformBarActive]} />
          <Animated.View style={[styles.waveformBar, { height: bar5 }, isSpeaking && styles.waveformBarActive]} />
        </View>
        <Text style={[styles.waveformCaption, isSpeaking && styles.waveformCaptionActive]}>
          {isSpeaking ? 'Voice HD' : (voiceConnected ? 'Live Audio' : 'Connecting')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    gap: 12,
    ...SHADOWS.card,
  },
  cardActiveSpeaking: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  avatarWrap: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  pulseRingOuter: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#10B981',
    opacity: 0.35,
  },
  pulseRingInner: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#059669',
    opacity: 0.5,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircleSpeaking: {
    backgroundColor: '#059669',
    borderColor: '#047857',
  },
  infoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  speakerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  speakerLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 0.5,
  },
  liveSpeakingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: RADIUS.full,
    gap: 3,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#16A34A',
  },
  liveSpeakingText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.4,
  },
  speakerName: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#1E293B',
  },
  speakerSubtext: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  urduSubtext: {
    fontSize: 11,
    color: '#047857',
    fontWeight: '600',
  },
  waveformContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 54,
  },
  waveformBarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    height: 34,
  },
  waveformBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
  },
  waveformBarActive: {
    backgroundColor: '#059669',
  },
  waveformCaption: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 2,
  },
  waveformCaptionActive: {
    color: '#059669',
  },
});
