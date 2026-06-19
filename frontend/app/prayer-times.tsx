import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
// nextMidnight
// const countdown = formatDuration
// Current Prayer
// Next Prayer
// Remaining
// Location
import { goBackOrReplace } from '@/lib/navigation';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

type PrayerTime = { name: string; time: Date; icon: keyof typeof Ionicons.glyphMap };
type LocationState = { latitude: number; longitude: number };

const PRAYER_LOCATION_CACHE_KEY = 'prayer_location_cache_v1';
const PRAYER_CITY_CACHE_KEY = 'prayer_city_cache_v1';

const PRAYER_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Fajr: 'moon-outline',
  Sunrise: 'sunny-outline',
  Zuhr: 'sunny',
  Asr: 'partly-sunny-outline',
  Maghrib: 'cloudy-night-outline',
  Isha: 'moon',
};

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

function toHijriApprox(date: Date): string {
  try {
    return date.toLocaleDateString('en-u-ca-islamic-umalqura', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch {
    return '';
  }
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

export default function PrayerTimesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [locationState, setLocationState] = useState<LocationState | null>(null);
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'denied' | 'location_unavailable' | 'api_failed'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cityName, setCityName] = useState<string>('');
  const [countdown, setCountdown] = useState<string>('');
  const isMounted = useRef(true);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const requestLocation = useCallback(async () => {
    if (!isMounted.current) return;
    setStatus('loading');
    setErrorMessage(null);
    const LocationAny = Location as any;
    try {
      const cached = await AsyncStorage.getItem(PRAYER_LOCATION_CACHE_KEY);
      if (cached && isMounted.current) {
        const parsed = JSON.parse(cached) as LocationState;
        if (typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number') {
          setLocationState(parsed);
        }
      }
      const cachedCity = await AsyncStorage.getItem(PRAYER_CITY_CACHE_KEY);
      if (cachedCity) setCityName(cachedCity);

      const servicesEnabled = await LocationAny.hasServicesEnabledAsync().catch(() => false);
      if (!servicesEnabled) { if (isMounted.current) setStatus('location_unavailable'); return; }

      let permission = await LocationAny.getForegroundPermissionsAsync().catch(() => null);
      if (!permission || permission.status !== 'granted') {
        permission = await LocationAny.requestForegroundPermissionsAsync().catch(() => null);
      }
      if (!isMounted.current) return;
      if (!permission || permission.status !== 'granted') { setStatus('denied'); return; }

      let position: any = null;
      try {
        const getPositionPromise = LocationAny.getCurrentPositionAsync({ accuracy: LocationAny.Accuracy?.Balanced ?? 3 });
        const timeoutPromise = new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000));
        position = await Promise.race([getPositionPromise, timeoutPromise]);
      } catch {
        try { position = await LocationAny.getLastKnownPositionAsync(); } catch {}
      }
      if (!isMounted.current) return;
      if (!position) { setStatus('location_unavailable'); return; }

      const { latitude, longitude } = position.coords;
      if (typeof latitude !== 'number' || typeof longitude !== 'number') { setStatus('location_unavailable'); return; }

      const nextLocation = { latitude, longitude };
      setLocationState(nextLocation);
      await AsyncStorage.setItem(PRAYER_LOCATION_CACHE_KEY, JSON.stringify(nextLocation));

      // Reverse geocode for city name
      try {
        const [geo] = await LocationAny.reverseGeocodeAsync({ latitude, longitude });
        if (geo && isMounted.current) {
          const city = [geo.city, geo.region].filter(Boolean).join(', ');
          setCityName(city || 'Unknown Location');
          await AsyncStorage.setItem(PRAYER_CITY_CACHE_KEY, city || 'Unknown Location');
        }
      } catch {
        if (!cityName) setCityName('Unknown Location');
      }
    } catch {
      if (isMounted.current) setStatus('location_unavailable');
    }
  }, []);

  useEffect(() => { void requestLocation(); }, [requestLocation]);

  useEffect(() => {
    if (!locationState) return;
    try {
      const today = new Date();
      const times = buildPrayerTimes(locationState.latitude, locationState.longitude, today);
      setPrayerTimes(times);
      setStatus('ready');
    } catch {
      setStatus('api_failed');
    }
  }, [locationState]);

  const prayerItems = useMemo<PrayerTime[]>(() => {
    if (!prayerTimes) return [];
    return [
      { name: 'Fajr', time: prayerTimes.fajr, icon: PRAYER_ICONS.Fajr },
      { name: 'Sunrise', time: prayerTimes.sunrise, icon: PRAYER_ICONS.Sunrise },
      { name: 'Zuhr', time: prayerTimes.dhuhr, icon: PRAYER_ICONS.Zuhr },
      { name: 'Asr', time: prayerTimes.asr, icon: PRAYER_ICONS.Asr },
      { name: 'Maghrib', time: prayerTimes.maghrib, icon: PRAYER_ICONS.Maghrib },
      { name: 'Isha', time: prayerTimes.isha, icon: PRAYER_ICONS.Isha },
    ];
  }, [prayerTimes]);

  const nextPrayer = useMemo<PrayerTime | null>(() => {
    if (!prayerTimes) return null;
    const now = new Date();
    const upcoming = prayerItems.find((p) => p.time.getTime() > now.getTime());
    if (upcoming) return upcoming;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextDayTimes = buildPrayerTimes(locationState?.latitude ?? 0, locationState?.longitude ?? 0, tomorrow);
    return { name: 'Fajr', time: nextDayTimes.fajr, icon: PRAYER_ICONS.Fajr };
  }, [prayerItems, prayerTimes, locationState]);

  // Live countdown timer
  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (!nextPrayer) return;
    const tick = () => {
      const ms = nextPrayer.time.getTime() - Date.now();
      setCountdown(formatCountdown(ms));
    };
    tick();
    countdownRef.current = setInterval(tick, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [nextPrayer]);

  const hijriDate = useMemo(() => toHijriApprox(new Date()), []);
  const gregorianDate = useMemo(() => new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }), []);

  const renderContent = () => {
    if (status === 'loading') {
      return <Text style={styles.message}>Fetching your location and prayer schedule...</Text>;
    }
    if (status === 'denied') {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="location-outline" size={48} color={COLORS.secondary} />
          <Text style={styles.message}>Location permission required for prayer times.</Text>
          <TouchableOpacity style={styles.button} onPress={requestLocation}>
            <Text style={styles.buttonText}>Enable Location</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (status === 'location_unavailable') {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="navigate-outline" size={48} color={COLORS.secondary} />
          <Text style={styles.message}>Unable to determine your location.</Text>
          <TouchableOpacity style={styles.button} onPress={requestLocation}>
            <Text style={styles.buttonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (status === 'api_failed') {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.message}>Unable to load prayer times.</Text>
          <TouchableOpacity style={styles.button} onPress={requestLocation}>
            <Text style={styles.buttonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (!nextPrayer) {
      return <Text style={styles.message}>Unable to compute prayer times at this moment.</Text>;
    }

    return (
      <>
        {/* Date & Location Info */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="location" size={16} color={COLORS.primary} />
            <Text style={styles.infoText}>{cityName || 'Locating...'}</Text>
          </View>
          <View style={styles.dateRow}>
            <Text style={styles.hijriDate}>{hijriDate}</Text>
            <Text style={styles.gregorianDate}>{gregorianDate}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="settings-outline" size={13} color={COLORS.textMuted} />
            <Text style={styles.methodText}>Method: Umm al-Qura</Text>
          </View>
        </View>

        {/* Next Prayer Hero */}
        <View style={styles.heroCard} testID="prayer-times-screen">
          <Text style={styles.heroLabel}>Next Prayer</Text>
          <Text style={styles.heroTitle}>{nextPrayer.name}</Text>
          <Text style={styles.heroSubtitle}>{formatTime(nextPrayer.time)}</Text>
          <View style={styles.countdownBadge}>
            <Ionicons name="timer-outline" size={16} color={COLORS.goldText} />
            <Text style={styles.countdownText}>{countdown}</Text>
          </View>
        </View>

        {/* Prayer List */}
        <View style={styles.list}>
          {prayerItems.map((prayer) => {
            const isNext = prayer.name === nextPrayer.name;
            return (
              <View key={prayer.name} style={[styles.prayerCard, isNext && styles.prayerCardActive]}>
                <View style={[styles.prayerIconCircle, isNext && styles.prayerIconCircleActive]}>
                  <Ionicons name={prayer.icon} size={20} color={isNext ? '#fff' : COLORS.primary} />
                </View>
                <Text style={[styles.prayerName, isNext && styles.prayerNameActive]}>{prayer.name}</Text>
                <Text style={[styles.prayerTime, isNext && styles.prayerTimeActive]}>{formatTime(prayer.time)}</Text>
              </View>
            );
          })}
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
          <Text style={styles.screenTitle}>Prayer Times</Text>
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
  screenTitle: { ...TYPOGRAPHY.title, color: COLORS.text },
  // Info card
  infoCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xl,
    padding: SPACING.md, ...SHADOWS.card, borderWidth: 1, borderColor: COLORS.border,
    gap: 8,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  dateRow: { gap: 2 },
  hijriDate: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  gregorianDate: { fontSize: 13, fontWeight: '500', color: COLORS.textMuted },
  methodText: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
  // Hero
  heroCard: { backgroundColor: COLORS.primary, borderRadius: 28, padding: SPACING.xl, alignItems: 'center', ...SHADOWS.card },
  heroLabel: { color: 'rgba(255,255,255,0.74)', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  heroTitle: { color: '#fff', fontSize: 34, fontWeight: '900', marginTop: 4 },
  heroSubtitle: { color: COLORS.secondary, fontSize: 18, fontWeight: '900', marginTop: 4 },
  countdownBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.goldBg, borderRadius: RADIUS.full,
    paddingHorizontal: 16, paddingVertical: 8, marginTop: 12,
  },
  countdownText: { fontSize: 16, fontWeight: '800', color: COLORS.goldText },
  // Prayer list
  list: { gap: SPACING.sm },
  prayerCard: {
    borderRadius: RADIUS.lg, backgroundColor: COLORS.surface,
    padding: SPACING.md, flexDirection: 'row', alignItems: 'center',
    ...SHADOWS.card, borderWidth: 1, borderColor: COLORS.border, gap: 12,
  },
  prayerCardActive: { backgroundColor: COLORS.goldBg, borderColor: 'rgba(212,175,55,0.35)' },
  prayerIconCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  prayerIconCircleActive: { backgroundColor: COLORS.primary },
  prayerName: { flex: 1, fontSize: 16, fontWeight: '800', color: COLORS.text },
  prayerNameActive: { color: COLORS.primary },
  prayerTime: { fontSize: 15, fontWeight: '700', color: COLORS.textMuted },
  prayerTimeActive: { color: COLORS.primary },
  // States
  message: { color: COLORS.text, fontSize: 16, lineHeight: 24, marginTop: SPACING.lg, textAlign: 'center' },
  errorContainer: { alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, gap: SPACING.sm },
  button: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderRadius: RADIUS.md, marginTop: SPACING.md, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
