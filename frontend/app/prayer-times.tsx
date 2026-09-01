import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { goBackOrReplace } from '@/lib/navigation';
import { ScreenRefreshControl } from "@/components/ui";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
  Modal, TextInput, Alert, ActivityIndicator, Platform,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import {
  PrayerTime as LibPrayerTime,
  calculatePrayerTimes,
  getPrayerCalculationSettings,
  PRAYER_METHODS,
  getSunProgressPercent,
  getMakruhWindows,
  calculateMoonPhase,
  getHijriDate,
  getMonthlyPrayerTimes,
  MoonPhaseInfo,
  DailyPrayerRow,
} from '@/lib/prayerTimes';
import {
  loadPrayerSettings,
  savePrayerSettings,
  subscribeToPrayerSettings,
  PrayerSettings,
  LocationMode,
  DEFAULT_PRAYER_SETTINGS,
  loadQazaRecord,
  saveQazaRecord,
  QazaRecord,
  DEFAULT_QAZA_RECORD,
} from '@/lib/prayerStorage';

const SCREEN_WIDTH = Dimensions.get('window').width;

const KIND_COLORS = {
  fard: { bg: '#E8F5EE', text: '#005F46', badge: '#005F46' },
  sun: { bg: '#FFF7ED', text: '#C2410C', badge: '#EA580C' },
  nafl: { bg: '#EEF2FF', text: '#4F46E5', badge: '#6366F1' },
  marker: { bg: '#F8FAFC', text: '#475569', badge: '#64748B' },
  makruh: { bg: '#FEF2F2', text: '#B91C1C', badge: '#DC2626' },
};

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

type ActiveTab = 'today' | 'monthly' | 'moon' | 'qaza';

export default function PrayerTimesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [settings, setSettings] = useState<PrayerSettings>(DEFAULT_PRAYER_SETTINGS);
  const [prayerTimes, setPrayerTimes] = useState<LibPrayerTime[] | null>(null);
  const [countdown, setCountdown] = useState<string>('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [activeTab, setActiveTab] = useState<ActiveTab>('today');
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [locationTab, setLocationTab] = useState<LocationMode>('auto');
  const [methodOverride, setMethodOverride] = useState<string>('auto');
  const [shafaqType, setShafaqType] = useState<'ahmar' | 'abyad'>('abyad');
  const [asrFactor, setAsrFactor] = useState<1 | 2>(2);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [manualAlt, setManualAlt] = useState('');
  const [monthlyRows, setMonthlyRows] = useState<DailyPrayerRow[]>([]);
  const [moonInfo, setMoonInfo] = useState<MoonPhaseInfo | null>(null);
  const [qaza, setQaza] = useState<QazaRecord>(DEFAULT_QAZA_RECORD);
  const [now, setNow] = useState(new Date());
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let active = true;
    const init = async () => {
      const stored = await loadPrayerSettings();
      const qazaStored = await loadQazaRecord();
      if (active) {
        setSettings(stored);
        setLocationTab(stored.locationMode);
        setMethodOverride(stored.method);
        setShafaqType(stored.shafaqType || 'abyad');
        setAsrFactor(stored.asrFactor || 2);
        setManualLat(stored.latitude.toString());
        setManualLng(stored.longitude.toString());
        setManualAlt((stored.altitude || 0).toString());
        setQaza(qazaStored);
      }
    };
    init();
    const unsubscribe = subscribeToPrayerSettings((newSettings) => {
      if (active) setSettings(newSettings);
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  const handleAutoDetect = useCallback(async () => {
    setStatus('loading');
    try {
      const { status: gpsStatus } = await Location.requestForegroundPermissionsAsync();
      if (gpsStatus !== 'granted') { Alert.alert('GPS Denied', 'Permission required.'); setStatus('ready'); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude, altitude } = pos.coords;
      let city = 'Unknown'; let state = ''; let country = '';
      try {
        const rev = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (rev && rev.length > 0) { const p = rev[0]; city = p.city || p.district || 'Unknown'; state = p.region || ''; country = p.country || ''; }
      } catch { /* ignore */ }
      const updated: PrayerSettings = { ...settings, locationMode: 'auto', latitude, longitude, altitude: altitude || 0, city, state, country, method: methodOverride as any, shafaqType, asrFactor };
      await savePrayerSettings(updated);
      Alert.alert('Location Updated', `${city}, ${country}`);
    } catch { Alert.alert('Error', 'Unable to detect location.'); }
    finally { setStatus('ready'); }
  }, [settings, methodOverride, shafaqType, asrFactor]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) { Alert.alert('Required', 'Enter a city name.'); return; }
    setSearching(true);
    try {
      const results = await Location.geocodeAsync(searchQuery);
      if (results && results.length > 0) {
        const { latitude, longitude, altitude } = results[0];
        let city = searchQuery; let state = ''; let country = '';
        try { const rev = await Location.reverseGeocodeAsync({ latitude, longitude }); if (rev && rev.length > 0) { const p = rev[0]; city = p.city || p.district || searchQuery; state = p.region || ''; country = p.country || ''; } } catch { /* ignore */ }
        await savePrayerSettings({ ...settings, locationMode: 'search', latitude, longitude, altitude: altitude || 0, city, state, country, method: methodOverride as any, shafaqType, asrFactor });
        Alert.alert('Location Found', `${city}, ${country}`);
        setSettingsModalVisible(false);
      } else { Alert.alert('Not Found', 'Try a different city name.'); }
    } catch { Alert.alert('Search Failed', 'An error occurred.'); }
    finally { setSearching(false); }
  };

  const handleManualSave = async () => {
    const lat = parseFloat(manualLat); const lng = parseFloat(manualLng); const alt = parseFloat(manualAlt) || 0;
    if (isNaN(lat) || lat < -90 || lat > 90) { Alert.alert('Invalid Latitude', 'Must be -90 to 90.'); return; }
    if (isNaN(lng) || lng < -180 || lng > 180) { Alert.alert('Invalid Longitude', 'Must be -180 to 180.'); return; }
    await savePrayerSettings({ ...settings, locationMode: 'manual', latitude: lat, longitude: lng, altitude: alt, city: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, state: alt > 0 ? `Alt: ${alt}m` : 'Manual', country: 'Override', method: methodOverride as any, shafaqType, asrFactor });
    Alert.alert('Saved', 'Manual coordinates applied.');
    setSettingsModalVisible(false);
  };

  const handleApplyCalcSettings = async (newMethod?: string, newShafaq?: 'ahmar' | 'abyad', newAsr?: 1 | 2) => {
    const m = newMethod ?? methodOverride; const s = newShafaq ?? shafaqType; const a = newAsr ?? asrFactor;
    if (newMethod) setMethodOverride(m);
    if (newShafaq) setShafaqType(s);
    if (newAsr) setAsrFactor(a);
    await savePrayerSettings({ ...settings, method: m as any, shafaqType: s, asrFactor: a });
  };

  const calcSettings = useMemo(() => {
    let base = PRAYER_METHODS.muslimWorldLeague;
    if (settings.method === 'auto') { base = getPrayerCalculationSettings(settings.country); }
    else if (PRAYER_METHODS[settings.method]) { base = PRAYER_METHODS[settings.method]; }
    return { ...base, asrFactor: settings.asrFactor || asrFactor, shafaqType: settings.shafaqType || shafaqType };
  }, [settings, asrFactor, shafaqType]);

  useEffect(() => {
    try {
      const today = new Date();
      const times = calculatePrayerTimes(today, settings.latitude, settings.longitude, calcSettings, settings.altitude);
      setPrayerTimes(times);
      setMoonInfo(calculateMoonPhase(today));
      setStatus('ready');
    } catch (err) { console.error(err); setStatus('error'); }
  }, [settings, calcSettings]);

  useEffect(() => {
    if (activeTab === 'monthly') {
      const today = new Date();
      setMonthlyRows(getMonthlyPrayerTimes(today.getFullYear(), today.getMonth(), settings.latitude, settings.longitude, calcSettings, settings.altitude));
    }
  }, [activeTab, settings, calcSettings]);

  const nextPrayer = useMemo(() => {
    if (!prayerTimes) return null;
    const fard = prayerTimes.filter((p) => p.kind === 'fard');
    return fard.find((p) => p.time.getTime() > now.getTime()) || fard[0] || null;
  }, [prayerTimes, now]);

  useEffect(() => {
    if (!nextPrayer) return;
    const tick = () => { const ms = nextPrayer.time.getTime() - Date.now(); setCountdown(formatCountdown(ms)); };
    tick();
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(tick, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [nextPrayer]);

  const sunPercent = useMemo(() => {
    if (!prayerTimes) return 0;
    const fajr = prayerTimes.find((p) => p.name === 'Fajr')?.time;
    const isha = prayerTimes.find((p) => p.name === 'Isha')?.time;
    if (!fajr || !isha) return 0;
    return getSunProgressPercent(now, fajr, isha);
  }, [prayerTimes, now]);

  const makruhWindows = useMemo(() => {
    if (!prayerTimes) return [];
    const sunrise = prayerTimes.find((p) => p.name === 'Sunrise')?.time;
    const sunset = prayerTimes.find((p) => p.name === 'Maghrib')?.time;
    const zawal = prayerTimes.find((p) => p.name === 'Zawal')?.time;
    if (!sunrise || !sunset || !zawal) return [];
    return getMakruhWindows(sunrise, sunset, zawal);
  }, [prayerTimes]);

  const isCurrentlyMakruh = useMemo(() => makruhWindows.some((w) => now >= w.start && now <= w.end), [makruhWindows, now]);

  const hijriDate = useMemo(() => {
    const maghrib = prayerTimes?.find((p) => p.name === 'Maghrib')?.time;
    return getHijriDate(now, maghrib);
  }, [prayerTimes, now]);

  const gregorianDate = useMemo(() => now.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }), [now]);

  const currentMethodName = useMemo(() => {
    if (settings.method === 'auto') { const d = getPrayerCalculationSettings(settings.country); return `${d.method} (Auto)`; }
    return PRAYER_METHODS[settings.method]?.method || 'Custom';
  }, [settings]);

  const { refreshing, onRefresh } = usePullToRefresh(async () => { await handleAutoDetect(); });

  const handleQazaChange = async (key: keyof QazaRecord, delta: number) => {
    const updated = { ...qaza, [key]: Math.max(0, (qaza[key] || 0) + delta) };
    setQaza(updated);
    await saveQazaRecord(updated);
  };

  const qazaTotal = Object.values(qaza).reduce((a, b) => a + b, 0);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => goBackOrReplace(router, '/more')} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>اَوْقَاتِ نَمَاز</Text>
          <Text style={styles.headerSubtitle}>Prayer Times (Tauqeet-Level)</Text>
        </View>
        <TouchableOpacity style={styles.headerBtn} onPress={() => setSettingsModalVisible(true)}>
          <Ionicons name="settings-outline" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        {[
          { id: 'today', label: 'آج', icon: 'sunny-outline' },
          { id: 'monthly', label: 'ماہانہ', icon: 'calendar-outline' },
          { id: 'moon', label: 'چاند', icon: 'moon-outline' },
          { id: 'qaza', label: 'قضاء', icon: 'time-outline' },
        ].map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <TouchableOpacity key={tab.id} style={[styles.tabBtn, isSelected && styles.tabBtnSelected]} onPress={() => setActiveTab(tab.id as ActiveTab)} activeOpacity={0.8}>
              <Ionicons name={tab.icon as any} size={14} color={isSelected ? '#002E23' : '#94A3B8'} />
              <Text style={[styles.tabBtnText, isSelected && styles.tabBtnTextSelected]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView refreshControl={<ScreenRefreshControl refreshing={refreshing} onRefresh={onRefresh} />} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        {status === 'loading' ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#C8A84E" />
            <Text style={styles.loadingText}>اوقات حساب ہو رہے ہیں...</Text>
          </View>
        ) : status === 'error' ? (
          <View style={styles.loadingBox}>
            <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
            <Text style={styles.loadingText}>حساب میں خرابی آ گئی۔</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => setSettings(DEFAULT_PRAYER_SETTINGS)}>
              <Text style={styles.retryBtnText}>دوبارہ کوشش کریں</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {activeTab === 'today' && (
              <>
                <View style={styles.dateCard}>
                  <View style={styles.dateCardRow}>
                    <Ionicons name="location" size={14} color="#C8A84E" />
                    <Text style={styles.locationText} numberOfLines={1}>{settings.city}{settings.state ? `, ${settings.state}` : ''}</Text>
                    <Text style={styles.coordText}>({settings.latitude.toFixed(2)}, {settings.longitude.toFixed(2)})</Text>
                  </View>
                  <Text style={styles.hijriDateText}>{hijriDate}</Text>
                  <Text style={styles.gregorianDateText}>{gregorianDate}</Text>
                  <View style={styles.methodRow}>
                    <Ionicons name="settings-outline" size={11} color="#94A3B8" />
                    <Text style={styles.methodText} numberOfLines={1}>
                      {currentMethodName} | {(settings.asrFactor || 2) === 2 ? 'Hanafi Asr' : 'Shafi Asr'} | Isha: {(settings.shafaqType || 'abyad') === 'abyad' ? 'Shafaq Abyad 18' : 'Shafaq Ahmar 12'}
                    </Text>
                  </View>
                </View>

                <View style={styles.sunArcCard}>
                  <View style={styles.arcTrack}>
                    <View style={[styles.arcFill, { width: (sunPercent + '%') as any }]} />
                    <View style={[styles.sunDot, { left: (Math.min(94, sunPercent) + '%') as any }]}>
                      <Text style={styles.sunEmoji}>☀️</Text>
                    </View>
                  </View>
                  <View style={styles.arcLabels}>
                    <Text style={styles.arcLabel}>Fajr{'\n'}{prayerTimes?.find(p => p.name === 'Fajr')?.label}</Text>
                    <Text style={styles.arcLabel}>Zawal{'\n'}{prayerTimes?.find(p => p.name === 'Zawal')?.label}</Text>
                    <Text style={styles.arcLabel}>Isha{'\n'}{prayerTimes?.find(p => p.name === 'Isha')?.label}</Text>
                  </View>
                  <View style={styles.keyTimesRow}>
                    {[{ label: 'فجر', name: 'Fajr', emoji: '🌙' }, { label: 'طلوع', name: 'Sunrise', emoji: '🌅' }, { label: 'مغرب', name: 'Maghrib', emoji: '🌇' }, { label: 'عشاء', name: 'Isha', emoji: '🌙' }].map((item) => {
                      const p = prayerTimes?.find((t) => t.name === item.name);
                      return (
                        <View key={item.name} style={styles.keyTimeItem}>
                          <Text style={styles.keyTimeEmoji}>{item.emoji}</Text>
                          <Text style={styles.keyTimeLabel}>{item.label}</Text>
                          <Text style={styles.keyTimeValue}>{p ? formatTime(p.time) : '--'}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>

                {nextPrayer && (
                  <View style={[styles.nextPrayerCard, isCurrentlyMakruh && styles.makruhWarningCard]}>
                    {isCurrentlyMakruh ? (
                      <>
                        <Ionicons name="warning" size={22} color="#DC2626" />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.nextLabel, { color: '#DC2626' }]}>مکروہ وقت جاری ہے</Text>
                          <Text style={[styles.nextName, { color: '#B91C1C', fontSize: 13 }]}>ابھی نماز نہ پڑھیں — مکروہ تحریمی</Text>
                        </View>
                      </>
                    ) : (
                      <>
                        <View>
                          <Text style={styles.nextLabel}>اگلی نماز</Text>
                          <Text style={styles.nextName}>{nextPrayer.urduName || nextPrayer.name}</Text>
                          <Text style={styles.nextTime}>{formatTime(nextPrayer.time)}</Text>
                        </View>
                        <View style={styles.countdownBox}>
                          <Ionicons name="timer-outline" size={16} color="#C8A84E" />
                          <Text style={styles.countdownText}>{countdown}</Text>
                        </View>
                      </>
                    )}
                  </View>
                )}

                <View style={styles.prayerList}>
                  {(prayerTimes || []).map((prayer) => {
                    const isNext = nextPrayer?.name === prayer.name;
                    const colors = KIND_COLORS[prayer.kind] || KIND_COLORS.marker;
                    return (
                      <View key={prayer.name} style={[styles.prayerRow, isNext && styles.prayerRowNext, prayer.isMakruh && styles.prayerRowMakruh]}>
                        <View style={[styles.kindDot, { backgroundColor: colors.badge }]} />
                        <View style={{ flex: 1 }}>
                          <View style={styles.prayerNameRow}>
                            <Text style={[styles.prayerUrdu, isNext && { color: '#005F46' }]}>{prayer.urduName}</Text>
                            <View style={[styles.kindBadge, { backgroundColor: colors.bg }]}>
                              <Text style={[styles.kindBadgeText, { color: colors.text }]}>
                                {prayer.kind === 'fard' ? 'فرض' : prayer.kind === 'nafl' ? 'نفل' : prayer.kind === 'sun' ? 'طلوع' : prayer.kind === 'makruh' ? 'مکروہ' : 'علامت'}
                              </Text>
                            </View>
                          </View>
                          {prayer.makruhNote && <Text style={styles.makruhNote}>{prayer.makruhNote}</Text>}
                        </View>
                        <Text style={[styles.prayerTime, isNext && { color: '#005F46', fontWeight: '900' }]}>{prayer.label}</Text>
                        {isNext && <View style={styles.nextArrow}><Ionicons name="arrow-back" size={12} color="#005F46" /></View>}
                      </View>
                    );
                  })}
                </View>

                <View style={styles.makruhCard}>
                  <View style={styles.makruhCardHeader}>
                    <Ionicons name="warning-outline" size={16} color="#DC2626" />
                    <Text style={styles.makruhCardTitle}>مکروہ اوقات (3 Makruh Windows)</Text>
                  </View>
                  {makruhWindows.map((w, idx) => (
                    <View key={idx} style={styles.makruhRow}>
                      <Text style={styles.makruhRowLabel}>{w.urduLabel}</Text>
                      <Text style={styles.makruhRowTime}>{formatTime(w.start)} — {formatTime(w.end)}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {activeTab === 'monthly' && (
              <View style={styles.monthlySection}>
                <Text style={styles.sectionTitle}>{new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })} — اوقاتِ نماز</Text>
                <View style={[styles.monthRow, styles.monthHeaderRow]}>
                  <Text style={[styles.monthCell, styles.monthHeaderCell, { flex: 1.4 }]}>تاریخ</Text>
                  <Text style={[styles.monthCell, styles.monthHeaderCell]}>فجر</Text>
                  <Text style={[styles.monthCell, styles.monthHeaderCell]}>ظہر</Text>
                  <Text style={[styles.monthCell, styles.monthHeaderCell]}>عصر</Text>
                  <Text style={[styles.monthCell, styles.monthHeaderCell]}>مغرب</Text>
                  <Text style={[styles.monthCell, styles.monthHeaderCell]}>عشاء</Text>
                </View>
                {monthlyRows.map((row, idx) => {
                  const isToday = row.date.toDateString() === new Date().toDateString();
                  return (
                    <View key={idx} style={[styles.monthRow, isToday && styles.monthRowToday]}>
                      <View style={[styles.monthCell, { flex: 1.4, alignItems: 'flex-start' }]}>
                        <Text style={[styles.monthDateText, isToday && { color: '#C8A84E', fontWeight: '900' }]}>{row.dateStr}</Text>
                        {row.hijriDay > 0 && <Text style={styles.monthHijriText}>{row.hijriDay} ہج</Text>}
                      </View>
                      <Text style={[styles.monthCell, styles.monthTimeText]}>{row.fajr}</Text>
                      <Text style={[styles.monthCell, styles.monthTimeText]}>{row.zuhr}</Text>
                      <Text style={[styles.monthCell, styles.monthTimeText]}>{row.asr}</Text>
                      <Text style={[styles.monthCell, styles.monthTimeText]}>{row.maghrib}</Text>
                      <Text style={[styles.monthCell, styles.monthTimeText]}>{row.isha}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {activeTab === 'moon' && moonInfo && (
              <View style={styles.moonSection}>
                <View style={styles.moonHeroCard}>
                  <Text style={styles.moonEmoji}>{moonInfo.emoji}</Text>
                  <Text style={styles.moonPhaseName}>{moonInfo.urduPhaseName}</Text>
                  <Text style={styles.moonPhaseNameEn}>{moonInfo.phaseName}</Text>
                  <View style={styles.moonIlluminationBar}>
                    <View style={[styles.moonIlluminationFill, { width: (Math.round(moonInfo.illumination * 100) + '%') as any }]} />
                  </View>
                  <Text style={styles.moonIlluminationText}>روشنی: {Math.round(moonInfo.illumination * 100)}٪</Text>
                </View>
                <View style={styles.moonStatsGrid}>
                  <View style={styles.moonStatCard}><Text style={styles.moonStatNum}>{moonInfo.phase}</Text><Text style={styles.moonStatLabel}>ہلالی دن</Text></View>
                  <View style={styles.moonStatCard}><Text style={styles.moonStatNum}>{moonInfo.daysToFullMoon}</Text><Text style={styles.moonStatLabel}>بدر میں دن</Text></View>
                  <View style={styles.moonStatCard}><Text style={styles.moonStatNum}>{moonInfo.daysToNewMoon}</Text><Text style={styles.moonStatLabel}>نئے چاند میں</Text></View>
                </View>
                <View style={styles.hijriCard}>
                  <Text style={styles.hijriLabel}>آج کی اسلامی تاریخ (مغرب کے بعد نئی تاریخ شروع):</Text>
                  <Text style={styles.hijriValue}>{hijriDate}</Text>
                </View>
                <View style={styles.lunarMonthCard}>
                  <Text style={styles.lunarMonthTitle}>اسلامی مہینوں کی ترتیب</Text>
                  {['محرم الحرام', 'صفر المظفر', 'ربیع الاول', 'ربیع الثانی', 'جمادی الاولی', 'جمادی الثانیہ', 'رجب المرجب', 'شعبان المعظم', 'رمضان المبارک', 'شوال المکرم', 'ذوالقعدہ', 'ذوالحجہ'].map((m, idx) => (
                    <Text key={idx} style={styles.lunarMonthItem}>{idx + 1}. {m}</Text>
                  ))}
                </View>
              </View>
            )}

            {activeTab === 'qaza' && (
              <View style={styles.qazaSection}>
                <View style={styles.qazaTotalCard}>
                  <Ionicons name="time" size={24} color="#C8A84E" />
                  <View><Text style={styles.qazaTotalNum}>{qazaTotal}</Text><Text style={styles.qazaTotalLabel}>کل قضاء نمازیں باقی</Text></View>
                </View>
                {([{ key: 'fajr' as const, label: 'فجر', icon: 'moon-outline' }, { key: 'zuhr' as const, label: 'ظہر', icon: 'sunny' }, { key: 'asr' as const, label: 'عصر', icon: 'partly-sunny-outline' }, { key: 'maghrib' as const, label: 'مغرب', icon: 'cloudy-night-outline' }, { key: 'isha' as const, label: 'عشاء', icon: 'moon' }]).map((item) => (
                  <View key={item.key} style={styles.qazaRow}>
                    <View style={styles.qazaRowLeft}>
                      <Ionicons name={item.icon as any} size={20} color="#005F46" />
                      <Text style={styles.qazaRowLabel}>{item.label}</Text>
                    </View>
                    <View style={styles.qazaCounter}>
                      <TouchableOpacity style={styles.qazaBtn} onPress={() => handleQazaChange(item.key, -1)} activeOpacity={0.8}>
                        <Ionicons name="remove" size={18} color="#DC2626" />
                      </TouchableOpacity>
                      <Text style={styles.qazaCount}>{qaza[item.key]}</Text>
                      <TouchableOpacity style={styles.qazaBtn} onPress={() => handleQazaChange(item.key, 1)} activeOpacity={0.8}>
                        <Ionicons name="add" size={18} color="#005F46" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                <View style={styles.qazaInfoCard}>
                  <Ionicons name="information-circle-outline" size={16} color="#005F46" />
                  <Text style={styles.qazaInfoText}>قضاء نماز کا ادا کرنا واجب ہے۔ ہر نماز کے بعد ایک قضاء ادا کریں اور (-) سے کم کریں۔ یہ ڈیٹا صرف آپ کے فون میں محفوظ ہے۔</Text>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={settingsModalVisible} animationType="slide" transparent onRequestClose={() => setSettingsModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>اوقاتِ نماز کی ترتیب</Text>
              <TouchableOpacity onPress={() => setSettingsModalVisible(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color="#334155" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ gap: 12, padding: SPACING.lg }} showsVerticalScrollIndicator={false}>
              <Text style={styles.settingsLabel}>حساب کا طریقہ</Text>
              {(['auto', 'muslimWorldLeague', 'egyptian', 'karachi', 'ummAlQura', 'northAmerica'] as const).map((key) => {
                const label = key === 'auto' ? 'خودکار (ملک کے مطابق)' : (PRAYER_METHODS[key]?.method || key);
                const isSelected = methodOverride === key;
                return (
                  <TouchableOpacity key={key} style={[styles.settingsItem, isSelected && styles.settingsItemActive]} onPress={() => handleApplyCalcSettings(key)}>
                    <Text style={[styles.settingsItemText, isSelected && { color: '#005F46', fontWeight: '800' }]}>{label}</Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={18} color="#005F46" />}
                  </TouchableOpacity>
                );
              })}
              <Text style={styles.settingsLabel}>عصر کا وقت</Text>
              {[{ val: 2 as const, label: 'حنفی — مثلین (Hanafi)' }, { val: 1 as const, label: 'شافعی / جمہور — مثلِ اول' }].map((opt) => (
                <TouchableOpacity key={opt.val} style={[styles.settingsItem, asrFactor === opt.val && styles.settingsItemActive]} onPress={() => handleApplyCalcSettings(undefined, undefined, opt.val)}>
                  <Text style={[styles.settingsItemText, asrFactor === opt.val && { color: '#005F46', fontWeight: '800' }]}>{opt.label}</Text>
                  {asrFactor === opt.val && <Ionicons name="checkmark-circle" size={18} color="#005F46" />}
                </TouchableOpacity>
              ))}
              <Text style={styles.settingsLabel}>عشاء — شفق</Text>
              {[{ val: 'abyad' as const, label: 'شفقِ ابیض (18°) — حنفی' }, { val: 'ahmar' as const, label: 'شفقِ احمر (12°) — شافعی/مالکی' }].map((opt) => (
                <TouchableOpacity key={opt.val} style={[styles.settingsItem, shafaqType === opt.val && styles.settingsItemActive]} onPress={() => handleApplyCalcSettings(undefined, opt.val)}>
                  <Text style={[styles.settingsItemText, shafaqType === opt.val && { color: '#005F46', fontWeight: '800' }]}>{opt.label}</Text>
                  {shafaqType === opt.val && <Ionicons name="checkmark-circle" size={18} color="#005F46" />}
                </TouchableOpacity>
              ))}
              <Text style={styles.settingsLabel}>مقام کی ترتیب</Text>
              <View style={styles.locTabRow}>
                {(['auto', 'search', 'manual'] as const).map((mode) => (
                  <TouchableOpacity key={mode} style={[styles.locTab, locationTab === mode && styles.locTabActive]} onPress={() => setLocationTab(mode)}>
                    <Text style={[styles.locTabText, locationTab === mode && styles.locTabTextActive]}>{mode === 'auto' ? 'GPS' : mode === 'search' ? 'تلاش' : 'دستی'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {locationTab === 'auto' && (
                <TouchableOpacity style={styles.actionBtn} onPress={() => { handleAutoDetect(); setSettingsModalVisible(false); }}>
                  <Ionicons name="location-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.actionBtnText}>GPS سے جگہ معلوم کریں</Text>
                </TouchableOpacity>
              )}
              {locationTab === 'search' && (
                <>
                  <TextInput style={styles.textInput} placeholder="شہر کا نام (e.g. Karachi)" placeholderTextColor="#94A3B8" value={searchQuery} onChangeText={setSearchQuery} />
                  <TouchableOpacity style={styles.actionBtn} onPress={handleSearch} disabled={searching}>
                    {searching ? <ActivityIndicator size="small" color="#FFFFFF" /> : <><Ionicons name="search" size={18} color="#FFFFFF" /><Text style={styles.actionBtnText}>شہر تلاش کریں</Text></>}
                  </TouchableOpacity>
                </>
              )}
              {locationTab === 'manual' && (
                <>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}><Text style={styles.fieldLabel}>Latitude</Text><TextInput style={styles.textInput} keyboardType="numeric" placeholder="21.42" placeholderTextColor="#94A3B8" value={manualLat} onChangeText={setManualLat} /></View>
                    <View style={{ flex: 1 }}><Text style={styles.fieldLabel}>Longitude</Text><TextInput style={styles.textInput} keyboardType="numeric" placeholder="39.82" placeholderTextColor="#94A3B8" value={manualLng} onChangeText={setManualLng} /></View>
                  </View>
                  <Text style={styles.fieldLabel}>Altitude (meters)</Text>
                  <TextInput style={styles.textInput} keyboardType="numeric" placeholder="0" placeholderTextColor="#94A3B8" value={manualAlt} onChangeText={setManualAlt} />
                  <TouchableOpacity style={styles.actionBtn} onPress={handleManualSave}>
                    <Ionicons name="checkmark" size={18} color="#FFFFFF" /><Text style={styles.actionBtnText}>محفوظ کریں</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#002E23' },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingBottom: 10, gap: 12 },
  headerBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 14, fontWeight: '800', color: '#C8A84E' },
  headerSubtitle: { fontSize: 11, color: '#FFFFFF', fontWeight: '600' },
  tabBar: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.2)', margin: SPACING.md, marginTop: 0, borderRadius: RADIUS.lg, padding: 4, gap: 4 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: RADIUS.md, gap: 5 },
  tabBtnSelected: { backgroundColor: '#C8A84E' },
  tabBtnText: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },
  tabBtnTextSelected: { color: '#002E23', fontWeight: '800' },
  scrollContent: { paddingHorizontal: SPACING.md, gap: 14 },
  loadingBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  loadingText: { color: '#E2E8F0', fontSize: 14, fontWeight: '600' },
  retryBtn: { backgroundColor: '#005F46', paddingHorizontal: 20, paddingVertical: 10, borderRadius: RADIUS.lg },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700' },
  dateCard: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: RADIUS.xl, padding: SPACING.md, gap: 4, borderWidth: 1, borderColor: 'rgba(200,168,78,0.2)' },
  dateCardRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  locationText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF', flex: 1 },
  coordText: { fontSize: 10, color: '#C8A84E', fontWeight: '600' },
  hijriDateText: { fontSize: 16, fontWeight: '900', color: '#C8A84E' },
  gregorianDateText: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  methodText: { fontSize: 10, color: '#94A3B8', flex: 1 },
  sunArcCard: { backgroundColor: '#FFFFFF', borderRadius: RADIUS.xl, padding: SPACING.md, gap: 12 },
  arcTrack: { height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, position: 'relative', overflow: 'visible', marginBottom: 8 },
  arcFill: { height: '100%', backgroundColor: '#F59E0B', borderRadius: 4 },
  sunDot: { position: 'absolute', top: -10, width: 28, height: 28, alignItems: 'center', justifyContent: 'center', marginLeft: -14 },
  sunEmoji: { fontSize: 20 },
  arcLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  arcLabel: { fontSize: 10, color: '#64748B', fontWeight: '700', textAlign: 'center' },
  keyTimesRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  keyTimeItem: { alignItems: 'center', gap: 3 },
  keyTimeEmoji: { fontSize: 16 },
  keyTimeLabel: { fontSize: 10, color: '#64748B', fontWeight: '700' },
  keyTimeValue: { fontSize: 12, color: '#0F172A', fontWeight: '800' },
  nextPrayerCard: { backgroundColor: '#003D2E', borderRadius: RADIUS.xl, padding: SPACING.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: '#C8A84E' },
  makruhWarningCard: { backgroundColor: '#FEF2F2', borderColor: '#DC2626' },
  nextLabel: { fontSize: 11, fontWeight: '800', color: '#C8A84E', textTransform: 'uppercase' },
  nextName: { fontSize: 22, fontWeight: '900', color: '#FFFFFF' },
  nextTime: { fontSize: 14, color: '#C8A84E', fontWeight: '700' },
  countdownBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(200,168,78,0.15)', borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 6, gap: 6 },
  countdownText: { fontSize: 15, fontWeight: '800', color: '#C8A84E' },
  prayerList: { backgroundColor: '#FFFFFF', borderRadius: RADIUS.xl, overflow: 'hidden' },
  prayerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 10 },
  prayerRowNext: { backgroundColor: '#E8F5EE' },
  prayerRowMakruh: { backgroundColor: '#FFF5F5' },
  kindDot: { width: 8, height: 8, borderRadius: 4 },
  prayerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  prayerUrdu: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  kindBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.sm },
  kindBadgeText: { fontSize: 9, fontWeight: '800' },
  makruhNote: { fontSize: 10, color: '#DC2626', marginTop: 2 },
  prayerTime: { fontSize: 13, fontWeight: '800', color: '#64748B' },
  nextArrow: { marginLeft: 4 },
  makruhCard: { backgroundColor: '#FEF2F2', borderRadius: RADIUS.xl, padding: SPACING.md, gap: 8, borderWidth: 1, borderColor: '#FCA5A5' },
  makruhCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  makruhCardTitle: { fontSize: 12, fontWeight: '800', color: '#DC2626' },
  makruhRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  makruhRowLabel: { fontSize: 12, fontWeight: '700', color: '#7F1D1D', flex: 1 },
  makruhRowTime: { fontSize: 12, fontWeight: '700', color: '#B91C1C' },
  monthlySection: { gap: 4 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#FFFFFF', marginBottom: 8 },
  monthHeaderRow: { backgroundColor: '#003D2E', borderRadius: RADIUS.sm },
  monthRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 8 },
  monthRowToday: { backgroundColor: 'rgba(200,168,78,0.15)', borderWidth: 1, borderColor: '#C8A84E', borderRadius: RADIUS.sm },
  monthCell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  monthHeaderCell: { fontSize: 11, fontWeight: '800', color: '#C8A84E', textAlign: 'center' },
  monthDateText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  monthHijriText: { fontSize: 9, color: '#94A3B8' },
  monthTimeText: { fontSize: 10, fontWeight: '700', color: '#E2E8F0', textAlign: 'center' },
  moonSection: { gap: 14 },
  moonHeroCard: { backgroundColor: '#003D2E', borderRadius: RADIUS.xl, padding: SPACING.xl, alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: '#C8A84E' },
  moonEmoji: { fontSize: 56 },
  moonPhaseName: { fontSize: 20, fontWeight: '900', color: '#FFFFFF' },
  moonPhaseNameEn: { fontSize: 13, color: '#C8A84E', fontWeight: '700' },
  moonIlluminationBar: { width: '80%', height: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 4, overflow: 'hidden' },
  moonIlluminationFill: { height: '100%', backgroundColor: '#C8A84E', borderRadius: 4 },
  moonIlluminationText: { fontSize: 12, color: '#94A3B8', fontWeight: '700' },
  moonStatsGrid: { flexDirection: 'row', gap: 10 },
  moonStatCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: RADIUS.lg, padding: 12, alignItems: 'center', gap: 4 },
  moonStatNum: { fontSize: 28, fontWeight: '900', color: '#005F46' },
  moonStatLabel: { fontSize: 10, color: '#64748B', fontWeight: '700', textAlign: 'center' },
  hijriCard: { backgroundColor: 'rgba(200,168,78,0.15)', borderRadius: RADIUS.lg, padding: SPACING.md, gap: 4, borderWidth: 1, borderColor: 'rgba(200,168,78,0.3)' },
  hijriLabel: { fontSize: 11, color: '#C8A84E', fontWeight: '700' },
  hijriValue: { fontSize: 16, fontWeight: '900', color: '#FFFFFF' },
  lunarMonthCard: { backgroundColor: '#FFFFFF', borderRadius: RADIUS.xl, padding: SPACING.md, gap: 6 },
  lunarMonthTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  lunarMonthItem: { fontSize: 12, color: '#334155' },
  qazaSection: { gap: 12 },
  qazaTotalCard: { backgroundColor: '#003D2E', borderRadius: RADIUS.xl, padding: SPACING.lg, flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 1.5, borderColor: '#C8A84E' },
  qazaTotalNum: { fontSize: 42, fontWeight: '900', color: '#C8A84E' },
  qazaTotalLabel: { fontSize: 13, color: '#FFFFFF', fontWeight: '700' },
  qazaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderRadius: RADIUS.lg, padding: SPACING.md },
  qazaRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qazaRowLabel: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  qazaCounter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qazaBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  qazaCount: { fontSize: 22, fontWeight: '900', color: '#0F172A', minWidth: 36, textAlign: 'center' },
  qazaInfoCard: { flexDirection: 'row', backgroundColor: '#E8F5EE', borderRadius: RADIUS.lg, padding: SPACING.md, gap: 8, alignItems: 'flex-start' },
  qazaInfoText: { flex: 1, fontSize: 11, color: '#005F46', lineHeight: 17 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: SPACING.md, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  settingsLabel: { fontSize: 12, fontWeight: '900', color: '#C8A84E', textTransform: 'uppercase', letterSpacing: 0.5 },
  settingsItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: '#F8FAFC', borderRadius: RADIUS.md, borderWidth: 1, borderColor: '#E2E8F0' },
  settingsItemActive: { backgroundColor: '#E8F5EE', borderColor: '#005F46' },
  settingsItemText: { fontSize: 13, color: '#334155', flex: 1 },
  locTabRow: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: RADIUS.md, padding: 3, gap: 3 },
  locTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: RADIUS.sm },
  locTabActive: { backgroundColor: '#FFFFFF' },
  locTabText: { fontSize: 12, fontWeight: '700', color: '#94A3B8' },
  locTabTextActive: { color: '#005F46' },
  textInput: { height: 48, borderRadius: RADIUS.md, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: SPACING.md, color: '#0F172A', backgroundColor: '#F8FAFC', fontSize: 14 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 4 },
  actionBtn: { height: 48, backgroundColor: '#005F46', borderRadius: RADIUS.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
