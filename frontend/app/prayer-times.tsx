import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { goBackOrReplace } from '@/lib/navigation';
import { ScreenRefreshControl } from "@/components/ui";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
  Modal, TextInput, Alert, ActivityIndicator,
  Dimensions, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { RADIUS, SPACING } from '@/constants/theme';
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
  formatDuration,
  getDayLengthMinutes,
  getSolarAltitude,
  getSunAzimuth,
  getCivilTwilightTimes,
  getQiblaDirection,
  getGoldenHourTimes,
  getPrayerWindowProgress,
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
  loadQazaLogs,
  addQazaLog,
  QazaRecord,
  QazaLogEntry,
  DEFAULT_QAZA_RECORD,
} from '@/lib/prayerStorage';
import {
  loadPrayerAlarmsConfig,
  savePrayerAlarmsConfig,
  scheduleOfflinePrayerAlarms,
  DEFAULT_PRAYER_ALARMS_CONFIG,
  type PrayerAlarmsConfig,
} from '@/lib/prayerAlarmService';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const BG       = '#01150E';
const SURFACE  = '#0B2318';
const SURFACE2 = '#112C1E';
const GOLD     = '#C8A84E';
const GOLD_LT  = '#E8C96A';
const GOLD_BG  = 'rgba(200,168,78,0.12)';
const GOLD_BDR = 'rgba(200,168,78,0.22)';
const EMRD     = '#00A86B';
const EMRD_DIM = '#005F46';
const W        = '#FFFFFF';
const W80      = 'rgba(255,255,255,0.80)';
const W50      = 'rgba(255,255,255,0.50)';
const W20      = 'rgba(255,255,255,0.12)';
const RED      = '#DC2626';
const RED_BG   = 'rgba(220,38,38,0.10)';

const KIND: Record<string, { bar: string; badge: string; badgeTxt: string; label: string }> = {
  fard:   { bar: GOLD,      badge: GOLD_BG,                 badgeTxt: GOLD,      label: 'Fard'   },
  sun:    { bar: '#F97316', badge: 'rgba(249,115,22,0.12)', badgeTxt: '#F97316', label: 'Sunrise'  },
  nafl:   { bar: '#818CF8', badge: 'rgba(129,140,248,0.12)',badgeTxt: '#818CF8', label: 'Nafl'   },
  marker: { bar: W50,       badge: W20,                     badgeTxt: W50,       label: 'Marker' },
  makruh: { bar: RED,       badge: RED_BG,                  badgeTxt: RED,       label: 'Makruh' },
};

function fmt(d: Date) {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}
function fmtCd(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2,'0')}m ${String(sec).padStart(2,'0')}s`;
  return `${m}m ${String(sec).padStart(2,'0')}s`;
}
function compassLabel(deg: number) {
  return ['N','NE','E','SE','S','SW','W','NW'][Math.round(deg / 45) % 8];
}

type ActiveTab = 'today' | 'monthly' | 'moon' | 'qaza';

// ─── StatChip subcomponent ────────────────────────────────────────────────────
function StatChip({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <View style={sc.chip}>
      <Ionicons name={icon as any} size={13} color={GOLD} />
      <View>
        <Text style={sc.lbl}>{label}</Text>
        <Text style={sc.val}>{value}</Text>
      </View>
    </View>
  );
}
const sc = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: W20, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: GOLD_BDR },
  lbl:  { color: W50, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  val:  { color: W, fontSize: 12, fontWeight: '800' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function PrayerTimesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [settings, setSettings]           = useState<PrayerSettings>(DEFAULT_PRAYER_SETTINGS);
  const [prayerTimes, setPrayerTimes]     = useState<LibPrayerTime[] | null>(null);
  const [countdown, setCountdown]         = useState('');
  const [status, setStatus]               = useState<'loading' | 'ready' | 'error'>('loading');
  const [activeTab, setActiveTab]         = useState<ActiveTab>('today');
  const [settingsModal, setSettingsModal] = useState(false);
  const [locationTab, setLocationTab]     = useState<LocationMode>('auto');
  const [methodOverride, setMethodOverride] = useState('auto');
  const [shafaqType, setShafaqType]       = useState<'ahmar' | 'abyad'>('abyad');
  const [asrFactor, setAsrFactor]         = useState<1 | 2>(2);
  const [searchQuery, setSearchQuery]     = useState('');
  const [searching, setSearching]         = useState(false);
  const [manualLat, setManualLat]         = useState('');
  const [manualLng, setManualLng]         = useState('');
  const [manualAlt, setManualAlt]         = useState('');
  const [monthlyRows, setMonthlyRows]     = useState<DailyPrayerRow[]>([]);
  const [moonInfo, setMoonInfo]           = useState<MoonPhaseInfo | null>(null);
  const [qaza, setQaza]                   = useState<QazaRecord>(DEFAULT_QAZA_RECORD);
  const [qazaLogs, setQazaLogs]           = useState<QazaLogEntry[]>([]);
  const [now, setNow]                     = useState(new Date());
  const [solarAlt, setSolarAlt]           = useState(0);
  const [sunAz, setSunAz]                 = useState(0);
  const [qazaTarget, setQazaTarget]       = useState(2);
  const [alarmConfig, setAlarmConfig]   = useState<PrayerAlarmsConfig>(DEFAULT_PRAYER_ALARMS_CONFIG);
  const pulseAnim                         = useRef(new Animated.Value(1)).current;
  const cdRef                             = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 0.2, duration: 800, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,   duration: 800, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const st = await loadPrayerSettings();
      const qz = await loadQazaRecord();
      const logs = await loadQazaLogs();
      const ac = await loadPrayerAlarmsConfig();
      if (!alive) return;
      setSettings(st); setLocationTab(st.locationMode); setMethodOverride(st.method);
      setShafaqType(st.shafaqType || 'abyad'); setAsrFactor(st.asrFactor || 2);
      setManualLat(st.latitude.toString()); setManualLng(st.longitude.toString());
      setManualAlt((st.altitude || 0).toString()); setQaza(qz); setQazaLogs(logs); setAlarmConfig(ac);
    })();
    const unsub = subscribeToPrayerSettings(s => { if (alive) setSettings(s); });
    return () => { alive = false; unsub(); };
  }, []);

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);

  useEffect(() => {
    const upd = () => {
      const d = new Date();
      setSolarAlt(parseFloat(getSolarAltitude(d, settings.latitude, settings.longitude).toFixed(1)));
      setSunAz(parseFloat(getSunAzimuth(d, settings.latitude, settings.longitude).toFixed(1)));
    };
    upd();
    const t = setInterval(upd, 60000);
    return () => clearInterval(t);
  }, [settings.latitude, settings.longitude]);

  const handleAutoDetect = useCallback(async () => {
    setStatus('loading');
    try {
      const { status: gs } = await Location.requestForegroundPermissionsAsync();
      if (gs !== 'granted') { Alert.alert('GPS Denied', 'Permission required.'); setStatus('ready'); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude, altitude } = pos.coords;
      let city = 'Unknown', state = '', country = '';
      try { const r = await Location.reverseGeocodeAsync({ latitude, longitude }); if (r?.length) { city = r[0].city || r[0].district || 'Unknown'; state = r[0].region || ''; country = r[0].country || ''; } } catch { /**/ }
      await savePrayerSettings({ ...settings, locationMode: 'auto', latitude, longitude, altitude: altitude || 0, city, state, country, method: methodOverride as any, shafaqType, asrFactor });
      Alert.alert('Location Updated', `${city}, ${country}`);
    } catch { Alert.alert('Error', 'Unable to detect location.'); }
    finally { setStatus('ready'); }
  }, [settings, methodOverride, shafaqType, asrFactor]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) { Alert.alert('Required', 'Enter a city name.'); return; }
    setSearching(true);
    try {
      const res = await Location.geocodeAsync(searchQuery);
      if (res?.length) {
        const { latitude, longitude, altitude } = res[0];
        let city = searchQuery, state = '', country = '';
        try { const r = await Location.reverseGeocodeAsync({ latitude, longitude }); if (r?.length) { city = r[0].city || r[0].district || searchQuery; state = r[0].region || ''; country = r[0].country || ''; } } catch { /**/ }
        await savePrayerSettings({ ...settings, locationMode: 'search', latitude, longitude, altitude: altitude || 0, city, state, country, method: methodOverride as any, shafaqType, asrFactor });
        Alert.alert('Location Found', `${city}, ${country}`);
        setSettingsModal(false);
      } else { Alert.alert('Not Found', 'Try a different city name.'); }
    } catch { Alert.alert('Search Failed', 'An error occurred.'); }
    finally { setSearching(false); }
  };

  const handleManualSave = async () => {
    const lat = parseFloat(manualLat), lng = parseFloat(manualLng), alt = parseFloat(manualAlt) || 0;
    if (isNaN(lat) || lat < -90 || lat > 90) { Alert.alert('Invalid Latitude', 'Must be -90 to 90.'); return; }
    if (isNaN(lng) || lng < -180 || lng > 180) { Alert.alert('Invalid Longitude', 'Must be -180 to 180.'); return; }
    await savePrayerSettings({ ...settings, locationMode: 'manual', latitude: lat, longitude: lng, altitude: alt, city: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, state: alt > 0 ? `Alt: ${alt}m` : 'Manual', country: 'Override', method: methodOverride as any, shafaqType, asrFactor });
    Alert.alert('Saved', 'Manual coordinates applied.'); setSettingsModal(false);
  };

  const handleApplyCalc = async (m?: string, sh?: 'ahmar' | 'abyad', asr?: 1 | 2) => {
    const nm = m ?? methodOverride, ns = sh ?? shafaqType, na = asr ?? asrFactor;
    if (m)   setMethodOverride(nm);
    if (sh)  setShafaqType(ns);
    if (asr) setAsrFactor(na);
    const updated = { ...settings, method: nm as any, shafaqType: ns, asrFactor: na };
    await savePrayerSettings(updated);
    void scheduleOfflinePrayerAlarms(updated, alarmConfig).catch(() => {});
  };

  const handleToggleAlarm = async (key: keyof Omit<PrayerAlarmsConfig, 'reminderMinutesBefore'>) => {
    const nextConfig = { ...alarmConfig, [key]: !alarmConfig[key] };
    setAlarmConfig(nextConfig);
    await savePrayerAlarmsConfig(nextConfig);
    const count = await scheduleOfflinePrayerAlarms(settings, nextConfig);
    if (key === 'enabled') {
      Alert.alert(
        nextConfig.enabled ? 'Prayer Alarms Enabled' : 'Prayer Alarms Disabled',
        nextConfig.enabled
          ? `Alhamdulillah! ${count} offline prayer alerts have been scheduled on your device.`
          : 'Offline prayer notifications have been turned off.'
      );
    }
  };

  const handleSetReminderMinutes = async (mins: number) => {
    const nextConfig = { ...alarmConfig, reminderMinutesBefore: mins };
    setAlarmConfig(nextConfig);
    await savePrayerAlarmsConfig(nextConfig);
    await scheduleOfflinePrayerAlarms(settings, nextConfig);
  };

  const calcSettings = useMemo(() => {
    let base = PRAYER_METHODS.muslimWorldLeague;
    if (settings.method === 'auto') base = getPrayerCalculationSettings(settings.country);
    else if (PRAYER_METHODS[settings.method]) base = PRAYER_METHODS[settings.method];
    return { ...base, asrFactor: settings.asrFactor || asrFactor, shafaqType: settings.shafaqType || shafaqType };
  }, [settings, asrFactor, shafaqType]);

  useEffect(() => {
    try {
      const t = calculatePrayerTimes(new Date(), settings.latitude, settings.longitude, calcSettings, settings.altitude);
      setPrayerTimes(t); setMoonInfo(calculateMoonPhase(new Date())); setStatus('ready');
    } catch (e) { console.error(e); setStatus('error'); }
  }, [settings, calcSettings]);

  useEffect(() => {
    if (activeTab === 'monthly') {
      const d = new Date();
      setMonthlyRows(getMonthlyPrayerTimes(d.getFullYear(), d.getMonth(), settings.latitude, settings.longitude, calcSettings, settings.altitude));
    }
  }, [activeTab, settings, calcSettings]);

  const nextPrayer = useMemo(() => {
    if (!prayerTimes) return null;
    const f = prayerTimes.filter(p => p.kind === 'fard');
    return f.find(p => p.time.getTime() > now.getTime()) || f[0] || null;
  }, [prayerTimes, now]);

  const prevPrayer = useMemo(() => {
    if (!prayerTimes) return null;
    const f = prayerTimes.filter(p => p.kind === 'fard');
    return [...f].reverse().find(p => p.time.getTime() <= now.getTime()) || null;
  }, [prayerTimes, now]);

  useEffect(() => {
    if (!nextPrayer) return;
    const tick = () => setCountdown(fmtCd(nextPrayer.time.getTime() - Date.now()));
    tick();
    if (cdRef.current) clearInterval(cdRef.current);
    cdRef.current = setInterval(tick, 1000);
    return () => { if (cdRef.current) clearInterval(cdRef.current); };
  }, [nextPrayer]);

  const sunPercent = useMemo(() => {
    if (!prayerTimes) return 0;
    const fj = prayerTimes.find(p => p.name === 'Fajr')?.time;
    const is = prayerTimes.find(p => p.name === 'Isha')?.time;
    return (fj && is) ? getSunProgressPercent(now, fj, is) : 0;
  }, [prayerTimes, now]);

  const makruhWindows = useMemo(() => {
    if (!prayerTimes) return [];
    const sr = prayerTimes.find(p => p.name === 'Sunrise')?.time;
    const ss = prayerTimes.find(p => p.name === 'Maghrib')?.time;
    const zw = prayerTimes.find(p => p.name === 'Zawal')?.time;
    return (sr && ss && zw) ? getMakruhWindows(sr, ss, zw) : [];
  }, [prayerTimes]);

  const isCurrentlyMakruh = useMemo(() => makruhWindows.some(w => now >= w.start && now <= w.end), [makruhWindows, now]);

  const hijriDate    = useMemo(() => getHijriDate(now, prayerTimes?.find(p => p.name === 'Maghrib')?.time), [prayerTimes, now]);
  const gregorianDate = useMemo(() => now.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }), [now]);
  const currentMethodName = useMemo(() => {
    if (settings.method === 'auto') return getPrayerCalculationSettings(settings.country).method;
    return PRAYER_METHODS[settings.method]?.method || 'Custom';
  }, [settings]);

  const sunriseTime = prayerTimes?.find(p => p.name === 'Sunrise')?.time;
  const sunsetTime  = prayerTimes?.find(p => p.name === 'Maghrib')?.time;
  const dayLenMin   = sunriseTime && sunsetTime ? getDayLengthMinutes(sunriseTime, sunsetTime) : 0;
  const nightLenMin = 1440 - dayLenMin;

  const civilTwilight = useMemo(() => { try { return getCivilTwilightTimes(now, settings.latitude, settings.longitude); } catch { return null; } }, [settings.latitude, settings.longitude]);
  const goldenHour    = useMemo(() => { try { return getGoldenHourTimes(now, settings.latitude, settings.longitude); } catch { return null; } }, [settings.latitude, settings.longitude]);
  const qiblaDir      = useMemo(() => getQiblaDirection(settings.latitude, settings.longitude), [settings.latitude, settings.longitude]);
  const qazaTotal     = Object.values(qaza).reduce((a, b) => a + b, 0);

  const { refreshing, onRefresh } = usePullToRefresh(async () => { await handleAutoDetect(); });
  const handleQazaChange = async (key: keyof QazaRecord, delta: number) => {
    const u = { ...qaza, [key]: Math.max(0, (qaza[key] || 0) + delta) };
    setQaza(u);
    await saveQazaRecord(u);
    const updatedLogs = await addQazaLog(key, delta);
    setQazaLogs(updatedLogs);
  };

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [now]);
  const todayQazaCompleted = useMemo(() => {
    return qazaLogs
      .filter(l => l.dateStr === todayStr && l.change < 0)
      .reduce((sum, l) => sum + Math.abs(l.change), 0);
  }, [qazaLogs, todayStr]);

  const ARC_MARKERS = useMemo(() => {
    if (!prayerTimes) return [];
    return ['Fajr','Ishraq','Zawal','Asr','Isha'].map(name => {
      const labels: Record<string, string> = { Fajr: 'Fajr', Ishraq: 'Ishraq', Zawal: 'Zawal', Asr: 'Asr', Isha: 'Isha' };
      return { name, label: labels[name], time: prayerTimes.find(p => p.name === name)?.time };
    }).filter(m => !!m.time);
  }, [prayerTimes]);

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.hBtn} onPress={() => goBackOrReplace(router, '/more')}>
          <Ionicons name="arrow-back" size={20} color={W} />
        </TouchableOpacity>
        <View style={s.hCenter}>
          <Text style={s.hArabic}>PRAYER SCHEDULE</Text>
          <Text style={s.hSub}>Prayer Times · Tauqeet-Level</Text>
        </View>
        <TouchableOpacity style={[s.hBtn, isCurrentlyMakruh && s.hBtnRed]} onPress={() => setSettingsModal(true)}>
          {isCurrentlyMakruh
            ? <Animated.View style={{ opacity: pulseAnim }}><Ionicons name="warning" size={18} color={RED} /></Animated.View>
            : <Ionicons name="settings-outline" size={18} color={W} />}
        </TouchableOpacity>
      </View>

      {/* Tab Bar */}
      <View style={s.tabBar}>
        {([
          { id: 'today',   label: 'Today',   icon: 'sunny-outline'    },
          { id: 'monthly', label: 'Monthly', icon: 'calendar-outline' },
          { id: 'moon',    label: 'Moon',    icon: 'moon-outline'     },
          { id: 'qaza',    label: 'Qaza',    icon: 'time-outline'     },
        ] as const).map(tab => {
          const sel = activeTab === tab.id;
          return (
            <TouchableOpacity key={tab.id} style={[s.tab, sel && s.tabSel]} onPress={() => setActiveTab(tab.id)} activeOpacity={0.8}>
              <Ionicons name={tab.icon} size={13} color={sel ? BG : W50} />
              <Text style={[s.tabTxt, sel && s.tabTxtSel]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        refreshControl={<ScreenRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        {status === 'loading' ? (
          <View style={s.loadBox}><ActivityIndicator size="large" color={GOLD} /><Text style={s.loadTxt}>Calculating prayer times...</Text></View>
        ) : status === 'error' ? (
          <View style={s.loadBox}>
            <Ionicons name="alert-circle-outline" size={48} color={RED} />
            <Text style={s.loadTxt}>Error calculating prayer times.</Text>
            <TouchableOpacity style={s.retryBtn} onPress={() => setSettings(DEFAULT_PRAYER_SETTINGS)}><Text style={s.retryTxt}>Try Again</Text></TouchableOpacity>
          </View>
        ) : (
          <>
            {/* ══ TODAY TAB ══════════════════════════════════════════════════ */}
            {activeTab === 'today' && (
              <>
                {/* Date Card */}
                <View style={s.dateCard}>
                  <View style={s.dateLocRow}>
                    <Ionicons name="location" size={13} color={GOLD} />
                    <Text style={s.dateLoc} numberOfLines={1}>{settings.city}{settings.state ? `, ${settings.state}` : ''}</Text>
                    <Text style={s.dateCoords}>{settings.latitude.toFixed(2)}°, {settings.longitude.toFixed(2)}°</Text>
                  </View>
                  <Text style={s.hijri}>{hijriDate}</Text>
                  <Text style={s.gregorian}>{gregorianDate}</Text>
                  <View style={s.pillRow}>
                    <View style={s.pill}><Text style={s.pillTxt}>{(settings.asrFactor || 2) === 2 ? 'Hanafi Asr' : 'Shafi Asr'}</Text></View>
                    <View style={s.pill}><Text style={s.pillTxt}>{(settings.shafaqType || 'abyad') === 'abyad' ? 'Shafaq Abyad 18°' : 'Shafaq Ahmar 12°'}</Text></View>
                    <View style={s.pill}><Text style={s.pillTxt} numberOfLines={1}>{currentMethodName}</Text></View>
                  </View>
                  <View style={s.dayNightRow}>
                    <View style={s.dayNightItem}>
                      <Ionicons name="sunny" size={14} color={GOLD} />
                      <Text style={s.dayNightLbl}>Day</Text>
                      <Text style={s.dayNightVal}>{formatDuration(dayLenMin)}</Text>
                    </View>
                    <View style={s.dayNightDiv} />
                    <View style={s.dayNightItem}>
                      <Ionicons name="moon" size={14} color="#818CF8" />
                      <Text style={s.dayNightLbl}>Night</Text>
                      <Text style={s.dayNightVal}>{formatDuration(nightLenMin)}</Text>
                    </View>
                    <View style={s.dayNightDiv} />
                    <View style={s.dayNightItem}>
                      <Ionicons name="compass" size={14} color={EMRD} />
                      <Text style={s.dayNightLbl}>Qibla</Text>
                      <Text style={s.dayNightVal}>{qiblaDir.toFixed(1)}° {compassLabel(qiblaDir)}</Text>
                    </View>
                  </View>
                </View>

                {/* Sun Arc */}
                <View style={s.arcCard}>
                  <Text style={s.arcTitle}>Solar Track & Sun Position</Text>
                  <View style={s.arcTrack}>
                    <View style={[s.arcFill, { width: (Math.min(100, sunPercent) + '%') as any }]} />
                    <View style={[s.sunDot, { left: (Math.min(93, sunPercent) + '%') as any }]}>
                      <Text style={{ fontSize: 22 }}>☀️</Text>
                    </View>
                  </View>
                  <View style={s.arcMarkersRow}>
                    {ARC_MARKERS.map((m, i) => (
                      <View key={i} style={s.arcMarker}>
                        <Text style={s.arcMrkLabel}>{m.label}</Text>
                        <Text style={s.arcMrkTime}>{m.time ? fmt(m.time) : '--'}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={s.arcChipRow}>
                    {sunriseTime && <View style={s.arcChip}><Ionicons name="sunny-outline" size={11} color={GOLD} /><Text style={s.arcChipTxt}>Sunrise {fmt(sunriseTime)}</Text></View>}
                    {sunsetTime  && <View style={s.arcChip}><Ionicons name="moon-outline"  size={11} color={GOLD} /><Text style={s.arcChipTxt}>Sunset {fmt(sunsetTime)}</Text></View>}
                    <View style={s.arcChip}><Ionicons name="time-outline" size={11} color={GOLD} /><Text style={s.arcChipTxt}>Day {formatDuration(dayLenMin)}</Text></View>
                  </View>
                </View>

                {/* Next Prayer */}
                {nextPrayer && (
                  <View style={[s.nextCard, isCurrentlyMakruh && s.nextCardMakruh]}>
                    {isCurrentlyMakruh ? (
                      <View style={s.makruhAlert}>
                        <Animated.View style={[s.makruhDot, { opacity: pulseAnim }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={s.makruhAlertTitle}>Makruh Window Active</Text>
                          <Text style={s.makruhAlertSub}>Prohibited prayer time — Do not perform Salah now</Text>
                        </View>
                      </View>
                    ) : (
                      <View style={s.nextContent}>
                        <View>
                          <Text style={s.nextLabel}>Next Prayer</Text>
                          <Text style={s.nextName}>{nextPrayer.urduName}</Text>
                          <Text style={s.nextTime}>{fmt(nextPrayer.time)}</Text>
                          {prevPrayer && (
                            <Text style={s.prevLabel}>
                              {prevPrayer.urduName} · {Math.floor((now.getTime() - prevPrayer.time.getTime()) / 60000)}m ago
                            </Text>
                          )}
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 6 }}>
                          <View style={s.cdPill}>
                            <Ionicons name="timer-outline" size={14} color={GOLD} />
                            <Text style={s.cdTxt}>{countdown}</Text>
                          </View>
                          <TouchableOpacity
                            style={[s.alarmStatusPill, alarmConfig.enabled && s.alarmStatusPillActive]}
                            onPress={() => setSettingsModal(true)}
                            activeOpacity={0.8}
                          >
                            <Ionicons
                              name={alarmConfig.enabled ? 'notifications' : 'notifications-off-outline'}
                              size={12}
                              color={alarmConfig.enabled ? '#003D2B' : W50}
                            />
                            <Text style={[s.alarmStatusPillTxt, alarmConfig.enabled && s.alarmStatusPillTxtActive]}>
                              {alarmConfig.enabled ? 'الارم چالو' : 'الارم بند'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {/* Prayer List */}
                <View style={s.prayerCard}>
                  {(prayerTimes || []).map((prayer, idx) => {
                    const isNext  = nextPrayer?.name === prayer.name;
                    const isPrev  = prevPrayer?.name === prayer.name;
                    const kd      = KIND[prayer.kind] || KIND.marker;
                    const winProg = prayerTimes ? getPrayerWindowProgress(prayer, prayerTimes, now) : 0;
                    const showBar = prayer.kind === 'fard' && winProg > 0 && winProg < 1;
                    return (
                      <View key={prayer.name} style={[s.pRow, idx === 0 && { borderTopWidth: 0 }, isNext && s.pRowNext, prayer.isMakruh && s.pRowMakruh]}>
                        <View style={[s.pBar, { backgroundColor: kd.bar }]} />
                        <View style={s.pCenter}>
                          <View style={s.pNameRow}>
                            <Text style={[s.pUrdu, isNext && { color: GOLD_LT }]}>{prayer.urduName}</Text>
                            <View style={[s.pBadge, { backgroundColor: kd.badge }]}>
                              <Text style={[s.pBadgeTxt, { color: kd.badgeTxt }]}>{kd.label}</Text>
                            </View>
                            {isNext && <View style={s.nextBadge}><Text style={s.nextBadgeTxt}>NEXT</Text></View>}
                          </View>
                          {prayer.makruhNote && <Text style={s.pMakruhNote}>{prayer.makruhNote}</Text>}
                          {showBar && (
                            <View style={s.winBarTrack}>
                              <View style={[s.winBarFill, { width: (winProg * 100 + '%') as any, backgroundColor: kd.bar }]} />
                            </View>
                          )}
                        </View>
                        <Text style={[s.pTime, (isNext || isPrev) && { color: GOLD_LT, fontWeight: '900', fontSize: 16 }]}>
                          {prayer.label}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {/* Makruh Windows */}
                <View style={s.makruhCard}>
                  <View style={s.makruhCardHdr}>
                    <Ionicons name="warning-outline" size={15} color={RED} />
                    <Text style={s.makruhCardTitle}>Makruh Windows (Prohibited Times)</Text>
                    {isCurrentlyMakruh && <View style={s.activeBadge}><Text style={s.activeBadgeTxt}>● ACTIVE</Text></View>}
                  </View>
                  {makruhWindows.map((w, i) => {
                    const dur = Math.round((w.end.getTime() - w.start.getTime()) / 60000);
                    const active = now >= w.start && now <= w.end;
                    return (
                      <View key={i} style={[s.makruhRow, active && s.makruhRowActive]}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.makruhRowLabel}>{w.urduLabel}</Text>
                          <Text style={s.makruhRowTime}>{fmt(w.start)} — {fmt(w.end)}</Text>
                        </View>
                        <View style={s.durChip}><Text style={s.durChipTxt}>{dur} min</Text></View>
                      </View>
                    );
                  })}
                </View>

                {/* Advanced Astronomy Card */}
                <View style={s.astroCard}>
                  <View style={s.astroHdr}>
                    <Ionicons name="telescope-outline" size={16} color={GOLD} />
                    <Text style={s.astroTitle}>Astronomy & Solar Data</Text>
                  </View>
                  <View style={s.astroGrid}>
                    <StatChip icon="sunny-outline"       label="Solar Altitude"  value={`${solarAlt > 0 ? '+' : ''}${solarAlt}°`} />
                    <StatChip icon="compass-outline"     label="Sun Azimuth"     value={`${sunAz}° ${compassLabel(sunAz)}`} />
                    <StatChip icon="navigate-outline"    label="Qibla Bearing"   value={`${qiblaDir.toFixed(1)}° ${compassLabel(qiblaDir)}`} />
                    {civilTwilight && <StatChip icon="partly-sunny-outline" label="Civil Twilight" value={`${fmt(civilTwilight.start)} – ${fmt(civilTwilight.end)}`} />}
                    {goldenHour    && <StatChip icon="color-filter-outline"  label="Golden Hour"   value={`${fmt(goldenHour.morningEnd)} / ${fmt(goldenHour.eveningStart)}`} />}
                    <StatChip icon="resize-outline"      label="Day / Night"     value={`${formatDuration(dayLenMin)} / ${formatDuration(nightLenMin)}`} />
                  </View>
                  <Text style={s.astroFooter}>
                    Updated every 60s · Jean Meeus Astronomical Algorithms · Alt: {(settings.altitude || 0).toFixed(0)}m
                  </Text>
                </View>
              </>
            )}

            {/* ══ MONTHLY TAB ════════════════════════════════════════════════ */}
            {activeTab === 'monthly' && (
              <View style={s.monthlySection}>
                <Text style={s.sectionTitle}>{new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })} — Monthly Prayer Timetable</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View>
                    <View style={[s.mRow, s.mHdrRow]}>
                      {['Date','Fajr','Sunrise','Zuhr','Asr','Maghrib','Isha'].map((h, i) => (
                        <Text key={i} style={[s.mCell, s.mHdr, i === 0 && { width: 72 }]}>{h}</Text>
                      ))}
                    </View>
                    {monthlyRows.map((row, idx) => {
                      const isToday = row.date.toDateString() === new Date().toDateString();
                      return (
                        <View key={idx} style={[s.mRow, isToday && s.mRowToday]}>
                          <View style={{ width: 72 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                              <Text style={[s.mDateTxt, isToday && { color: GOLD_LT, fontWeight: '900' }]}>{row.dateStr}</Text>
                              {isToday && (
                                <View style={s.mTodayBadge}>
                                  <Text style={s.mTodayBadgeTxt}>آج</Text>
                                </View>
                              )}
                            </View>
                            {row.hijriDay > 0 && <Text style={[s.mHijriTxt, isToday && { color: GOLD, fontWeight: '700' }]}>{row.hijriDay} AH</Text>}
                          </View>
                          {[row.fajr, row.sunrise, row.zuhr, row.asr, row.maghrib, row.isha].map((t, i) => (
                            <Text key={i} style={[s.mCell, s.mTimeTxt, isToday && { color: W, fontWeight: '800' }]}>{t}</Text>
                          ))}
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* ══ MOON TAB ═══════════════════════════════════════════════════ */}
            {activeTab === 'moon' && moonInfo && (
              <View style={s.moonSection}>
                <View style={s.moonHero}>
                  <Text style={s.moonEmoji}>{moonInfo.emoji}</Text>
                  <Text style={s.moonPhaseUrdu}>{moonInfo.urduPhaseName}</Text>
                  <Text style={s.moonPhaseEn}>{moonInfo.phaseName}</Text>
                  <View style={s.moonCycleBar}>
                    <View style={[s.moonCycleFill, { width: ((moonInfo.phase / 29.5) * 100 + '%') as any }]} />
                    <View style={[s.moonCycleDot, { left: (Math.min(94, (moonInfo.phase / 29.5) * 100) + '%') as any }]} />
                  </View>
                  <Text style={s.moonCycleLbl}>Lunar Cycle: Day {moonInfo.phase} of 29</Text>
                  <View style={s.moonIllumRow}>
                    <View style={s.moonIllumBar}>
                      <View style={[s.moonIllumFill, { width: (Math.round(moonInfo.illumination * 100) + '%') as any }]} />
                    </View>
                    <Text style={s.moonIllumTxt}>Illumination {Math.round(moonInfo.illumination * 100)}%</Text>
                  </View>
                </View>

                <View style={s.moonStats}>
                  {[
                    { num: moonInfo.phase,                              label: 'Lunar Day',   icon: 'calendar-outline' },
                    { num: moonInfo.daysToFullMoon,                     label: 'Days to Full Moon',       icon: 'moon'             },
                    { num: moonInfo.daysToNewMoon,                      label: 'Days to New Moon',     icon: 'moon-outline'     },
                    { num: Math.round(moonInfo.illumination * 100),     label: 'Illumination %',       icon: 'star-outline'     },
                  ].map((item, i) => (
                    <View key={i} style={s.moonStatCard}>
                      <Ionicons name={item.icon as any} size={18} color={GOLD} />
                      <Text style={s.moonStatNum}>{item.num}</Text>
                      <Text style={s.moonStatLabel}>{item.label}</Text>
                    </View>
                  ))}
                </View>

                <View style={s.ayyamCard}>
                  <View style={s.ayyamHdr}>
                    <Ionicons name="star" size={15} color={GOLD} />
                    <Text style={s.ayyamTitle}>Ayyam al-Bid (White Days Fasting)</Text>
                  </View>
                  <Text style={s.ayyamDesc}>Fasting on the 13th, 14th, and 15th of every lunar month is a Sunnah. Current lunar day: {moonInfo.phase}</Text>
                  {[13, 14, 15].map(d => (
                    <View key={d} style={[s.ayyamDay, moonInfo.phase === d && s.ayyamDayActive]}>
                      <Text style={[s.ayyamDayNum, moonInfo.phase === d && { color: BG }]}>{d}</Text>
                      <Text style={[s.ayyamDayLbl, moonInfo.phase === d && { color: BG }]}>
                        {d}th Lunar Day{moonInfo.phase === d ? ' ← Today!' : ''}
                      </Text>
                    </View>
                  ))}
                </View>

                <View style={s.hijriCard}>
                  <Ionicons name="information-circle-outline" size={16} color={GOLD} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.hijriCardLbl}>Current Islamic Date (New day starts at Maghrib)</Text>
                    <Text style={s.hijriCardVal}>{hijriDate}</Text>
                  </View>
                </View>

                <View style={s.lunarMonthCard}>
                  <Text style={s.lunarTitle}>Islamic Hijri Months</Text>
                  {['Muharram','Safar','Rabi al-Awwal','Rabi al-Thani','Jumada al-Awwal','Jumada al-Thani','Rajab','Sha\'ban','Ramadan','Shawwal','Dhu al-Qi\'dah','Dhu al-Hijjah'].map((m, i) => (
                    <View key={i} style={s.lunarMonthRow}>
                      <View style={s.lunarNum}><Text style={s.lunarNumTxt}>{i + 1}</Text></View>
                      <Text style={s.lunarName}>{m}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ══ QAZA TAB ═══════════════════════════════════════════════════ */}
            {activeTab === 'qaza' && (
              <View style={s.qazaSection}>
                <View style={[s.qazaTotalCard, { borderColor: qazaTotal === 0 ? EMRD : qazaTotal < 10 ? GOLD : RED }]}>
                  <View style={s.qazaCircle}>
                    <Text style={[s.qazaCircleNum, { color: qazaTotal === 0 ? EMRD : qazaTotal < 10 ? GOLD : RED }]}>{qazaTotal}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.qazaTotalLbl}>Total Missed Prayers (Qaza)</Text>
                    {qazaTotal > 0 && qazaTarget > 0 && <Text style={s.qazaEst}>At {qazaTarget}/day: ~{Math.ceil(qazaTotal / qazaTarget)} days remaining</Text>}
                    {qazaTotal === 0 && <Text style={s.qazaClear}>Alhamdulillah! All completed ✓</Text>}
                  </View>
                </View>

                <View style={s.targetRow}>
                  <Text style={s.targetLbl}>Daily Target:</Text>
                  {[1,2,3,5].map(t => (
                    <TouchableOpacity key={t} style={[s.targetBtn, qazaTarget === t && s.targetBtnSel]} onPress={() => setQazaTarget(t)}>
                      <Text style={[s.targetBtnTxt, qazaTarget === t && { color: BG }]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Today's Completed Qaza (آج ادا کردہ قضاء) */}
                <View style={s.qazaTodayCard}>
                  <View style={s.qazaTodayHdr}>
                    <Ionicons name="checkmark-circle" size={20} color={EMRD} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.qazaTodayTitle}>آج ادا کردہ قضاء (Today's Qaza Completed)</Text>
                      <Text style={s.qazaTodaySub}>روزانہ قضاء ادا کر کے اپنے ذمہ سے فرض سبکدوش کریں</Text>
                    </View>
                    <View style={s.qazaTodayBadge}>
                      <Text style={s.qazaTodayBadgeCount}>{todayQazaCompleted}</Text>
                      <Text style={s.qazaTodayBadgeLbl}>ادا کیں</Text>
                    </View>
                  </View>
                </View>

                {([
                  { key: 'fajr' as const,    label: 'Fajr (فجر)',   icon: 'moon-outline'         },
                  { key: 'zuhr' as const,    label: 'Zuhr (ظہر)',   icon: 'sunny'                },
                  { key: 'asr' as const,     label: 'Asr (عصر)',   icon: 'partly-sunny-outline' },
                  { key: 'maghrib' as const, label: 'Maghrib (مغرب)',  icon: 'cloudy-night-outline' },
                  { key: 'isha' as const,    label: 'Isha (عشاء)',  icon: 'moon'                 },
                ]).map(item => {
                  const count = qaza[item.key];
                  const color = count === 0 ? EMRD : count < 10 ? GOLD : RED;
                  return (
                    <View key={item.key} style={s.qazaRow}>
                      <Ionicons name={item.icon as any} size={20} color={color} />
                      <Text style={[s.qazaRowLbl, { color }]}>{item.label}</Text>
                      <View style={s.qazaCounter}>
                        <TouchableOpacity 
                          style={[s.qazaBtn, s.qazaBtnMinus]} 
                          onPress={() => handleQazaChange(item.key, -1)}
                          accessible={true}
                          accessibilityLabel={`Decrement ${item.label} Qaza`}
                        >
                          <Ionicons name="remove" size={18} color="#FF6B6B" />
                        </TouchableOpacity>
                        <Text style={[s.qazaCount, { color }]}>{count}</Text>
                        <TouchableOpacity 
                          style={s.qazaBtn} 
                          onPress={() => handleQazaChange(item.key, 1)}
                          accessible={true}
                          accessibilityLabel={`Increment ${item.label} Qaza`}
                        >
                          <Ionicons name="add" size={18} color={EMRD_DIM} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}

                {/* Qaza History Log (حالیہ ریکارڈ) */}
                <View style={s.qazaLogCard}>
                  <View style={s.qazaLogHdr}>
                    <Ionicons name="time-outline" size={16} color={GOLD} />
                    <Text style={s.qazaLogTitle}>حالیہ قضاء ہسٹری لاگ (Recent Activity)</Text>
                  </View>
                  {qazaLogs.length === 0 ? (
                    <Text style={s.qazaLogEmpty}>ابھی تک کوئی لاگ ریکارڈ نہیں ہوا۔ جیسے ہی آپ قضاء ادا کریں گے، یہاں تاریخ اور وقت درج ہو جائے گا۔</Text>
                  ) : (
                    <View style={s.qazaLogList}>
                      {qazaLogs.slice(0, 7).map((log) => {
                        const isCompleted = log.change < 0;
                        const prayerLabels: Record<string, string> = {
                          fajr: 'فجر',
                          zuhr: 'ظہر',
                          asr: 'عصر',
                          maghrib: 'مغرب',
                          isha: 'عشاء',
                        };
                        const timeStr = new Date(log.timestamp).toLocaleTimeString([], {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true,
                        });
                        return (
                          <View key={log.id} style={s.qazaLogItem}>
                            <View style={[s.qazaLogDot, { backgroundColor: isCompleted ? EMRD : RED }]} />
                            <View style={{ flex: 1 }}>
                              <Text style={s.qazaLogAction}>
                                {isCompleted ? 'قضاء ادا کی ✓' : 'قضاء شامل کی'} — {prayerLabels[log.prayer] || log.prayer}
                              </Text>
                              <Text style={s.qazaLogDate}>{log.dateStr} · {timeStr}</Text>
                            </View>
                            <Text style={[s.qazaLogDelta, { color: isCompleted ? EMRD : RED }]}>
                              {isCompleted ? '-1' : '+1'}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>

                <View style={s.qazaInfo}>
                  <Ionicons name="information-circle-outline" size={15} color={EMRD_DIM} />
                  <Text style={s.qazaInfoTxt}>Fulfilling missed obligatory prayers is mandatory. Offer one Qaza prayer after each daily prayer and tap (-) to decrement. All data is saved privately on your device.</Text>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Settings Modal */}
      <Modal visible={settingsModal} animationType="slide" transparent onRequestClose={() => setSettingsModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.modalHdr}>
              <Text style={s.modalTitle}>Prayer Times Settings</Text>
              <TouchableOpacity onPress={() => setSettingsModal(false)} style={{ padding: 4 }}><Ionicons name="close" size={22} color={W} /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ gap: 12, padding: SPACING.lg }} showsVerticalScrollIndicator={false}>
              {/* ─── Offline Prayer Alarms (نماز الارم) ─── */}
              <View style={s.alarmSectionCard}>
                <View style={s.alarmHdrRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.alarmSectionTitle}>🔔 Offline Prayer Alarms (نماز الارم)</Text>
                    <Text style={s.alarmSectionSub}>Internet band hone par bhi device level par notification baje</Text>
                  </View>
                  <TouchableOpacity
                    style={[s.alarmMasterToggle, alarmConfig.enabled && s.alarmMasterToggleActive]}
                    onPress={() => handleToggleAlarm('enabled')}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.alarmMasterToggleText, alarmConfig.enabled && s.alarmMasterToggleTextActive]}>
                      {alarmConfig.enabled ? 'ON' : 'OFF'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {alarmConfig.enabled && (
                  <View style={{ marginTop: 10, gap: 8 }}>
                    <Text style={s.settLabel}>Reminder Timing (الارم کا وقت)</Text>
                    <View style={s.reminderPillsRow}>
                      {[
                        { mins: 0, label: 'At Exact Time (عین وقت)' },
                        { mins: 10, label: '10 min before' },
                        { mins: 15, label: '15 min before' },
                      ].map((item) => {
                        const sel = (alarmConfig.reminderMinutesBefore || 0) === item.mins;
                        return (
                          <TouchableOpacity
                            key={item.mins}
                            style={[s.reminderPill, sel && s.reminderPillActive]}
                            onPress={() => handleSetReminderMinutes(item.mins)}
                          >
                            <Text style={[s.reminderPillTxt, sel && s.reminderPillTxtActive]}>
                              {item.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <Text style={s.settLabel}>Individual Prayer Alerts (مخصوص نمازیں)</Text>
                    <View style={s.prayerTogglesGrid}>
                      {[
                        { key: 'fajr' as const, name: 'فجر (Fajr)' },
                        { key: 'zuhr' as const, name: 'ظہر (Zuhr)' },
                        { key: 'asr' as const, name: 'عصر (Asr)' },
                        { key: 'maghrib' as const, name: 'مغرب (Maghrib)' },
                        { key: 'isha' as const, name: 'عشاء (Isha)' },
                        { key: 'tahajjud' as const, name: 'تہجد (Tahajjud)' },
                      ].map((p) => {
                        const active = alarmConfig[p.key] !== false;
                        return (
                          <TouchableOpacity
                            key={p.key}
                            style={[s.prayerToggleChip, active && s.prayerToggleChipActive]}
                            onPress={() => handleToggleAlarm(p.key)}
                          >
                            <Ionicons
                              name={active ? 'notifications' : 'notifications-off-outline'}
                              size={14}
                              color={active ? GOLD : W50}
                            />
                            <Text style={[s.prayerToggleChipTxt, active && s.prayerToggleChipTxtActive]}>
                              {p.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>

              <Text style={s.settLabel}>Calculation Method</Text>
              {(['auto','muslimWorldLeague','egyptian','karachi','ummAlQura','northAmerica'] as const).map(key => {
                const label = key === 'auto' ? 'Auto (Location Based)' : (PRAYER_METHODS[key]?.method || key);
                const sel = methodOverride === key;
                return (
                  <TouchableOpacity key={key} style={[s.settItem, sel && s.settItemSel]} onPress={() => handleApplyCalc(key)}>
                    <Text style={[s.settItemTxt, sel && { color: GOLD, fontWeight: '800' }]}>{label}</Text>
                    {sel && <Ionicons name="checkmark-circle" size={18} color={GOLD} />}
                  </TouchableOpacity>
                );
              })}
              <Text style={s.settLabel}>Asr Juristic Method</Text>
              {[{ val: 2 as const, label: 'Hanafi (Double Shadow)' }, { val: 1 as const, label: 'Shafi\'i / Majority (Single Shadow)' }].map(opt => (
                <TouchableOpacity key={opt.val} style={[s.settItem, asrFactor === opt.val && s.settItemSel]} onPress={() => handleApplyCalc(undefined, undefined, opt.val)}>
                  <Text style={[s.settItemTxt, asrFactor === opt.val && { color: GOLD, fontWeight: '800' }]}>{opt.label}</Text>
                  {asrFactor === opt.val && <Ionicons name="checkmark-circle" size={18} color={GOLD} />}
                </TouchableOpacity>
              ))}
              <Text style={s.settLabel}>Isha Twilight Angle</Text>
              {[{ val: 'abyad' as const, label: 'Shafaq Abyad (18°) — Hanafi' }, { val: 'ahmar' as const, label: 'Shafaq Ahmar (15°) — Majority' }].map(opt => (
                <TouchableOpacity key={opt.val} style={[s.settItem, shafaqType === opt.val && s.settItemSel]} onPress={() => handleApplyCalc(undefined, opt.val)}>
                  <Text style={[s.settItemTxt, shafaqType === opt.val && { color: GOLD, fontWeight: '800' }]}>{opt.label}</Text>
                  {shafaqType === opt.val && <Ionicons name="checkmark-circle" size={18} color={GOLD} />}
                </TouchableOpacity>
              ))}
              <Text style={s.settLabel}>Location Settings</Text>
              <View style={s.locTabRow}>
                {(['auto','search','manual'] as const).map(mode => (
                  <TouchableOpacity key={mode} style={[s.locTab, locationTab === mode && s.locTabSel]} onPress={() => setLocationTab(mode)}>
                    <Text style={[s.locTabTxt, locationTab === mode && s.locTabTxtSel]}>{mode === 'auto' ? 'GPS' : mode === 'search' ? 'Search' : 'Manual'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {locationTab === 'auto' && (
                <TouchableOpacity style={s.settBtn} onPress={() => { handleAutoDetect(); setSettingsModal(false); }}>
                  <Ionicons name="location-outline" size={18} color={BG} />
                  <Text style={s.settBtnTxt}>Locate via GPS</Text>
                </TouchableOpacity>
              )}
              {locationTab === 'search' && (
                <>
                  <TextInput style={s.textInput} placeholder="City Name (e.g. Karachi, London)" placeholderTextColor={W50} value={searchQuery} onChangeText={setSearchQuery} />
                  <TouchableOpacity style={s.settBtn} onPress={handleSearch} disabled={searching}>
                    {searching ? <ActivityIndicator size="small" color={BG} /> : <><Ionicons name="search" size={18} color={BG} /><Text style={s.settBtnTxt}>Search City</Text></>}
                  </TouchableOpacity>
                </>
              )}
              {locationTab === 'manual' && (
                <>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}><Text style={s.fieldLbl}>Latitude</Text><TextInput style={s.textInput} keyboardType="numeric" placeholder="21.42" placeholderTextColor={W50} value={manualLat} onChangeText={setManualLat} /></View>
                    <View style={{ flex: 1 }}><Text style={s.fieldLbl}>Longitude</Text><TextInput style={s.textInput} keyboardType="numeric" placeholder="39.82" placeholderTextColor={W50} value={manualLng} onChangeText={setManualLng} /></View>
                  </View>
                  <Text style={s.fieldLbl}>Altitude (meters)</Text>
                  <TextInput style={s.textInput} keyboardType="numeric" placeholder="0" placeholderTextColor={W50} value={manualAlt} onChangeText={setManualAlt} />
                  <TouchableOpacity style={s.settBtn} onPress={handleManualSave}>
                    <Ionicons name="checkmark" size={18} color={BG} />
                    <Text style={s.settBtnTxt}>Save Settings</Text>
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

// ─── StyleSheet ───────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },

  header:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10, gap: 12 },
  hBtn:     { width: 38, height: 38, borderRadius: 19, backgroundColor: W20, alignItems: 'center', justifyContent: 'center' },
  hBtnRed:  { backgroundColor: RED_BG, borderWidth: 1, borderColor: RED },
  hCenter:  { flex: 1, alignItems: 'center' },
  hArabic:  { fontSize: 14, fontWeight: '900', color: GOLD },
  hSub:     { fontSize: 10, color: W50, fontWeight: '600' },

  tabBar:    { flexDirection: 'row', backgroundColor: W20, marginHorizontal: 16, borderRadius: RADIUS.lg, padding: 4, gap: 3 },
  tab:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: RADIUS.md, gap: 4 },
  tabSel:    { backgroundColor: GOLD },
  tabTxt:    { fontSize: 11, fontWeight: '700', color: W50 },
  tabTxtSel: { color: BG, fontWeight: '900' },

  scroll:   { paddingHorizontal: 16, paddingTop: 14, gap: 14 },
  loadBox:  { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 14 },
  loadTxt:  { color: W50, fontSize: 14, fontWeight: '600' },
  retryBtn: { backgroundColor: EMRD_DIM, paddingHorizontal: 20, paddingVertical: 10, borderRadius: RADIUS.lg },
  retryTxt: { color: W, fontWeight: '800' },

  dateCard:     { backgroundColor: SURFACE, borderRadius: 22, padding: 18, gap: 8, borderWidth: 1, borderColor: GOLD_BDR },
  dateLocRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateLoc:      { fontSize: 13, fontWeight: '800', color: W, flex: 1 },
  dateCoords:   { fontSize: 10, color: GOLD, fontWeight: '600' },
  hijri:        { fontSize: 22, fontWeight: '900', color: GOLD_LT, textAlign: 'center', letterSpacing: 0.3 },
  gregorian:    { fontSize: 12, color: W50, fontWeight: '600', textAlign: 'center' },
  pillRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill:         { backgroundColor: W20, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: GOLD_BDR },
  pillTxt:      { color: GOLD, fontSize: 10, fontWeight: '800' },
  dayNightRow:  { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: W20, paddingTop: 10, marginTop: 2 },
  dayNightItem: { flex: 1, alignItems: 'center', gap: 3 },
  dayNightLbl:  { color: W50, fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  dayNightVal:  { color: W, fontSize: 12, fontWeight: '800' },
  dayNightDiv:  { width: 1, height: 28, backgroundColor: W20 },

  arcCard:      { backgroundColor: SURFACE, borderRadius: 22, padding: 16, gap: 10, borderWidth: 1, borderColor: GOLD_BDR },
  arcTitle:     { color: GOLD, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  arcTrack:     { height: 8, backgroundColor: W20, borderRadius: 4, position: 'relative', overflow: 'visible', marginVertical: 14 },
  arcFill:      { height: '100%', backgroundColor: GOLD, borderRadius: 4, opacity: 0.7 },
  sunDot:       { position: 'absolute', top: -16, width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginLeft: -16 },
  arcMarkersRow:{ flexDirection: 'row', justifyContent: 'space-between' },
  arcMarker:    { alignItems: 'center', gap: 2 },
  arcMrkLabel:  { color: GOLD, fontSize: 10, fontWeight: '800' },
  arcMrkTime:   { color: W50, fontSize: 9, fontWeight: '600' },
  arcChipRow:   { flexDirection: 'row', gap: 8, flexWrap: 'wrap', borderTopWidth: 1, borderTopColor: W20, paddingTop: 10 },
  arcChip:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: W20, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  arcChipTxt:   { color: W50, fontSize: 10, fontWeight: '700' },

  nextCard:         { backgroundColor: SURFACE2, borderRadius: 22, padding: 18, borderWidth: 1.5, borderColor: GOLD_BDR },
  nextCardMakruh:   { borderColor: RED, backgroundColor: RED_BG },
  nextContent:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nextLabel:        { fontSize: 10, fontWeight: '900', color: GOLD, textTransform: 'uppercase', letterSpacing: 1.5 },
  nextName:         { fontSize: 26, fontWeight: '900', color: W, marginTop: 2 },
  nextTime:         { fontSize: 15, color: GOLD, fontWeight: '700' },
  prevLabel:        { fontSize: 10, color: W50, fontWeight: '600', marginTop: 4 },
  cdPill:           { flexDirection: 'row', alignItems: 'center', backgroundColor: GOLD_BG, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8, gap: 6, borderWidth: 1, borderColor: GOLD_BDR },
  cdTxt:            { fontSize: 15, fontWeight: '900', color: GOLD },
  alarmStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: W20,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  alarmStatusPillActive: {
    backgroundColor: GOLD,
    borderColor: GOLD_LT,
  },
  alarmStatusPillTxt: {
    fontSize: 10,
    fontWeight: '700',
    color: W50,
  },
  alarmStatusPillTxtActive: {
    color: '#003D2B',
    fontWeight: '900',
  },
  makruhAlert:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  makruhDot:        { width: 10, height: 10, borderRadius: 5, backgroundColor: RED },
  makruhAlertTitle: { fontSize: 15, fontWeight: '900', color: RED },
  makruhAlertSub:   { fontSize: 12, color: RED, fontWeight: '600', marginTop: 2, opacity: 0.7 },

  prayerCard:   { backgroundColor: SURFACE, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: W20 },
  pRow:         { flexDirection: 'row', alignItems: 'center', paddingRight: 16, paddingVertical: 13, borderTopWidth: 1, borderTopColor: W20, gap: 10 },
  pRowNext:     { backgroundColor: GOLD_BG },
  pRowMakruh:   { backgroundColor: RED_BG },
  pBar:         { width: 4, alignSelf: 'stretch', minHeight: 44, borderRadius: 2 },
  pCenter:      { flex: 1, gap: 4 },
  pNameRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  pUrdu:        { fontSize: 15, fontWeight: '800', color: W },
  pBadge:       { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  pBadgeTxt:    { fontSize: 9, fontWeight: '900' },
  nextBadge:    { backgroundColor: GOLD, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  nextBadgeTxt: { fontSize: 8, fontWeight: '900', color: BG, letterSpacing: 0.5 },
  pMakruhNote:  { fontSize: 9, color: RED, fontWeight: '600', opacity: 0.8 },
  winBarTrack:  { height: 3, backgroundColor: W20, borderRadius: 2, overflow: 'hidden' },
  winBarFill:   { height: '100%', borderRadius: 2, opacity: 0.6 },
  pTime:        { fontSize: 14, fontWeight: '800', color: W50 },

  makruhCard:      { backgroundColor: RED_BG, borderRadius: 20, padding: 16, gap: 8, borderWidth: 1, borderColor: 'rgba(220,38,38,0.3)' },
  makruhCardHdr:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  makruhCardTitle: { fontSize: 13, fontWeight: '900', color: RED, flex: 1 },
  activeBadge:     { backgroundColor: RED, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  activeBadgeTxt:  { color: W, fontSize: 9, fontWeight: '900' },
  makruhRow:       { flexDirection: 'row', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(220,38,38,0.2)', gap: 8 },
  makruhRowActive: { backgroundColor: 'rgba(220,38,38,0.12)', borderRadius: 10, padding: 8, marginHorizontal: -4 },
  makruhRowLabel:  { fontSize: 12, fontWeight: '700', color: RED, opacity: 0.9 },
  makruhRowTime:   { fontSize: 11, fontWeight: '600', color: RED, opacity: 0.7 },
  durChip:         { backgroundColor: RED, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  durChipTxt:      { color: W, fontSize: 10, fontWeight: '900' },

  astroCard:   { backgroundColor: SURFACE, borderRadius: 22, padding: 16, gap: 12, borderWidth: 1, borderColor: GOLD_BDR },
  astroHdr:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  astroTitle:  { color: GOLD, fontSize: 12, fontWeight: '900', flex: 1 },
  astroGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  astroFooter: { color: W50, fontSize: 9, fontWeight: '600', fontStyle: 'italic', borderTopWidth: 1, borderTopColor: W20, paddingTop: 10 },

  monthlySection: { gap: 8 },
  sectionTitle:   { fontSize: 13, fontWeight: '800', color: GOLD, marginBottom: 4 },
  mHdrRow:        { backgroundColor: SURFACE2 },
  mRow:           { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: W20, borderRadius: 8 },
  mRowToday:      { backgroundColor: 'rgba(200, 168, 78, 0.18)', borderWidth: 1.5, borderColor: GOLD, borderLeftWidth: 4, borderLeftColor: GOLD_LT },
  mTodayBadge:    { backgroundColor: GOLD, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1 },
  mTodayBadgeTxt: { color: BG, fontSize: 8, fontWeight: '900' },
  mCell:          { width: 54, textAlign: 'center' },
  mHdr:           { color: GOLD, fontSize: 10, fontWeight: '900', textAlign: 'center' },
  mDateTxt:       { fontSize: 11, fontWeight: '700', color: W },
  mHijriTxt:      { fontSize: 9, color: W50 },
  mTimeTxt:       { fontSize: 10, fontWeight: '700', color: W80, textAlign: 'center' },

  moonSection:    { gap: 14 },
  moonHero:       { backgroundColor: SURFACE, borderRadius: 24, padding: 24, alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: GOLD_BDR },
  moonEmoji:      { fontSize: 64, textShadowColor: GOLD, textShadowRadius: 20, textShadowOffset: { width: 0, height: 0 } },
  moonPhaseUrdu:  { fontSize: 20, fontWeight: '900', color: W },
  moonPhaseEn:    { fontSize: 13, color: GOLD, fontWeight: '700' },
  moonCycleBar:   { width: '85%', height: 8, backgroundColor: W20, borderRadius: 4, overflow: 'visible', position: 'relative', marginTop: 4 },
  moonCycleFill:  { height: '100%', backgroundColor: GOLD, borderRadius: 4, opacity: 0.6 },
  moonCycleDot:   { position: 'absolute', top: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: GOLD_LT, marginLeft: -8 },
  moonCycleLbl:   { color: W50, fontSize: 10, fontWeight: '600' },
  moonIllumRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, width: '85%' },
  moonIllumBar:   { flex: 1, height: 6, backgroundColor: W20, borderRadius: 3, overflow: 'hidden' },
  moonIllumFill:  { height: '100%', backgroundColor: GOLD_LT, borderRadius: 3 },
  moonIllumTxt:   { color: W50, fontSize: 11, fontWeight: '700' },
  moonStats:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  moonStatCard:   { flex: 1, minWidth: '45%', backgroundColor: SURFACE, borderRadius: 18, padding: 14, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: GOLD_BDR },
  moonStatNum:    { fontSize: 30, fontWeight: '900', color: GOLD_LT },
  moonStatLabel:  { fontSize: 10, color: W50, fontWeight: '700', textAlign: 'center' },
  ayyamCard:      { backgroundColor: GOLD_BG, borderRadius: 20, padding: 16, gap: 10, borderWidth: 1, borderColor: GOLD_BDR },
  ayyamHdr:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ayyamTitle:     { color: GOLD_LT, fontSize: 12, fontWeight: '900', flex: 1 },
  ayyamDesc:      { color: W50, fontSize: 11, fontWeight: '600', lineHeight: 17 },
  ayyamDay:       { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: W20, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  ayyamDayActive: { backgroundColor: GOLD },
  ayyamDayNum:    { fontSize: 18, fontWeight: '900', color: GOLD, minWidth: 24 },
  ayyamDayLbl:    { fontSize: 12, fontWeight: '700', color: W },
  hijriCard:      { flexDirection: 'row', backgroundColor: SURFACE, borderRadius: 18, padding: 14, gap: 10, alignItems: 'flex-start', borderWidth: 1, borderColor: GOLD_BDR },
  hijriCardLbl:   { fontSize: 10, color: W50, fontWeight: '700' },
  hijriCardVal:   { fontSize: 15, fontWeight: '900', color: W, marginTop: 3 },
  lunarMonthCard: { backgroundColor: SURFACE, borderRadius: 20, padding: 16, gap: 6, borderWidth: 1, borderColor: W20 },
  lunarTitle:     { fontSize: 13, fontWeight: '800', color: GOLD, marginBottom: 4 },
  lunarMonthRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lunarNum:       { width: 24, height: 24, borderRadius: 12, backgroundColor: GOLD_BG, alignItems: 'center', justifyContent: 'center' },
  lunarNumTxt:    { fontSize: 10, fontWeight: '900', color: GOLD },
  lunarName:      { fontSize: 12, color: W80, fontWeight: '600' },

  qazaSection:   { gap: 12 },
  qazaTotalCard: { backgroundColor: SURFACE, borderRadius: 22, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 2 },
  qazaCircle:    { width: 64, height: 64, borderRadius: 32, backgroundColor: W20, alignItems: 'center', justifyContent: 'center' },
  qazaCircleNum: { fontSize: 26, fontWeight: '900' },
  qazaTotalLbl:  { fontSize: 14, color: W, fontWeight: '700' },
  qazaEst:       { fontSize: 11, color: W50, fontWeight: '600', marginTop: 4 },
  qazaClear:     { fontSize: 12, color: EMRD, fontWeight: '800', marginTop: 4 },
  targetRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: SURFACE, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: W20 },
  targetLbl:     { color: W50, fontSize: 12, fontWeight: '700', flex: 1 },
  targetBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: W20, alignItems: 'center', justifyContent: 'center' },
  targetBtnSel:  { backgroundColor: GOLD },
  targetBtnTxt:  { color: W, fontSize: 14, fontWeight: '900' },
  qazaTodayCard: {
    backgroundColor: 'rgba(0, 168, 107, 0.12)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 168, 107, 0.35)',
  },
  qazaTodayHdr: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  qazaTodayTitle: {
    color: '#34D399',
    fontSize: 13,
    fontWeight: '800',
  },
  qazaTodaySub: {
    color: W50,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  qazaTodayBadge: {
    backgroundColor: EMRD,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: 'center',
  },
  qazaTodayBadgeCount: {
    color: W,
    fontSize: 15,
    fontWeight: '900',
  },
  qazaTodayBadgeLbl: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 8,
    fontWeight: '700',
  },
  qazaRow:       { flexDirection: 'row', alignItems: 'center', backgroundColor: SURFACE, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: W20, gap: 10 },
  qazaRowLbl:    { flex: 1, fontSize: 15, fontWeight: '800' },
  qazaCounter:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qazaBtn:       { width: 36, height: 36, borderRadius: 18, backgroundColor: W20, alignItems: 'center', justifyContent: 'center' },
  qazaBtnMinus:  { backgroundColor: 'rgba(220, 38, 38, 0.15)', borderWidth: 1, borderColor: 'rgba(220, 38, 38, 0.3)' },
  qazaCount:     { fontSize: 22, fontWeight: '900', minWidth: 36, textAlign: 'center' },
  qazaLogCard: {
    backgroundColor: SURFACE,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: W20,
    gap: 10,
  },
  qazaLogHdr: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qazaLogTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: GOLD,
    flex: 1,
  },
  qazaLogEmpty: {
    fontSize: 11,
    color: W50,
    fontStyle: 'italic',
    lineHeight: 16,
    paddingVertical: 6,
  },
  qazaLogList: {
    gap: 8,
  },
  qazaLogItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: W20,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  qazaLogDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  qazaLogAction: {
    color: W,
    fontSize: 12,
    fontWeight: '700',
  },
  qazaLogDate: {
    color: W50,
    fontSize: 9,
    marginTop: 1,
  },
  qazaLogDelta: {
    fontSize: 14,
    fontWeight: '900',
  },
  qazaInfo:      { flexDirection: 'row', backgroundColor: 'rgba(0,168,107,0.10)', borderRadius: 16, padding: 14, gap: 8, alignItems: 'flex-start', borderWidth: 1, borderColor: 'rgba(0,168,107,0.2)' },
  qazaInfoTxt:   { flex: 1, fontSize: 11, color: EMRD, lineHeight: 17, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalBox:     { backgroundColor: SURFACE, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 16, maxHeight: '88%' },
  modalHdr:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: W20 },
  modalTitle:   { fontSize: 15, fontWeight: '900', color: GOLD },
  settLabel:    { fontSize: 11, fontWeight: '900', color: GOLD, textTransform: 'uppercase', letterSpacing: 0.8 },
  settItem:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: W20, borderRadius: RADIUS.md, borderWidth: 1, borderColor: W20 },
  settItemSel:  { backgroundColor: GOLD_BG, borderColor: GOLD },
  settItemTxt:  { fontSize: 13, color: W80, flex: 1 },
  locTabRow:    { flexDirection: 'row', backgroundColor: W20, borderRadius: RADIUS.md, padding: 3, gap: 3 },
  locTab:       { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: RADIUS.sm },
  locTabSel:    { backgroundColor: GOLD },
  locTabTxt:    { fontSize: 12, fontWeight: '700', color: W50 },
  locTabTxtSel: { color: BG, fontWeight: '900' },
  textInput:    { height: 48, borderRadius: RADIUS.md, borderWidth: 1, borderColor: W20, paddingHorizontal: SPACING.md, color: W, backgroundColor: W20, fontSize: 14 },
  fieldLbl:     { fontSize: 11, fontWeight: '700', color: W50, marginBottom: 4 },
  settBtn:      { height: 48, backgroundColor: GOLD, borderRadius: RADIUS.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  settBtnTxt:   { color: BG, fontSize: 14, fontWeight: '900' },

  // Alarm section styles
  alarmSectionCard: {
    backgroundColor: 'rgba(0, 46, 35, 0.7)',
    borderRadius: RADIUS.lg,
    padding: 14,
    borderWidth: 1.5,
    borderColor: GOLD,
    marginBottom: 4,
  },
  alarmHdrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  alarmSectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: GOLD_LT,
  },
  alarmSectionSub: {
    fontSize: 10,
    color: W80,
    marginTop: 2,
    lineHeight: 14,
  },
  alarmMasterToggle: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: W20,
    borderWidth: 1,
    borderColor: W50,
  },
  alarmMasterToggleActive: {
    backgroundColor: GOLD,
    borderColor: GOLD,
  },
  alarmMasterToggleText: {
    fontSize: 12,
    fontWeight: '900',
    color: W50,
  },
  alarmMasterToggleTextActive: {
    color: BG,
  },
  reminderPillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  reminderPill: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: RADIUS.sm,
    backgroundColor: W20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  reminderPillActive: {
    backgroundColor: GOLD_BG,
    borderColor: GOLD,
  },
  reminderPillTxt: {
    fontSize: 10,
    color: W50,
    fontWeight: '700',
    textAlign: 'center',
  },
  reminderPillTxtActive: {
    color: GOLD_LT,
    fontWeight: '900',
  },
  prayerTogglesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  prayerToggleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: RADIUS.full,
    backgroundColor: W20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  prayerToggleChipActive: {
    backgroundColor: GOLD_BG,
    borderColor: GOLD_BDR,
  },
  prayerToggleChipTxt: {
    fontSize: 11,
    color: W50,
    fontWeight: '700',
  },
  prayerToggleChipTxtActive: {
    color: GOLD_LT,
    fontWeight: '800',
  },
});
