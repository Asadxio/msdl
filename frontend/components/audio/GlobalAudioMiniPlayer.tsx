import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useGlobalAudio } from '@/context/GlobalAudioContext';
import { useTheme } from '@/context/ThemeContext';
import { RADIUS, SPACING, SHADOWS } from '@/constants/theme';

export function GlobalAudioMiniPlayer() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();

  const {
    currentTrack,
    isPlaying,
    isBuffering,
    positionMs,
    durationMs,
    playbackSpeed,
    isLooping,
    isMiniPlayerVisible,
    isExpandedModalVisible,
    pauseTrack,
    resumeTrack,
    stopTrack,
    seekTrack,
    nextTrack,
    prevTrack,
    setPlaybackSpeed,
    toggleLooping,
    setExpandedModalVisible,
  } = useGlobalAudio();

  if (!isMiniPlayerVisible || !currentTrack) {
    return null;
  }

  const formatTime = (millis: number) => {
    const totalSeconds = Math.max(0, Math.floor(millis / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const progressPct = durationMs > 0 ? Math.min(100, (positionMs / durationMs) * 100) : 0;

  const handleTogglePlay = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    if (isPlaying) {
      await pauseTrack();
    } else {
      await resumeTrack();
    }
  };

  const handleCycleSpeed = async () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    const speeds = [1.0, 1.25, 1.5, 2.0];
    const currentIdx = speeds.indexOf(playbackSpeed);
    const nextIdx = (currentIdx + 1) % speeds.length;
    await setPlaybackSpeed(speeds[nextIdx]);
  };

  return (
    <>
      {/* ── Mini Player Floating Pill ── */}
      <View
        style={[
          styles.miniContainer,
          {
            bottom: insets.bottom + 56, // Above bottom tab bar
            backgroundColor: isDark ? '#0D2721' : colors.surface,
            borderColor: isDark ? '#1C4A3E' : colors.border,
          },
        ]}
      >
        {/* Progress Line */}
        <View style={styles.miniProgressTrack}>
          <View
            style={[
              styles.miniProgressFill,
              { width: `${progressPct}%`, backgroundColor: colors.gold },
            ]}
          />
        </View>

        <TouchableOpacity
          style={styles.miniContentRow}
          activeOpacity={0.85}
          onPress={() => setExpandedModalVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={`Now playing ${currentTrack.titleEn}. Tap to open player.`}
        >
          {/* Icon / Artwork Box */}
          <View style={[styles.miniIconBox, { backgroundColor: colors.surfaceAlt }]}>
            <Ionicons
              name={
                currentTrack.category === 'quran'
                  ? 'book'
                  : currentTrack.category === 'azaan'
                  ? 'mic'
                  : currentTrack.category === 'salah'
                  ? 'body'
                  : 'musical-notes'
              }
              size={18}
              color={colors.primary}
            />
          </View>

          {/* Titles */}
          <View style={styles.miniTextWrap}>
            <Text style={[styles.miniTitleEn, { color: colors.text }]} numberOfLines={1}>
              {currentTrack.titleEn}
            </Text>
            <Text style={[styles.miniSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
              {currentTrack.titleAr || currentTrack.titleUr || currentTrack.artistOrSource || 'SUFFAH Audio'}
            </Text>
          </View>

          {/* Play/Pause Button */}
          <TouchableOpacity
            style={[styles.miniControlBtn, { backgroundColor: colors.primary }]}
            onPress={handleTogglePlay}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? 'Pause audio' : 'Play audio'}
          >
            <Ionicons
              name={isBuffering ? 'hourglass-outline' : isPlaying ? 'pause' : 'play'}
              size={18}
              color={colors.white}
            />
          </TouchableOpacity>

          {/* Close Button */}
          <TouchableOpacity
            style={styles.miniCloseBtn}
            onPress={stopTrack}
            accessibilityRole="button"
            accessibilityLabel="Close audio player"
          >
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </TouchableOpacity>
      </View>

      {/* ── Full Expanded Audio Modal ── */}
      <Modal
        visible={isExpandedModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setExpandedModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: isDark ? '#081B17' : colors.surface,
                paddingBottom: insets.bottom + SPACING.lg,
              },
            ]}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setExpandedModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Collapse player"
              >
                <Ionicons name="chevron-down" size={26} color={colors.text} />
              </TouchableOpacity>

              <View style={styles.modalHeaderCenter}>
                <Text style={[styles.modalHeaderEyebrow, { color: colors.gold }]}>
                  {currentTrack.category.toUpperCase()} AUDIO
                </Text>
                <Text style={[styles.modalHeaderTitle, { color: colors.text }]} numberOfLines={1}>
                  {currentTrack.titleEn}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={stopTrack}
                accessibilityRole="button"
                accessibilityLabel="Stop audio"
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Visual Sanctuary Showcase */}
            <View style={[styles.modalShowcase, { backgroundColor: isDark ? '#0D2721' : '#F4F9F6' }]}>
              {currentTrack.titleAr ? (
                <Text style={[styles.modalArabicTitle, { color: colors.gold }]}>
                  {currentTrack.titleAr}
                </Text>
              ) : (
                <Ionicons name="musical-notes-outline" size={54} color={colors.primary} />
              )}
              <Text style={[styles.modalArtist, { color: colors.textSecondary }]}>
                {currentTrack.artistOrSource || 'SUFFAH Devotional Audio'}
              </Text>
            </View>

            {/* Scrubber Timeline */}
            <View style={styles.timelineSection}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.scrubberTrack, { backgroundColor: isDark ? '#1C4A3E' : '#E2E8F0' }]}
                onPress={(e) => {
                  const clickX = e.nativeEvent.locationX;
                  const trackW = width - SPACING.lg * 2;
                  const newPct = Math.max(0, Math.min(1, clickX / trackW));
                  seekTrack(newPct * durationMs);
                }}
              >
                <View
                  style={[
                    styles.scrubberFill,
                    { width: `${progressPct}%`, backgroundColor: colors.gold },
                  ]}
                />
              </TouchableOpacity>

              <View style={styles.timeRow}>
                <Text style={[styles.timeText, { color: colors.textSecondary }]}>
                  {formatTime(positionMs)}
                </Text>
                <Text style={[styles.timeText, { color: colors.textSecondary }]}>
                  {formatTime(durationMs)}
                </Text>
              </View>
            </View>

            {/* Main Audio Controls */}
            <View style={styles.mainControlsRow}>
              {/* Loop Toggle */}
              <TouchableOpacity
                style={styles.extraBtn}
                onPress={toggleLooping}
                accessibilityRole="button"
                accessibilityLabel="Toggle repeat"
              >
                <Ionicons
                  name="repeat"
                  size={22}
                  color={isLooping ? colors.gold : colors.textSecondary}
                />
              </TouchableOpacity>

              {/* Prev */}
              <TouchableOpacity
                style={styles.navStepBtn}
                onPress={prevTrack}
                accessibilityRole="button"
                accessibilityLabel="Previous track"
              >
                <Ionicons name="play-skip-back" size={24} color={colors.text} />
              </TouchableOpacity>

              {/* Big Play/Pause */}
              <TouchableOpacity
                style={[styles.bigPlayBtn, { backgroundColor: colors.primary }]}
                onPress={handleTogglePlay}
                accessibilityRole="button"
                accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
              >
                <Ionicons
                  name={isBuffering ? 'hourglass-outline' : isPlaying ? 'pause' : 'play'}
                  size={32}
                  color={colors.white}
                />
              </TouchableOpacity>

              {/* Next */}
              <TouchableOpacity
                style={styles.navStepBtn}
                onPress={nextTrack}
                accessibilityRole="button"
                accessibilityLabel="Next track"
              >
                <Ionicons name="play-skip-forward" size={24} color={colors.text} />
              </TouchableOpacity>

              {/* Speed Switcher */}
              <TouchableOpacity
                style={styles.extraBtn}
                onPress={handleCycleSpeed}
                accessibilityRole="button"
                accessibilityLabel={`Speed ${playbackSpeed}x`}
              >
                <Text style={[styles.speedText, { color: colors.textSecondary }]}>
                  {playbackSpeed}x
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  miniContainer: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
    ...SHADOWS.md,
    zIndex: 9998,
  },
  miniProgressTrack: {
    height: 3,
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  miniProgressFill: {
    height: '100%',
  },
  miniContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    gap: SPACING.sm,
  },
  miniIconBox: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniTextWrap: {
    flex: 1,
  },
  miniTitleEn: {
    fontSize: 14,
    fontWeight: '700',
  },
  miniSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  miniControlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniCloseBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOWS.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalCloseBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderCenter: {
    flex: 1,
    alignItems: 'center',
  },
  modalHeaderEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  modalShowcase: {
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
    minHeight: 140,
  },
  modalArabicTitle: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 52,
    marginBottom: 6,
  },
  modalArtist: {
    fontSize: 13,
    textAlign: 'center',
  },
  timelineSection: {
    marginBottom: SPACING.lg,
  },
  scrubberTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  scrubberFill: {
    height: '100%',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  mainControlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
  extraBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navStepBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigPlayBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.md,
  },
  speedText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
