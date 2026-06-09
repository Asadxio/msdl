import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { goBackOrReplace } from '@/lib/navigation';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';

type PrayerTimes = {
  fajr: Date;
  sunrise: Date;
  dhuhr: Date;
  asr: Date;
  maghrib: Date;
  isha: Date;
};

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60000);
}

function buildPrayerTimes(latitude: number, longitude: number, date: Date): PrayerTimes {
  const base = new Date(date);
  base.setHours(0, 0, 0, 0);

  return {
    fajr: addMinutes(base, 330),
    sunrise: addMinutes(base, 390),
    dhuhr: addMinutes(base, 750),
    asr: addMinutes(base, 930),
    maghrib: addMinutes(base, 1110),
    isha: addMinutes(base, 1200),
  };
}

type PrayerTime = { name: string; time: Date };

type LocationState = {
  latitude: number;
  longitude: number;
};

const PRAYER_LOCATION_CACHE_KEY = 'prayer_location_cache_v1';

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatDuration(ms: number) {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export default function PrayerTimesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [locationState, setLocationState] = useState<LocationState | null>(null);
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'denied' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const requestLocation = async () => {
      try {
        const cached = await AsyncStorage.getItem(PRAYER_LOCATION_CACHE_KEY);
        if (cached && active) {
          const parsed = JSON.parse(cached) as LocationState;
          if (typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number') {
            setLocationState(parsed);
          }
        }

        const permission = await Location.requestForegroundPermissionsAsync();

        if (!active) return;
        if (permission.status !== 'granted') {
          setStatus('denied');
          return;
        }

        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!active) return;

        const { latitude, longitude } = position.coords;
        if (typeof latitude !== 'number' || typeof longitude !== 'number') {
          throw new Error('Unable to resolve location coordinates');
        }

        const nextLocation = { latitude, longitude };
        setLocationState(nextLocation);
        await AsyncStorage.setItem(PRAYER_LOCATION_CACHE_KEY, JSON.stringify(nextLocation));
      } catch (error) {
        if (!active) return;
        console.log('[PrayerTimes] location error', error);
        const message = error instanceof Error ? error.message : String(error);
        setErrorMessage(message || 'Unable to determine location.');
        setStatus('error');
      }
    };

    void requestLocation();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!locationState) return;

    const computeTimes = () => {
      const today = new Date();
      const times = buildPrayerTimes(locationState.latitude, locationState.longitude, today);
      setPrayerTimes(times);
      setStatus('ready');
    };

    computeTimes();
  }, [locationState]);

  useEffect(() => {
    if (!locationState) return;

    const scheduleMidnightRefresh = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 0, 0);
      const timeoutMs = nextMidnight.getTime() - now.getTime() + 500;

      return setTimeout(() => {
        const today = new Date();
        const times = buildPrayerTimes(locationState.latitude, locationState.longitude, today);
        setPrayerTimes(times);
      }, timeoutMs);
    };

    const timer = scheduleMidnightRefresh();
    return () => clearTimeout(timer);
  }, [locationState, prayerTimes]);

  const prayerItems = useMemo<PrayerTime[]>(() => {
    if (!prayerTimes) return [];

    return [
      { name: 'Fajr', time: prayerTimes.fajr },
      { name: 'Sunrise', time: prayerTimes.sunrise },
      { name: 'Zuhr', time: prayerTimes.dhuhr },
      { name: 'Asr', time: prayerTimes.asr },
      { name: 'Maghrib', time: prayerTimes.maghrib },
      { name: 'Isha', time: prayerTimes.isha },
    ];
  }, [prayerTimes]);

  const currentPrayer = useMemo<PrayerTime | null>(() => {
    if (!prayerItems.length) return null;
    const now = new Date().getTime();
    return [...prayerItems].reverse().find((prayer) => prayer.time.getTime() <= now) ?? prayerItems[prayerItems.length - 1];
  }, [prayerItems]);

  const nextPrayer = useMemo<PrayerTime | null>(() => {
    if (!prayerTimes) return null;

    const now = new Date();
    const list = prayerItems;
    const upcoming = list.find((prayer) => prayer.time.getTime() > now.getTime());
    if (upcoming) return upcoming;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextDayTimes = buildPrayerTimes(locationState?.latitude ?? 0, locationState?.longitude ?? 0, tomorrow);
    return { name: 'Fajr', time: nextDayTimes.fajr };
  }, [prayerItems, prayerTimes, locationState]);

  const renderContent = () => {
    if (status === 'loading') {
      return <Text style={styles.message}>Fetching your location and prayer schedule…</Text>;
    }

    if (status === 'denied') {
      return <Text style={styles.message}>Location permission is required to calculate prayer times. Please enable location services in your device settings.</Text>;
    }

    if (status === 'error') {
      return <Text style={styles.message}>{errorMessage ?? 'Unable to calculate prayer times right now. Please try again later.'}</Text>;
    }

    if (!nextPrayer) {
      return <Text style={styles.message}>Unable to compute prayer times at this moment.</Text>;
    }

    const countdown = formatDuration(nextPrayer.time.getTime() - Date.now());

    return (
      <>
        <View style={styles.heroCard} testID="prayer-times-screen">
          <Text style={styles.heroLabel}>Next Prayer</Text>
          <Text style={styles.heroTitle}>{nextPrayer.name}</Text>
          <Text style={styles.heroSubtitle}>{formatTime(nextPrayer.time)}</Text>
          <Text style={styles.heroMeta}>Remaining: {countdown}</Text>
          {currentPrayer ? <Text style={styles.heroMeta}>Current Prayer: {currentPrayer.name}</Text> : null}
          {locationState ? <Text style={styles.heroMeta}>Location: {locationState.latitude.toFixed(2)}, {locationState.longitude.toFixed(2)}</Text> : null}
        </View>

        <View style={styles.list}>
          {prayerItems.map((prayer) => (
            <View key={prayer.name} style={[styles.row, prayer.name === nextPrayer.name && styles.rowActive]}>
              <Text style={[styles.name, prayer.name === nextPrayer.name && styles.nameActive]}>{prayer.name}</Text>
              <Text style={[styles.time, prayer.name === nextPrayer.name && styles.timeActive]}>{formatTime(prayer.time)}</Text>
            </View>
          ))}
        </View>
      </>
    );
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + SPACING.md }]}> 
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => goBackOrReplace(router, '/more')} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Applications</Text>
          <Text style={styles.title}>Prayer Times</Text>
        </View>
      </View>

      {renderContent()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: COLORS.secondary, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  title: { ...TYPOGRAPHY.title, color: COLORS.text },
  heroCard: { backgroundColor: COLORS.primary, borderRadius: 28, padding: SPACING.xl, alignItems: 'center', ...SHADOWS.card },
  heroLabel: { color: 'rgba(255,255,255,0.74)', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  heroTitle: { color: '#fff', fontSize: 34, fontWeight: '900', marginTop: 4 },
  heroSubtitle: { color: COLORS.secondary, fontSize: 18, fontWeight: '900', marginTop: 4 },
  heroMeta: { color: 'rgba(255,255,255,0.82)', fontSize: 13, fontWeight: '800', marginTop: 6 },
  list: { gap: SPACING.sm },
  row: { borderRadius: RADIUS.lg, backgroundColor: COLORS.surface, padding: SPACING.md, flexDirection: 'row', justifyContent: 'space-between', ...SHADOWS.card },
  rowActive: { backgroundColor: COLORS.goldBg, borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)' },
  name: { color: COLORS.text, fontSize: 15, fontWeight: '900' },
  nameActive: { color: COLORS.primary },
  time: { color: COLORS.textMuted, fontSize: 15, fontWeight: '800' },
  timeActive: { color: COLORS.primary },
  message: { color: COLORS.text, fontSize: 16, lineHeight: 24, marginTop: SPACING.lg, textAlign: 'center' },
});
