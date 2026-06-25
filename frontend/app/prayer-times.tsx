import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { goBackOrReplace } from '@/lib/navigation';
import { ScreenRefreshControl } from "@/components/ui";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import {
  PrayerTime as LibPrayerTime,
  calculatePrayerTimes,
  getPrayerCalculationSettings,
  PRAYER_METHODS,
} from '@/lib/prayerTimes';
import {
  loadPrayerSettings,
  savePrayerSettings,
  subscribeToPrayerSettings,
  PrayerSettings,
  LocationMode,
  DEFAULT_PRAYER_SETTINGS,
} from '@/lib/prayerStorage';

type PrayerDisplayItem = { name: string; time: Date; icon: keyof typeof Ionicons.glyphMap };

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
  
  // Settings & Prayer States
  const [settings, setSettings] = useState<PrayerSettings>(DEFAULT_PRAYER_SETTINGS);
  const [prayerTimes, setPrayerTimes] = useState<LibPrayerTime[] | null>(null);
  const [countdown, setCountdown] = useState<string>('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  // Modals & Forms
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<LocationMode>('auto');
  const [methodOverride, setMethodOverride] = useState<string>('auto');
  
  // Search Inputs
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);

  // Manual Coordinates
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [manualAlt, setManualAlt] = useState('');

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load Settings and Subscribe to updates
  useEffect(() => {
    let active = true;
    const init = async () => {
      const stored = await loadPrayerSettings();
      if (active) {
        setSettings(stored);
        setActiveTab(stored.locationMode);
        setMethodOverride(stored.method);
        setManualLat(stored.latitude.toString());
        setManualLng(stored.longitude.toString());
        setManualAlt((stored.altitude || 0).toString());
      }
    };
    init();

    const unsubscribe = subscribeToPrayerSettings((newSettings) => {
      if (active) {
        setSettings(newSettings);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // Handle GPS Auto Detection
  const handleAutoDetect = async () => {
    setStatus('loading');
    try {
      const { status: gpsStatus } = await Location.requestForegroundPermissionsAsync();
      if (gpsStatus !== 'granted') {
        Alert.alert('Permission Denied', 'GPS location permission is required for Auto-Detection.');
        setStatus('ready');
        return;
      }
      
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude, altitude } = pos.coords;
      
      let city = 'Savanur';
      let state = 'Karnataka';
      let country = 'India';

      try {
        const reverse = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (reverse && reverse.length > 0) {
          const place = reverse[0];
          city = place.city || place.district || place.subregion || 'Unknown City';
          state = place.region || 'Unknown Region';
          country = place.country || 'Unknown Country';
        }
      } catch (e) {
        console.warn('Reverse geocoding failed, using fallbacks');
      }

      const updated: PrayerSettings = {
        locationMode: 'auto',
        latitude,
        longitude,
        altitude: altitude || 0,
        city,
        state,
        country,
        method: methodOverride as any,
      };

      await savePrayerSettings(updated);
      Alert.alert('Location Updated', `Detected: ${city}, ${state}, ${country}`);
    } catch (error) {
      Alert.alert('Error', 'Unable to auto-detect location. Please search or enter manually.');
    } finally {
      setStatus('ready');
    }
  };

  // Handle Search Geocoding
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      Alert.alert('Required', 'Please enter a city or location name.');
      return;
    }
    setSearching(true);
    try {
      const results = await Location.geocodeAsync(searchQuery);
      if (results && results.length > 0) {
        const { latitude, longitude, altitude } = results[0];
        
        let city = searchQuery;
        let state = '';
        let country = '';

        try {
          const reverse = await Location.reverseGeocodeAsync({ latitude, longitude });
          if (reverse && reverse.length > 0) {
            const place = reverse[0];
            city = place.city || place.district || place.subregion || searchQuery;
            state = place.region || '';
            country = place.country || '';
          }
        } catch (e) {
          console.warn('Reverse geocoding failed for search result');
        }

        const updated: PrayerSettings = {
          locationMode: 'search',
          latitude,
          longitude,
          altitude: altitude || 0,
          city,
          state,
          country,
          method: methodOverride as any,
        };

        await savePrayerSettings(updated);
        Alert.alert('Location Found', `Updated to: ${city}, ${state}, ${country}`);
        setSettingsModalVisible(false);
      } else {
        Alert.alert('Not Found', 'Could not resolve that location. Try a different query.');
      }
    } catch (e) {
      Alert.alert('Search Failed', 'An error occurred while geocoding the city.');
    } finally {
      setSearching(false);
    }
  };

  // Handle Manual Save
  const handleManualSave = async () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    const alt = parseFloat(manualAlt) || 0;

    if (isNaN(lat) || lat < -90 || lat > 90) {
      Alert.alert('Invalid Latitude', 'Latitude must be between -90 and 90.');
      return;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      Alert.alert('Invalid Longitude', 'Longitude must be between -180 and 180.');
      return;
    }

    const updated: PrayerSettings = {
      locationMode: 'manual',
      latitude: lat,
      longitude: lng,
      altitude: alt,
      city: `Coord: ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      state: alt > 0 ? `Alt: ${alt}m` : 'Manual Entry',
      country: 'Override',
      method: methodOverride as any,
    };

    await savePrayerSettings(updated);
    Alert.alert('Saved', 'Manual location settings applied.');
    setSettingsModalVisible(false);
  };

  // Save Settings Modal Options
  const handleApplySettingsOnly = async (newMethod: string) => {
    setMethodOverride(newMethod);
    const updated: PrayerSettings = {
      ...settings,
      method: newMethod as any,
    };
    await savePrayerSettings(updated);
  };

  // Calculate Prayer Times
  useEffect(() => {
    try {
      const today = new Date();
      
      // Determine settings method
      let calcSettings = PRAYER_METHODS.muslimWorldLeague;
      if (settings.method === 'auto') {
        calcSettings = getPrayerCalculationSettings(settings.country);
      } else if (PRAYER_METHODS[settings.method]) {
        calcSettings = PRAYER_METHODS[settings.method];
      }

      const times = calculatePrayerTimes(
        today,
        settings.latitude,
        settings.longitude,
        calcSettings,
        settings.altitude
      );
      setPrayerTimes(times);
      setStatus('ready');
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  }, [settings]);

  // Derive Display Items
  const prayerItems = useMemo<PrayerDisplayItem[]>(() => {
    if (!prayerTimes) return [];
    const getLibTime = (name: string) => prayerTimes.find(p => p.name === name)?.time || new Date();
    
    return [
      { name: 'Fajr', time: getLibTime('Fajr'), icon: PRAYER_ICONS.Fajr },
      { name: 'Sunrise', time: getLibTime('Sunrise'), icon: PRAYER_ICONS.Sunrise },
      { name: 'Zuhr', time: getLibTime('Zuhr'), icon: PRAYER_ICONS.Zuhr },
      { name: 'Asr', time: getLibTime('Asr'), icon: PRAYER_ICONS.Asr },
      { name: 'Maghrib', time: getLibTime('Maghrib'), icon: PRAYER_ICONS.Maghrib },
      { name: 'Isha', time: getLibTime('Isha'), icon: PRAYER_ICONS.Isha },
    ];
  }, [prayerTimes]);

  // Derive Next Prayer
  const nextPrayer = useMemo<PrayerDisplayItem | null>(() => {
    if (!prayerTimes) return null;
    const now = new Date();
    const upcoming = prayerItems.find((p) => p.time.getTime() > now.getTime());
    if (upcoming) return upcoming;
    
    // Fallback to tomorrow Fajr
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    let calcSettings = PRAYER_METHODS.muslimWorldLeague;
    if (settings.method === 'auto') {
      calcSettings = getPrayerCalculationSettings(settings.country);
    } else if (PRAYER_METHODS[settings.method]) {
      calcSettings = PRAYER_METHODS[settings.method];
    }

    const nextDayTimes = calculatePrayerTimes(
      tomorrow,
      settings.latitude,
      settings.longitude,
      calcSettings,
      settings.altitude
    );
    const nextDayFajr = nextDayTimes.find(p => p.name === 'Fajr')?.time || new Date();
    return { name: 'Fajr', time: nextDayFajr, icon: PRAYER_ICONS.Fajr };
  }, [prayerItems, prayerTimes, settings]);

  // Countdown timer
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

  const hijriDate = useMemo(() => toHijriApprox(new Date()), [prayerTimes]);
  const gregorianDate = useMemo(() => new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }), []);

  const currentMethodName = useMemo(() => {
    if (settings.method === 'auto') {
      const derived = getPrayerCalculationSettings(settings.country);
      return `${derived.method} (Auto)`;
    }
    return PRAYER_METHODS[settings.method]?.method || 'Custom';
  }, [settings]);

  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    await handleAutoDetect();
  });

  return (
    <ScrollView 
      refreshControl={<ScreenRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      style={styles.screen} 
      contentContainerStyle={[styles.content, { paddingTop: insets.top + SPACING.md }]}
    >
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => goBackOrReplace(router, '/more')} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Applications</Text>
          <Text style={styles.screenTitle}>Prayer Times</Text>
        </View>
        <TouchableOpacity style={styles.settingsButton} onPress={() => setSettingsModalVisible(true)}>
          <Ionicons name="options-outline" size={22} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {status === 'loading' ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.message}>Calculating prayer times...</Text>
        </View>
      ) : status === 'error' ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.error || '#EF4444'} />
          <Text style={styles.message}>An error occurred while calculating prayer times.</Text>
          <TouchableOpacity style={styles.button} onPress={() => setSettings(DEFAULT_PRAYER_SETTINGS)}>
            <Text style={styles.buttonText}>Reset Settings</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Date & Location Info */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="location" size={16} color={COLORS.primary} />
              <Text style={styles.infoText}>{settings.city || 'Locating...'}</Text>
            </View>
            <View style={styles.dateRow}>
              <Text style={styles.hijriDate}>{hijriDate}</Text>
              <Text style={styles.gregorianDate}>{gregorianDate}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="settings-outline" size={13} color={COLORS.textMuted} />
              <Text style={styles.methodText} numberOfLines={1}>Method: {currentMethodName}</Text>
            </View>
            {settings.altitude ? (
              <View style={styles.infoRow}>
                <Ionicons name="trending-up-outline" size={13} color={COLORS.textMuted} />
                <Text style={styles.methodText}>Elevation: {settings.altitude} meters</Text>
              </View>
            ) : null}
          </View>

          {/* Next Prayer Hero */}
          {nextPrayer ? (
            <View style={styles.heroCard} testID="prayer-times-screen">
              <Text style={styles.heroLabel}>Next Prayer</Text>
              <Text style={styles.heroTitle}>{nextPrayer.name}</Text>
              <Text style={styles.heroSubtitle}>{formatTime(nextPrayer.time)}</Text>
              <View style={styles.countdownBadge}>
                <Ionicons name="timer-outline" size={16} color={COLORS.goldText} />
                <Text style={styles.countdownText}>{countdown}</Text>
              </View>
            </View>
          ) : null}

          {/* Prayer List */}
          <View style={styles.list}>
            {prayerItems.map((prayer) => {
              const isNext = nextPrayer && prayer.name === nextPrayer.name;
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
      )}

      {/* Settings Modal */}
      <Modal
        visible={settingsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSettingsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Prayer Settings</Text>
              <TouchableOpacity onPress={() => setSettingsModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalContent}>
              {/* Method Override Selection */}
              <Text style={styles.sectionLabel}>Calculation Method</Text>
              <View style={styles.methodSelector}>
                {(['auto', 'muslimWorldLeague', 'egyptian', 'karachi', 'ummAlQura', 'northAmerica'] as const).map((methodKey) => {
                  const label = methodKey === 'auto' ? 'Automatic (Based on Country)' : (PRAYER_METHODS[methodKey]?.method || methodKey);
                  const isSelected = methodOverride === methodKey;
                
  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    await handleAutoDetect();
  });
  return (
                    <TouchableOpacity
                      key={methodKey}
                      style={[styles.methodItem, isSelected && styles.methodItemActive]}
                      onPress={() => handleApplySettingsOnly(methodKey)}
                    >
                      <Text style={[styles.methodItemText, isSelected && styles.methodItemTextActive]}>
                        {label}
                      </Text>
                      {isSelected && <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Location Mode Tabs */}
              <Text style={styles.sectionLabel}>Location Settings</Text>
              <View style={styles.tabBar}>
                {(['auto', 'search', 'manual'] as const).map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    style={[styles.tabButton, activeTab === mode && styles.tabButtonActive]}
                    onPress={() => setActiveTab(mode)}
                  >
                    <Text style={[styles.tabButtonText, activeTab === mode && styles.tabButtonTextActive]}>
                      {mode.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Tab Contents */}
              {activeTab === 'auto' && (
                <View style={styles.tabContent}>
                  <Text style={styles.tabHelpText}>
                    Automatically fetch your coordinates using your device's GPS and resolve the city name.
                  </Text>
                  <TouchableOpacity style={styles.actionButton} onPress={handleAutoDetect}>
                    <Ionicons name="location-outline" size={18} color="#fff" />
                    <Text style={styles.actionButtonText}>Detect My Location</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionButton, { marginTop: 12, backgroundColor: COLORS.surfaceAlt }]} onPress={async () => { await savePrayerSettings(DEFAULT_PRAYER_SETTINGS); setSettingsModalVisible(false); Alert.alert('Reset', 'Restored to Auto Location defaults.'); }}>
                    <Ionicons name="refresh" size={18} color={COLORS.primary} />
                    <Text style={[styles.actionButtonText, { color: COLORS.primary }]}>Reset To Auto Location</Text>
                  </TouchableOpacity>
                </View>
              )}

              {activeTab === 'search' && (
                <View style={styles.tabContent}>
                  <Text style={styles.tabHelpText}>
                    Search for cities worldwide to get coordinates and automatic prayer timings.
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter city name (e.g. Savanur, Makkah)"
                    placeholderTextColor={COLORS.textMuted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  <TouchableOpacity style={styles.actionButton} onPress={handleSearch} disabled={searching}>
                    {searching ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="search" size={18} color="#fff" />
                        <Text style={styles.actionButtonText}>Search Location</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {activeTab === 'manual' && (
                <View style={styles.tabContent}>
                  <Text style={styles.tabHelpText}>
                    Directly enter geographic coordinates for precise offline adjustments.
                  </Text>
                  <View style={styles.formRow}>
                    <View style={styles.formField}>
                      <Text style={styles.fieldLabel}>Latitude</Text>
                      <TextInput
                        style={styles.textInput}
                        keyboardType="numeric"
                        placeholder="e.g. 14.97"
                        placeholderTextColor={COLORS.textMuted}
                        value={manualLat}
                        onChangeText={setManualLat}
                      />
                    </View>
                    <View style={styles.formField}>
                      <Text style={styles.fieldLabel}>Longitude</Text>
                      <TextInput
                        style={styles.textInput}
                        keyboardType="numeric"
                        placeholder="e.g. 75.34"
                        placeholderTextColor={COLORS.textMuted}
                        value={manualLng}
                        onChangeText={setManualLng}
                      />
                    </View>
                  </View>
                  <View style={styles.formRow}>
                    <View style={styles.formField}>
                      <Text style={styles.fieldLabel}>Altitude / Elevation (meters)</Text>
                      <TextInput
                        style={styles.textInput}
                        keyboardType="numeric"
                        placeholder="e.g. 600"
                        placeholderTextColor={COLORS.textMuted}
                        value={manualAlt}
                        onChangeText={setManualAlt}
                      />
                    </View>
                  </View>
                  <TouchableOpacity style={styles.actionButton} onPress={handleManualSave}>
                    <Ionicons name="checkmark" size={18} color="#fff" />
                    <Text style={styles.actionButtonText}>Save Coordinates</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  settingsButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
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
  methodText: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted, flex: 1 },
  
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
  
  // Loading & Error States
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, gap: 12 },
  message: { color: COLORS.text, fontSize: 16, lineHeight: 24, marginTop: SPACING.lg, textAlign: 'center' },
  errorContainer: { alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, gap: SPACING.sm },
  button: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderRadius: RADIUS.md, marginTop: SPACING.md, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Modals & Forms Styling
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingTop: SPACING.md,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: {
    ...TYPOGRAPHY.title,
    fontSize: 20,
    color: COLORS.text,
  },
  modalContent: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  methodSelector: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  methodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  methodItemActive: {
    backgroundColor: COLORS.surfaceAlt,
  },
  methodItemText: {
    fontSize: 14,
    color: COLORS.text,
  },
  methodItemTextActive: {
    fontWeight: '700',
    color: COLORS.primary,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.md,
    padding: 2,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: RADIUS.sm,
  },
  tabButtonActive: {
    backgroundColor: COLORS.surface,
    ...SHADOWS.card,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  tabButtonTextActive: {
    color: COLORS.primary,
  },
  tabContent: {
    padding: SPACING.xs,
    gap: SPACING.sm,
  },
  tabHelpText: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
  textInput: {
    height: 48,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
  },
  actionButton: {
    height: 48,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  formRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  formField: {
    flex: 1,
    gap: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
});
