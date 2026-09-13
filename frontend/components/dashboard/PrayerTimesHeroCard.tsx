import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { PrayerTime } from '@/lib/prayerTimes';

interface PrayerTimesHeroCardProps {
  city?: string;
  state?: string;
  isLocationUnavailable?: boolean;
  currentPrayer: PrayerTime | null;
  nextPrayer: PrayerTime | null;
  progressRatio: number;
  urduCountdown?: string;
  prayers?: PrayerTime[];
  now: Date;
  formatTime: (d: Date) => string;
}

export function PrayerTimesHeroCard({
  city,
  state,
  isLocationUnavailable,
  currentPrayer,
  nextPrayer,
  progressRatio,
  urduCountdown,
  prayers = [],
  now,
  formatTime,
}: PrayerTimesHeroCardProps) {
  const router = useRouter();

  // 5 Daily Fard Prayers
  const fardPrayerNames = ['Fajr', 'Zuhr', 'Asr', 'Maghrib', 'Isha'];
  const dailyPrayers = fardPrayerNames.map((name) => {
    const match = prayers.find((p) => p.name === name);
    return {
      name,
      time: match?.time,
      isCurrent: currentPrayer?.name === name,
      isPast: match?.time ? match.time.getTime() < now.getTime() && currentPrayer?.name !== name : false,
    };
  });

  const locationDisplay = city ? `${city}${state && state !== 'Permission needed' ? `, ${state}` : ''}` : 'Location Setting';

  return (
    <View style={styles.cardContainer}>
      {/* Mosque Background Artwork */}
      <View style={styles.artworkWrap}>
        <Image
          source={require('@/assets/images/prayer_mosque_art.jpg')}
          style={styles.mosqueImage}
          contentFit="cover"
        />
        <View style={styles.artworkOverlay} />
      </View>

      {/* Content */}
      <View style={styles.contentWrap}>
        {/* Header Row */}
        <View style={styles.headerRow}>
          <View style={styles.locationCol}>
            <View style={styles.titleRow}>
              <Ionicons name="time" size={16} color="#C6A15B" />
              <Text style={styles.cardTitle}>PRAYER TIMES</Text>
            </View>

            {isLocationUnavailable ? (
              <TouchableOpacity
                style={styles.locationPromptBadge}
                onPress={() => router.push('/prayer-times')}
                accessibilityRole="button"
                accessibilityLabel="Enable Location or Select City"
                activeOpacity={0.8}
              >
                <Ionicons name="location" size={12} color="#D8C28A" />
                <Text style={styles.locationPromptText}>📍 Select City • Enable</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.locationText} numberOfLines={1}>
                {locationDisplay}
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={styles.viewAllBtn}
            onPress={() => router.push('/prayer-times')}
            accessibilityRole="button"
            accessibilityLabel="View All Prayer Times and Compass"
            activeOpacity={0.8}
          >
            <Text style={styles.viewAllText}>View All</Text>
            <Ionicons name="chevron-forward" size={14} color="#D8C28A" />
          </TouchableOpacity>
        </View>

        {/* Current & Next Prayer Focus */}
        {currentPrayer && nextPrayer ? (
          <>
            <View style={styles.prayerFocusRow}>
              {/* Current */}
              <View style={styles.focusCol}>
                <Text style={styles.focusLabel}>CURRENT PRAYER</Text>
                <Text style={styles.focusName}>{currentPrayer.name}</Text>
                <Text style={styles.focusTime}>{formatTime(currentPrayer.time)}</Text>
              </View>

              <View style={styles.focusDivider} />

              {/* Next */}
              <View style={styles.focusCol}>
                <Text style={styles.focusLabel}>NEXT PRAYER</Text>
                <Text style={styles.focusName}>{nextPrayer.name}</Text>
                <Text style={styles.focusTime}>{formatTime(nextPrayer.time)}</Text>
              </View>
            </View>

            {/* Prayer Window Progress */}
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(100, Math.max(0, progressRatio * 100))}%` },
                ]}
              />
            </View>

            {/* Urdu Countdown Banner */}
            {!!urduCountdown && (
              <TouchableOpacity
                style={styles.countdownBanner}
                onPress={() => router.push('/prayer-times')}
                activeOpacity={0.85}
              >
                <Ionicons name="hourglass-outline" size={14} color="#C6A15B" />
                <Text style={styles.countdownText}>{urduCountdown}</Text>
                <Ionicons name="chevron-forward" size={12} color="#C6A15B" />
              </TouchableOpacity>
            )}

            {/* 5 Daily Prayers Timeline */}
            <View style={styles.timelineRow}>
              {dailyPrayers.map((dp) => (
                <View
                  key={dp.name}
                  style={[
                    styles.timelineItem,
                    dp.isCurrent && styles.timelineItemCurrent,
                  ]}
                >
                  <Text
                    style={[
                      styles.timelineName,
                      dp.isCurrent && styles.timelineNameCurrent,
                    ]}
                  >
                    {dp.name === 'Zuhr' ? 'Dhuhr' : dp.name}
                  </Text>
                  <Text
                    style={[
                      styles.timelineTime,
                      dp.isCurrent && styles.timelineTimeCurrent,
                    ]}
                  >
                    {dp.time ? formatTime(dp.time) : '--:--'}
                  </Text>
                  {dp.isCurrent && <View style={styles.currentDot} />}
                </View>
              ))}
            </View>
          </>
        ) : (
          <View style={styles.fallbackBox}>
            <Text style={styles.fallbackText}>
              Enable location or select your city in settings to see accurate prayer times and adhan reminders.
            </Text>
            <TouchableOpacity
              style={styles.fallbackBtn}
              onPress={() => router.push('/prayer-times')}
              activeOpacity={0.8}
            >
              <Text style={styles.fallbackBtnText}>Select City</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#043C32',
    borderRadius: 20,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(198, 161, 91, 0.3)',
    ...SHADOWS.premiumCard,
  },
  artworkWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.18,
  },
  mosqueImage: {
    width: '100%',
    height: '100%',
  },
  artworkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#043C32',
    opacity: 0.35,
  },
  contentWrap: {
    padding: SPACING.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  locationCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#C6A15B',
    letterSpacing: 1.2,
  },
  locationText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
    marginTop: 2,
  },
  locationPromptBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(198, 161, 91, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 4,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(198, 161, 91, 0.4)',
  },
  locationPromptText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D8C28A',
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D8C28A',
  },
  prayerFocusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(198, 161, 91, 0.2)',
  },
  focusCol: {
    flex: 1,
  },
  focusLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#D8C28A',
    letterSpacing: 1,
  },
  focusName: {
    fontSize: 19,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  focusTime: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 1,
  },
  focusDivider: {
    width: 1,
    height: 38,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginHorizontal: 12,
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#C6A15B',
    borderRadius: 2,
  },
  countdownBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(7, 91, 73, 0.5)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(198, 161, 91, 0.3)',
  },
  countdownText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FDE68A',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 6,
  },
  timelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    gap: 4,
  },
  timelineItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  timelineItemCurrent: {
    backgroundColor: 'rgba(198, 161, 91, 0.25)',
    borderColor: '#C6A15B',
  },
  timelineName: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
  },
  timelineNameCurrent: {
    color: '#FFFFFF',
  },
  timelineTime: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
  timelineTimeCurrent: {
    color: '#FDE68A',
  },
  currentDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#C6A15B',
    marginTop: 4,
  },
  fallbackBox: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: SPACING.md,
    alignItems: 'center',
  },
  fallbackText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 18,
  },
  fallbackBtn: {
    marginTop: 10,
    backgroundColor: '#C6A15B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  fallbackBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#043C32',
  },
});
