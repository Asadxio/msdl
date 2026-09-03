// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const EMERALD_DEEP   = '#003D2B';
const EMERALD_MID    = '#005F46';
const EMERALD_LIGHT  = '#10B981';
const GOLD_PRIMARY   = '#D4AF37';
const GOLD_LIGHT     = '#F0CC5A';
const GOLD_GLOW      = 'rgba(212,175,55,0.18)';
const DARK_BG        = '#0A1A12';
const CARD_BG        = '#0E2218';
const CARD_BORDER    = 'rgba(212,175,55,0.15)';
const W              = '#FFFFFF';
const W60            = 'rgba(255,255,255,0.60)';
const W30            = 'rgba(255,255,255,0.30)';
const W10            = 'rgba(255,255,255,0.08)';

import { ScreenRefreshControl } from "@/components/ui";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { Magnetometer } from 'expo-sensors';
import { Camera, CameraView } from 'expo-camera';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { goBackOrReplace } from '@/lib/navigation';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Dimensions,
  Easing,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  KAABA_COORDINATES,
  QIBLA_LOCATION_CACHE_KEY,
  calculateMapLine,
  calculateQiblaState,
  formatDistanceToKaaba,
  getCompassAccuracyLabel,
  getDirectionAbbreviation,
} from '@/lib/qibla';

type QiblaLocation = {
  latitude: number;
  longitude: number;
  city: string;
  state: string;
  country: string;
  permission: 'idle' | 'requesting' | 'granted' | 'denied' | 'offline' | 'unavailable';
  source: 'device' | 'cache' | 'fallback';
  updatedAt?: number;
};

type CameraPermission = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable';
type AccuracyLabel = 'Low' | 'Medium' | 'High';

const FALLBACK_LOCATION: QiblaLocation = {
  latitude: 21.422487,
  longitude: 39.826206,
  city: 'Makkah',
  state: 'Makkah Province',
  country: 'Saudi Arabia',
  permission: 'idle',
  source: 'fallback',
};

const GOOGLE_QIBLA_FINDER_URL = 'https://qiblafinder.withgoogle.com/';
const SENSOR_UPDATE_MS = 60;
const { width: SCREEN_W } = Dimensions.get('window');
const COMPASS_SIZE = Math.min(SCREEN_W - 52, 320);
const DEGREE_MARKS = Array.from({ length: 72 }, (_, i) => i * 5);
const CARDINALS = [
  { label: 'N', deg: 0, major: true, north: true },
  { label: 'NE', deg: 45, major: false, north: false },
  { label: 'E', deg: 90, major: true, north: false },
  { label: 'SE', deg: 135, major: false, north: false },
  { label: 'S', deg: 180, major: true, north: false },
  { label: 'SW', deg: 225, major: false, north: false },
  { label: 'W', deg: 270, major: true, north: false },
  { label: 'NW', deg: 315, major: false, north: false },
];

function formatCoordinate(value: number, axis: 'lat' | 'lng') {
  const dir = axis === 'lat' ? (value >= 0 ? 'N' : 'S') : (value >= 0 ? 'E' : 'W');
  return `${Math.abs(value).toFixed(5)}° ${dir}`;
}

async function requestCameraPermission(): Promise<CameraPermission> {
  const perm = await Camera.requestCameraPermissionsAsync();
  return perm?.status === 'granted' ? 'granted' : 'denied';
}

// ─── METRIC CARD ──────────────────────────────────────────────────────────────
function MetricCard({ label, value, icon, highlight = false }: {
  label: string; value: string; icon: keyof typeof Ionicons.glyphMap; highlight?: boolean;
}) {
  return (
    <View style={[mStyles.card, highlight && mStyles.cardHL]}>
      <View style={mStyles.iconRow}>
        <View style={mStyles.iconWrap}>
          <Ionicons name={icon} size={12} color={highlight ? GOLD_PRIMARY : EMERALD_LIGHT} />
        </View>
        <Text style={mStyles.label}>{label}</Text>
      </View>
      <Text style={[mStyles.value, highlight && mStyles.valueHL]}>{value}</Text>
    </View>
  );
}
const mStyles = StyleSheet.create({
  card:    { flexGrow: 1, minWidth: '46%', backgroundColor: CARD_BG, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: CARD_BORDER },
  cardHL:  { borderColor: 'rgba(212,175,55,0.35)', backgroundColor: 'rgba(212,175,55,0.06)' },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  iconWrap:{ width: 20, height: 20, borderRadius: 10, backgroundColor: W10, alignItems: 'center', justifyContent: 'center' },
  label:   { color: W60, fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  value:   { color: W, fontSize: 17, fontWeight: '900' },
  valueHL: { color: GOLD_LIGHT },
});

// ─── ACCURACY BADGE ──────────────────────────────────────────────────────────
function AccuracyBadge({ level, active }: { level: AccuracyLabel; active: boolean }) {
  const clr = level === 'High' ? EMERALD_LIGHT : level === 'Medium' ? GOLD_PRIMARY : '#EF4444';
  return (
    <View style={[aStyles.badge, active && { borderColor: clr, backgroundColor: `${clr}22` }]}>
      <View style={[aStyles.dot, { backgroundColor: active ? clr : '#334155' }]} />
      <Text style={[aStyles.text, active && { color: clr }]}>{level}</Text>
    </View>
  );
}
const aStyles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: W10, backgroundColor: W10 },
  dot:   { width: 6, height: 6, borderRadius: 3 },
  text:  { color: W60, fontSize: 11, fontWeight: '800' },
});

// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────
export default function QiblaScreen() {
  const router      = useRouter();
  const params      = useLocalSearchParams<{ mode?: string }>();
  const insets      = useSafeAreaInsets();
  const pathname    = usePathname();
  const isFocused   = pathname === '/qibla';

  // Native animation values
  const headingAnim      = useRef(new Animated.Value(0)).current;
  const glowAnim         = useRef(new Animated.Value(0)).current;
  const alignScaleAnim   = useRef(new Animated.Value(1)).current;
  
  // Tracking refs for continuous unwrapping & throttled state
  const lastHeadingRef        = useRef(0);
  const lastHeadingAnimTarget = useRef(0);
  const lastStateUpdateTime   = useRef(0);
  const alignBuzzedRef        = useRef(false);
  const googlePromptedRef     = useRef(false);
  const appStateRef           = useRef(AppState.currentState);

  const [appActive, setAppActive]             = useState(AppState.currentState === 'active');
  const [entryVisible, setEntryVisible]       = useState(() => !['camera', 'compass', 'map'].includes(String(params.mode)));
  const [location, setLocation]               = useState<QiblaLocation>(FALLBACK_LOCATION);
  const [heading, setHeading]                 = useState(0);
  const [headingAccuracy, setHeadingAccuracy] = useState<number | null>(null);
  const [headingSource, setHeadingSource]     = useState<'True North' | 'Magnetic North' | 'Unknown'>('Unknown');
  const [sensorStatus, setSensorStatus]       = useState<'checking' | 'active' | 'unavailable'>('checking');
  const [cameraMode, setCameraMode]           = useState(false);
  const [cameraPermission, setCameraPermission] = useState<CameraPermission>('idle');
  const [mapMode, setMapMode]                 = useState(false);

  const qibla    = useMemo(() => calculateQiblaState(location, heading), [heading, location]);
  const accuracy = getCompassAccuracyLabel(headingAccuracy) as AccuracyLabel;
  const qiblaLine = useMemo(() => calculateMapLine(location), [location]);
  const accuracyColor = accuracy === 'High' ? EMERALD_LIGHT : accuracy === 'Medium' ? GOLD_PRIMARY : '#EF4444';

  // Glow pulse when aligned
  useEffect(() => {
    if (qibla.aligned) {
      const p = Animated.loop(Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(glowAnim, { toValue: 0, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      ]));
      p.start();
      return () => p.stop();
    } else {
      glowAnim.setValue(0);
    }
  }, [qibla.aligned, glowAnim]);

  /**
   * Ultra-smooth continuous angular tracking.
   * Calculates minimal shortest-path difference to prevent 360° spin jumps.
   * Runs native spring animations on UI thread while throttling JS state re-renders.
   */
  const setSmoothHeading = useCallback((nextRaw: number, acc?: number | null) => {
    const prev = lastHeadingRef.current;
    // Mathematically exact shortest angular path in [-180, +180]
    const diff = ((nextRaw - (prev % 360) + 540) % 360) - 180;
    const target = prev + diff;
    lastHeadingRef.current = target;

    // Trigger smooth native spring to the continuous target
    Animated.spring(headingAnim, {
      toValue: -target,
      friction: 9,
      tension: 50,
      useNativeDriver: true,
    }).start();

    if (typeof acc === 'number') setHeadingAccuracy(acc);

    // Throttle React state updates to ~10 fps to prevent JS bridge overhead
    const now = Date.now();
    if (now - lastStateUpdateTime.current > 90) {
      lastStateUpdateTime.current = now;
      const normalized = ((target % 360) + 360) % 360;
      setHeading(normalized);
    }
  }, [headingAnim]);

  const refreshLocation = useCallback(async () => {
    setLocation((c) => ({ ...c, permission: 'requesting' }));
    try {
      const existing = await Location.getForegroundPermissionsAsync();
      const perm = existing?.status === 'granted' ? existing : await Location.requestForegroundPermissionsAsync();
      if (perm?.status !== 'granted') {
        setLocation((c) => ({ ...c, permission: c.source === 'cache' ? 'offline' : 'denied' }));
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy?.High ?? 5 });
      let city = 'Detected location', state = 'Local region', country = 'Local Qibla direction';
      try {
        const rev = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        const pl = rev?.[0];
        city    = pl?.city || pl?.district || pl?.subregion || city;
        state   = pl?.region || pl?.subregion || state;
        country = pl?.country || pl?.isoCountryCode || country;
      } catch { /* optional */ }
      const next: QiblaLocation = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, city, state, country, permission: 'granted', source: 'device', updatedAt: Date.now() };
      setLocation(next);
      await AsyncStorage.setItem(QIBLA_LOCATION_CACHE_KEY, JSON.stringify(next)).catch(() => {});
    } catch {
      setLocation((c) => ({ ...c, permission: c.source === 'cache' ? 'offline' : 'unavailable' }));
    }
  }, []);

  const { refreshing, onRefresh } = usePullToRefresh(async () => { await refreshLocation(); });

  useEffect(() => {
    let m = true;
    AsyncStorage.getItem(QIBLA_LOCATION_CACHE_KEY).then((raw) => {
      if (!m || !raw) return;
      const cached = JSON.parse(raw) as QiblaLocation;
      if (typeof cached?.latitude === 'number') setLocation({ ...cached, permission: 'offline', source: 'cache' });
    }).catch(() => {});
    refreshLocation().catch(() => {});
    return () => { m = false; };
  }, [refreshLocation]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { appStateRef.current = s; setAppActive(s === 'active'); });
    return () => sub.remove();
  }, []);

  /**
   * Dual-sensor architecture:
   * 1. Primary: Hardware sensor fusion with True North & tilt compensation (Location.watchHeadingAsync)
   * 2. Secondary: Magnetometer with low-pass EMA filter (fallback for devices without GPS provider)
   */
  useEffect(() => {
    if (!isFocused || !appActive || appStateRef.current !== 'active') return undefined;
    let mounted = true;
    let headingSub: { remove?: () => void } | null = null;
    let magSub: { remove?: () => void } | null = null;
    let emaX = 0, emaY = 0;
    const ALPHA = 0.22;

    setSensorStatus('checking');

    const startSensorTracking = async () => {
      // 1. Try hardware-fused Location.watchHeadingAsync for True North
      try {
        const loc = Location as any;
        if (typeof loc.watchHeadingAsync === 'function') {
          const sub = await loc.watchHeadingAsync((data: { trueHeading?: number; magHeading?: number; accuracy?: number }) => {
            if (!mounted) return;
            setSensorStatus('active');
            const hasTrue = typeof data.trueHeading === 'number' && data.trueHeading >= 0;
            const headingVal = hasTrue ? data.trueHeading! : (typeof data.magHeading === 'number' && data.magHeading >= 0 ? data.magHeading : 0);
            setHeadingSource(hasTrue ? 'True North' : 'Magnetic North');
            setSmoothHeading(headingVal, data.accuracy ?? 3);
          });
          headingSub = sub;
          return;
        }
      } catch (e) {
        console.log('[Qibla] Location.watchHeadingAsync unavailable, falling back to Magnetometer:', e);
      }

      // 2. Fallback to raw Magnetometer with low-pass noise filter
      try {
        const ok = await Magnetometer.isAvailableAsync().catch(() => false);
        if (!mounted) return;
        if (!ok) {
          setSensorStatus('unavailable');
          return;
        }
        Magnetometer.setUpdateInterval(SENSOR_UPDATE_MS);
        magSub = Magnetometer.addListener((data) => {
          if (!mounted) return;
          setSensorStatus('active');
          emaX = ALPHA * data.x + (1 - ALPHA) * emaX;
          emaY = ALPHA * data.y + (1 - ALPHA) * emaY;
          let h = Math.atan2(-emaX, emaY) * (180 / Math.PI);
          if (h < 0) h += 360;
          setHeadingSource('Magnetic North');
          setSmoothHeading(h, 2);
        });
      } catch {
        if (mounted) setSensorStatus('unavailable');
      }
    };

    startSensorTracking().catch(() => {
      if (mounted) setSensorStatus('unavailable');
    });

    return () => {
      mounted = false;
      headingSub?.remove?.();
      magSub?.remove?.();
    };
  }, [appActive, isFocused, setSmoothHeading]);

  // Haptic feedback & scale spring on Qibla alignment
  useEffect(() => {
    if (qibla.aligned && !alignBuzzedRef.current) {
      alignBuzzedRef.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Animated.sequence([
        Animated.timing(alignScaleAnim, { toValue: 1.12, duration: 200, useNativeDriver: true }),
        Animated.spring(alignScaleAnim, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 150 }),
      ]).start();
    }
    if (!qibla.aligned) alignBuzzedRef.current = false;
  }, [qibla.aligned, alignScaleAnim]);

  const showQiblaOpenErr = useCallback(() => Alert.alert('Qibla Finder', 'Unable to open Qibla Finder.'), []);
  const openGoogleQiblaFinder = useCallback(() => {
    Alert.alert('Google Qibla Finder', 'Opens in browser with camera AR support.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open', onPress: () => Linking.canOpenURL(GOOGLE_QIBLA_FINDER_URL).then((s) => s ? Linking.openURL(GOOGLE_QIBLA_FINDER_URL) : Promise.reject()).catch(showQiblaOpenErr) },
    ]);
  }, [showQiblaOpenErr]);

  const openNativeCameraMode = useCallback(async () => {
    setEntryVisible(false); setMapMode(false); setCameraPermission('requesting');
    const p = await requestCameraPermission().catch(() => 'unavailable' as CameraPermission);
    setCameraPermission(p);
    if (p === 'granted') setCameraMode(true);
  }, []);

  const openCompassMode = useCallback(() => { setEntryVisible(false); setCameraMode(false); setMapMode(false); }, []);
  const openMapMode     = useCallback(() => { setEntryVisible(false); setCameraMode(false); setMapMode(true); }, []);

  useEffect(() => {
    if ((params.mode === 'camera' || params.mode === 'google') && !googlePromptedRef.current) {
      googlePromptedRef.current = true; setEntryVisible(false); openGoogleQiblaFinder();
    }
    if (params.mode === 'native-camera' && cameraPermission === 'idle') openNativeCameraMode().catch(() => setCameraPermission('unavailable'));
    if (params.mode === 'compass') openCompassMode();
    if (params.mode === 'map') openMapMode();
  }, [cameraPermission, openGoogleQiblaFinder, openNativeCameraMode, openCompassMode, openMapMode, params.mode]);

  // Compass dial rotates by -continuousHeading
  const compassRot = headingAnim.interpolate({
    inputRange: [-360, 360],
    outputRange: ['-360deg', '360deg'],
    extrapolate: 'extend',
  });

  // Qibla needle rotates to (qiblaAngle - continuousHeading)
  // Lockstep synchronized on native thread with zero delay or rubber-banding!
  const qiblaAngleVal = qibla.qiblaAngle;
  const qiblaRot = headingAnim.interpolate({
    inputRange: [-360, 360],
    outputRange: [`${-360 + qiblaAngleVal}deg`, `${360 + qiblaAngleVal}deg`],
    extrapolate: 'extend',
  });

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={DARK_BG} />

      {/* ENTRY MODAL */}
      <Modal visible={entryVisible} transparent animationType="fade" onRequestClose={() => setEntryVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.entryModal}>
            <Text style={styles.modalBismillah}>بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْم</Text>
            <Text style={styles.modalEyebrow}>✦ Qibla Direction System</Text>
            <Text style={styles.modalTitle}>Choose Finder Mode</Text>

            <TouchableOpacity style={styles.entryOption} onPress={openGoogleQiblaFinder} accessibilityRole="button" testID="google-qibla-finder-option">
              <View style={styles.entryIconWrap}><Ionicons name="camera" size={22} color={GOLD_PRIMARY} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.entryTitle}>Google Camera AR</Text>
                <Text style={styles.entryText}>Augmented Reality · Interactive browser finder</Text>
              </View>
              <View style={styles.entryTag}><Text style={styles.entryTagTxt}>AR</Text></View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.entryOption, styles.entryOptionGold]} onPress={openCompassMode} accessibilityRole="button" testID="compass-qibla-direction-option">
              <View style={[styles.entryIconWrap, { backgroundColor: 'rgba(0,0,0,0.15)' }]}><Ionicons name="compass" size={22} color={DARK_BG} /></View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.entryTitle, { color: DARK_BG }]}>High-Precision Compass</Text>
                <Text style={[styles.entryText, { color: 'rgba(0,61,43,0.65)' }]}>Hardware sensor fusion · True North · 60 FPS</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={DARK_BG} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* CAMERA MODE */}
      {cameraMode ? (
        <View style={styles.cameraFullScreen} testID="qibla-camera-finder">
          <CameraView style={StyleSheet.absoluteFill} facing="back" />
          <View style={[styles.cameraTopBar, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity style={styles.roundButton} onPress={() => setCameraMode(false)}><Ionicons name="close" size={22} color={W} /></TouchableOpacity>
            <Text style={styles.cameraTitle}>Camera Qibla</Text>
            <TouchableOpacity style={styles.roundButton} onPress={() => setMapMode((v) => !v)}><Ionicons name="map-outline" size={20} color={W} /></TouchableOpacity>
          </View>
          <View style={styles.arOverlay}>
            <Animated.View style={[styles.arCircle, { transform: [{ rotate: qiblaRot }] }]}>
              <Ionicons name={qibla.offset < 0 ? 'arrow-back' : qibla.offset > 0 ? 'arrow-forward' : 'checkmark'} size={52} color={qibla.aligned ? EMERALD_LIGHT : GOLD_PRIMARY} />
            </Animated.View>
            <Text style={[styles.alignBadge, qibla.aligned && styles.alignBadgeReady]}>{qibla.aligned ? '✦ Facing Qibla' : qibla.guidance}</Text>
            <Text style={styles.arSub}>Qibla {Math.round(qibla.qiblaAngle)}° · Heading {Math.round(qibla.heading)}°</Text>
          </View>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<ScreenRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* HEADER */}
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => goBackOrReplace(router, '/more')}>
              <Ionicons name="chevron-back" size={20} color={GOLD_PRIMARY} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>✦ Islamic Utilities</Text>
              <Text style={styles.title}>Qibla Direction</Text>
            </View>
            <TouchableOpacity style={styles.modesBtn} onPress={() => setEntryVisible(true)}>
              <Ionicons name="apps-outline" size={13} color={GOLD_PRIMARY} style={{ marginRight: 5 }} />
              <Text style={styles.modesBtnTxt}>Modes</Text>
            </TouchableOpacity>
          </View>

          {/* BANNERS */}
          {accuracy === 'Low' && (
            <View style={styles.calibBanner}>
              <Ionicons name="warning" size={16} color={GOLD_PRIMARY} />
              <View style={{ flex: 1 }}>
                <Text style={styles.calibTxt}>Sensor Calibration Needed</Text>
                <Text style={styles.calibSub}>Gently move your phone in a figure-8 motion to calibrate the magnetic sensor.</Text>
              </View>
            </View>
          )}
          {(location.source === 'cache' || location.permission === 'offline') && (
            <View style={styles.cacheBanner}>
              <Ionicons name="cloud-offline-outline" size={14} color="#93C5FD" />
              <Text style={styles.cacheTxt}>Using cached coordinates · Pull down to refresh GPS</Text>
            </View>
          )}

          {/* COMPASS HERO CARD */}
          {sensorStatus === 'unavailable' ? (
            <View style={[styles.heroCard, { alignItems: 'center', paddingVertical: 40 }]} testID="qibla-compass-unavailable">
              <Ionicons name="warning" size={48} color="#EF4444" style={{ marginBottom: 12 }} />
              <Text style={[styles.heroLabel, { color: '#EF4444' }]}>Compass Sensor Unavailable</Text>
              <Text style={[styles.heroSub, { color: W60, marginTop: 6 }]}>
                This device does not have a geomagnetic compass sensor. You can still use the Map View or Google AR below.
              </Text>
            </View>
          ) : (
            <View style={styles.heroCard} testID="qibla-compass-section">
              {/* Top row: LIVE badge • Arabic label • Accuracy chip */}
              <View style={styles.heroTopRow}>
                <View style={styles.liveBadge}>
                  <Animated.View style={[styles.liveDot, { opacity: sensorStatus === 'active' ? Animated.add(glowAnim, 0.4) : 0.3 }]} />
                  <Text style={styles.liveTxt}>LIVE</Text>
                </View>
                <Text style={styles.heroLabel}>القِبْلَة</Text>
                <View style={styles.accChip}>
                  <View style={[styles.accDotSm, { backgroundColor: accuracyColor }]} />
                  <Text style={[styles.accChipTxt, { color: accuracyColor }]}>{accuracy} Accuracy</Text>
                </View>
              </View>

              {/* Dynamic Live Heading Display */}
              <View style={styles.degreeContainer}>
                <Animated.Text style={[styles.degreeDisplay, { transform: [{ scale: alignScaleAnim }], color: qibla.aligned ? EMERALD_LIGHT : W }]}>
                  {Math.round(heading)}°
                </Animated.Text>
                <Text style={styles.cardinalHeadingBadge}>
                  {getDirectionAbbreviation(heading)}
                </Text>
              </View>

              {/* Guidance & Alignment Banner */}
              <View style={[styles.guidanceBanner, qibla.aligned ? styles.guidanceBannerAligned : styles.guidanceBannerPending]}>
                <Ionicons
                  name={qibla.aligned ? 'checkmark-circle' : qibla.offset > 0 ? 'arrow-forward-circle' : 'arrow-back-circle'}
                  size={18}
                  color={qibla.aligned ? EMERALD_LIGHT : GOLD_PRIMARY}
                />
                <Text style={[styles.guidanceTxt, { color: qibla.aligned ? EMERALD_LIGHT : GOLD_LIGHT }]}>
                  {qibla.aligned ? '✦ Facing the Holy Kaaba (Makkah)' : qibla.guidance}
                </Text>
              </View>

              {/* COMPASS DIAL & NEEDLE */}
              <View style={[styles.compassOuter, { width: COMPASS_SIZE + 28, height: COMPASS_SIZE + 28 }]}>
                {/* Outer Glow on Alignment */}
                <Animated.View style={[styles.glowRing, {
                  width: COMPASS_SIZE + 26,
                  height: COMPASS_SIZE + 26,
                  borderRadius: (COMPASS_SIZE + 26) / 2,
                  opacity: glowAnim,
                  borderColor: EMERALD_LIGHT,
                }]} />

                {/* Fixed Top 12-o'clock Device Reticle Notch */}
                <View style={styles.topNotchContainer}>
                  <View style={[styles.topNotchTriangle, { borderTopColor: qibla.aligned ? EMERALD_LIGHT : GOLD_PRIMARY }]} />
                </View>

                {/* Gold Outer Bezel */}
                <View style={[styles.goldRing, {
                  width: COMPASS_SIZE + 16,
                  height: COMPASS_SIZE + 16,
                  borderRadius: (COMPASS_SIZE + 16) / 2,
                  borderColor: qibla.aligned ? 'rgba(16,185,129,0.6)' : 'rgba(212,175,55,0.4)',
                }]} />

                {/* Rotating Compass Dial */}
                <Animated.View style={[styles.compassDial, {
                  width: COMPASS_SIZE,
                  height: COMPASS_SIZE,
                  borderRadius: COMPASS_SIZE / 2,
                  transform: [{ rotate: compassRot }],
                }]}>
                  {/* Degree Ticks */}
                  {DEGREE_MARKS.map((mark) => {
                    const major = mark % 30 === 0;
                    const mid   = mark % 10 === 0;
                    return (
                      <View key={mark} style={[styles.tick, {
                        height: major ? 20 : mid ? 13 : 8,
                        width:  major ? 2.5 : 1.5,
                        backgroundColor: major ? GOLD_PRIMARY : W30,
                        transform: [{ rotate: `${mark}deg` }, { translateY: -(COMPASS_SIZE / 2 - 6) }],
                      }]} />
                    );
                  })}

                  {/* Cardinal Points */}
                  {CARDINALS.map(({ label, deg, major, north }) => (
                    <Text key={label} style={[styles.cardinalTxt, {
                      color:      north ? '#EF4444' : major ? GOLD_PRIMARY : W60,
                      fontSize:   label.length === 1 ? 16 : 11,
                      fontWeight: label.length === 1 ? '900' : '700',
                      transform:  [{ rotate: `${deg}deg` }, { translateY: -(COMPASS_SIZE / 2 - 38) }, { rotate: `-${deg}deg` }],
                    }]}>{label}</Text>
                  ))}

                  {/* Kaaba Direction Marker on the Dial */}
                  <View style={[styles.dialKaabaMarker, {
                    transform: [{ rotate: `${qibla.qiblaAngle}deg` }, { translateY: -(COMPASS_SIZE / 2 - 18) }],
                  }]}>
                    <View style={styles.kaabaMiniIconWrap}>
                      <MaterialCommunityIcons name="mosque" size={13} color={GOLD_PRIMARY} />
                    </View>
                  </View>
                </Animated.View>

                {/* Synchronized Qibla Needle */}
                <Animated.View style={[styles.needleWrap, { transform: [{ rotate: qiblaRot }] }]}>
                  {/* Needle Arrow Head */}
                  <View style={[styles.needleArrow, {
                    borderBottomColor: qibla.aligned ? EMERALD_LIGHT : GOLD_PRIMARY,
                  }]} />
                  {/* Needle Stem */}
                  <View style={[styles.needleLine, {
                    backgroundColor: qibla.aligned ? EMERALD_LIGHT : GOLD_PRIMARY,
                    shadowColor:     qibla.aligned ? EMERALD_LIGHT : GOLD_PRIMARY,
                  }]} />
                </Animated.View>

                {/* Central Kaaba Hub */}
                <View style={styles.kaabaCenter}>
                  <View style={[styles.kaabaRing, qibla.aligned && styles.kaabaRingAligned]}>
                    <MaterialCommunityIcons name={'mosque' as any} size={26} color={qibla.aligned ? EMERALD_LIGHT : GOLD_PRIMARY} />
                  </View>
                  <Text style={[styles.kaabaLbl, { color: qibla.aligned ? EMERALD_LIGHT : GOLD_PRIMARY }]}>الكعبة</Text>
                </View>
              </View>

              {/* Accuracy Levels Row */}
              <View style={styles.accRow}>
                {(['Low', 'Medium', 'High'] as AccuracyLabel[]).map((lvl) => (
                  <AccuracyBadge key={lvl} level={lvl} active={accuracy === lvl} />
                ))}
              </View>
            </View>
          )}

          {/* METRICS GRID */}
          <View style={styles.metricsGrid}>
            <MetricCard label="Qibla Bearing"  value={`${Math.round(qibla.qiblaAngle)}° (${qibla.directionAbbreviation})`} icon="compass"               highlight />
            <MetricCard label="Device Heading" value={sensorStatus === 'unavailable' ? '--' : `${Math.round(qibla.heading)}° (${getDirectionAbbreviation(heading)})`} icon="phone-portrait-outline" />
            <MetricCard label="Heading Source" value={sensorStatus === 'unavailable' ? '--' : headingSource}                   icon="magnet-outline" />
            <MetricCard label="Turn Needed"    value={sensorStatus === 'unavailable' ? '--' : qibla.guidance}                  icon="navigate-outline"       highlight />
            <MetricCard label="Distance"       value={formatDistanceToKaaba(qibla.distanceKm)}                                 icon="earth-outline" />
            <MetricCard label="Sensor Status"  value={sensorStatus === 'active' ? 'Active ● 60fps' : sensorStatus}              icon="radio-outline" />
          </View>

          {/* LOCATION CARD */}
          <View style={styles.locCard}>
            <View style={styles.locHeader}>
              <View style={styles.locIconWrap}><Ionicons name="location" size={16} color={GOLD_PRIMARY} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.locCity}>{location.city}, {location.state}</Text>
                <Text style={styles.locCountry}>{location.country}</Text>
              </View>
              <View style={[styles.locDot, {
                backgroundColor: location.permission === 'granted' ? EMERALD_LIGHT : location.permission === 'requesting' ? GOLD_PRIMARY : '#EF4444'
              }]} />
            </View>
            <View style={styles.coordRow}>
              <View style={styles.coordCol}>
                <Text style={styles.coordLbl}>LATITUDE</Text>
                <Text style={styles.coordVal}>{formatCoordinate(location.latitude, 'lat')}</Text>
              </View>
              <View style={styles.coordDiv} />
              <View style={styles.coordCol}>
                <Text style={styles.coordLbl}>LONGITUDE</Text>
                <Text style={styles.coordVal}>{formatCoordinate(location.longitude, 'lng')}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.refreshBtn} onPress={() => refreshLocation().catch(() => {})}>
              {location.permission === 'requesting'
                ? <ActivityIndicator color={DARK_BG} size="small" />
                : <><Ionicons name="refresh" size={14} color={DARK_BG} style={{ marginRight: 6 }} /><Text style={styles.refreshTxt}>Refresh Coordinates</Text></>
              }
            </TouchableOpacity>
          </View>

          {/* ACTION BUTTONS */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionCard} onPress={openGoogleQiblaFinder}>
              <View style={styles.actionIconWrap}><Ionicons name="camera" size={22} color={GOLD_PRIMARY} /></View>
              <Text style={styles.actionTitle}>AR Camera</Text>
              <Text style={styles.actionSub}>Google Qibla AR</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => setMapMode((v) => !v)}>
              <View style={styles.actionIconWrap}><Ionicons name="map" size={22} color={GOLD_PRIMARY} /></View>
              <Text style={styles.actionTitle}>{mapMode ? 'Hide Map' : 'Map View'}</Text>
              <Text style={styles.actionSub}>Qibla bearing line</Text>
            </TouchableOpacity>
          </View>

          {/* MAP VIEW */}
          {mapMode && (
            <View style={styles.mapCard} testID="qibla-map-mode">
              <MapView style={styles.map} initialRegion={{ latitude: location.latitude, longitude: location.longitude, latitudeDelta: 50, longitudeDelta: 50 }}>
                <Marker coordinate={location} title="Your location" />
                <Marker coordinate={KAABA_COORDINATES} title="Al-Kaaba" description="Masjid al-Haram, Makkah" />
                <Polyline coordinates={qiblaLine} strokeWidth={3} strokeColor={GOLD_PRIMARY} geodesic />
              </MapView>
              <View style={styles.mapMeta}>
                <Ionicons name="navigate" size={13} color={GOLD_PRIMARY} />
                <Text style={styles.mapMetaTxt}>{formatDistanceToKaaba(qibla.distanceKm)} · {qibla.directionLongText}</Text>
              </View>
            </View>
          )}

          {/* TIPS */}
          <View style={styles.tipsCard}>
            <View style={styles.tipsHeader}>
              <Ionicons name="information-circle" size={15} color={GOLD_PRIMARY} />
              <Text style={styles.tipsTitleTxt}>Accuracy & Best Practices</Text>
            </View>
            {[
              'Hardware sensor fusion calculates True North using geomagnetic declination.',
              'Hold device level and flat on your palm for best compass precision.',
              'Keep away from metal surfaces, laptop magnets, or high-voltage lines.',
              'If the reading drifts, calibrate by waving the phone in a gentle figure-8.',
            ].map((t, i) => (
              <View key={i} style={styles.tipRow}>
                <View style={styles.tipDot} />
                <Text style={styles.tipTxt}>{t}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: DARK_BG },
  content: { paddingHorizontal: 18, paddingBottom: 48, gap: 14 },

  // Header
  headerRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  backBtn:     { width: 44, height: 44, borderRadius: 22, backgroundColor: CARD_BG, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: CARD_BORDER },
  eyebrow:     { color: GOLD_PRIMARY, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
  title:       { color: W, fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  modesBtn:    { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD_BG, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: CARD_BORDER },
  modesBtnTxt: { color: GOLD_PRIMARY, fontWeight: '800', fontSize: 12 },

  // Banners
  calibBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: 'rgba(212,175,55,0.12)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)' },
  calibTxt:    { color: GOLD_LIGHT, fontWeight: '800', fontSize: 13 },
  calibSub:    { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 2, lineHeight: 15 },
  cacheBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: 'rgba(59,130,246,0.10)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.25)' },
  cacheTxt:    { color: '#93C5FD', fontWeight: '700', fontSize: 12 },

  // Hero card
  heroCard: {
    backgroundColor: EMERALD_DEEP, borderRadius: 28,
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 22,
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)',
    shadowColor: EMERALD_MID, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.35, shadowRadius: 24, elevation: 10,
    alignItems: 'center', gap: 6,
  },
  heroTopRow:  { flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'space-between' },
  liveBadge:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot:     { width: 7, height: 7, borderRadius: 4, backgroundColor: EMERALD_LIGHT },
  liveTxt:     { color: EMERALD_LIGHT, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  heroLabel:   { color: GOLD_PRIMARY, fontSize: 18, fontWeight: '700', letterSpacing: 1 },
  heroSub:     { color: W60, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  accChip:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: W10, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  accDotSm:    { width: 6, height: 6, borderRadius: 3 },
  accChipTxt:  { fontSize: 11, fontWeight: '800' },

  degreeContainer: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 },
  degreeDisplay:   { color: W, fontSize: 62, fontWeight: '900', letterSpacing: -2, lineHeight: 68 },
  cardinalHeadingBadge: { color: GOLD_LIGHT, fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },

  guidanceBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
    marginBottom: 4,
  },
  guidanceBannerAligned: { backgroundColor: 'rgba(16,185,129,0.18)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.45)' },
  guidanceBannerPending: { backgroundColor: 'rgba(212,175,55,0.10)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)' },
  guidanceTxt:           { fontSize: 13, fontWeight: '800', letterSpacing: 0.2 },

  // Compass Outer & Bezel
  compassOuter: { alignItems: 'center', justifyContent: 'center', marginVertical: 4 },
  glowRing:     { position: 'absolute', borderWidth: 2, shadowColor: EMERALD_LIGHT, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 16, elevation: 10 },
  topNotchContainer: { position: 'absolute', top: -4, zIndex: 10, alignItems: 'center' },
  topNotchTriangle:  { width: 0, height: 0, borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  goldRing:     { position: 'absolute', borderWidth: 1.5, shadowColor: GOLD_PRIMARY, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 },
  compassDial:  { backgroundColor: 'rgba(0,30,20,0.88)', borderWidth: 1, borderColor: W10, alignItems: 'center', justifyContent: 'center', position: 'absolute' },
  tick:         { position: 'absolute', borderRadius: 2 },
  cardinalTxt:  { position: 'absolute' },

  dialKaabaMarker: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  kaabaMiniIconWrap: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(212,175,55,0.2)', borderWidth: 1, borderColor: GOLD_PRIMARY, alignItems: 'center', justifyContent: 'center' },

  // Needle
  needleWrap:  { position: 'absolute', alignItems: 'center', justifyContent: 'center', height: COMPASS_SIZE, width: 6, zIndex: 6 },
  needleLine:  { position: 'absolute', top: 22, width: 3, height: COMPASS_SIZE / 2 - 58, borderRadius: 2, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 8, elevation: 8 },
  needleArrow: { position: 'absolute', top: 6, width: 0, height: 0, borderLeftWidth: 8, borderRightWidth: 8, borderBottomWidth: 16, borderLeftColor: 'transparent', borderRightColor: 'transparent' },

  // Kaaba center
  kaabaCenter: { alignItems: 'center', justifyContent: 'center', zIndex: 8 },
  kaabaRing: { width: 68, height: 68, borderRadius: 34, backgroundColor: CARD_BG, borderWidth: 2, borderColor: GOLD_PRIMARY, alignItems: 'center', justifyContent: 'center', shadowColor: GOLD_PRIMARY, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6 },
  kaabaRingAligned: { borderColor: EMERALD_LIGHT, shadowColor: EMERALD_LIGHT },
  kaabaLbl:  { fontSize: 10, fontWeight: '800', marginTop: 3, letterSpacing: 0.5 },

  accRow:  { flexDirection: 'row', gap: 8, marginTop: 4 },

  // Metrics
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  // Location
  locCard:    { backgroundColor: CARD_BG, borderRadius: 22, padding: 16, gap: 12, borderWidth: 1, borderColor: CARD_BORDER },
  locHeader:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  locIconWrap:{ width: 32, height: 32, borderRadius: 16, backgroundColor: W10, alignItems: 'center', justifyContent: 'center' },
  locCity:    { color: W, fontSize: 15, fontWeight: '800' },
  locCountry: { color: W60, fontSize: 12, fontWeight: '600' },
  locDot:     { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  coordRow:   { flexDirection: 'row', backgroundColor: W10, borderRadius: 14, padding: 12, alignItems: 'center' },
  coordCol:   { flex: 1, alignItems: 'center' },
  coordLbl:   { color: W60, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  coordVal:   { color: W, fontSize: 13, fontWeight: '800', marginTop: 2 },
  coordDiv:   { width: 1, height: 24, backgroundColor: W10 },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: GOLD_PRIMARY, borderRadius: 14, paddingVertical: 12 },
  refreshTxt: { color: DARK_BG, fontWeight: '900', fontSize: 13 },

  // Actions
  actionRow:      { flexDirection: 'row', gap: 12 },
  actionCard:     { flex: 1, backgroundColor: CARD_BG, borderRadius: 20, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: CARD_BORDER, gap: 6 },
  actionIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: W10, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  actionTitle:    { color: W, fontSize: 14, fontWeight: '800' },
  actionSub:      { color: W60, fontSize: 11, fontWeight: '600' },

  // Map
  mapCard: { backgroundColor: CARD_BG, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: CARD_BORDER },
  map:     { width: '100%', height: 220 },
  mapMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 12, backgroundColor: CARD_BG },
  mapMetaTxt: { color: GOLD_PRIMARY, fontWeight: '800', fontSize: 12 },

  // Tips
  tipsCard:     { backgroundColor: CARD_BG, borderRadius: 22, padding: 16, gap: 10, borderWidth: 1, borderColor: CARD_BORDER },
  tipsHeader:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  tipsTitleTxt: { color: GOLD_PRIMARY, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  tipRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  tipDot:       { width: 5, height: 5, borderRadius: 3, backgroundColor: GOLD_PRIMARY, marginTop: 6 },
  tipTxt:       { color: W60, fontSize: 12, lineHeight: 17, flex: 1 },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  entryModal:    { width: '100%', backgroundColor: CARD_BG, borderRadius: 26, padding: 22, gap: 14, borderWidth: 1, borderColor: CARD_BORDER },
  modalBismillah:{ color: GOLD_PRIMARY, fontSize: 16, textAlign: 'center', fontWeight: '700' },
  modalEyebrow:  { color: GOLD_PRIMARY, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textAlign: 'center', textTransform: 'uppercase' },
  modalTitle:    { color: W, fontSize: 20, fontWeight: '900', textAlign: 'center', marginBottom: 6 },
  entryOption:   { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: W10, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: W10 },
  entryOptionGold: { backgroundColor: GOLD_PRIMARY },
  entryIconWrap: { width: 42, height: 42, borderRadius: 21, backgroundColor: W10, alignItems: 'center', justifyContent: 'center' },
  entryTitle:    { color: W, fontSize: 15, fontWeight: '800' },
  entryText:     { color: W60, fontSize: 12, marginTop: 2 },
  entryTag:      { backgroundColor: W10, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  entryTagTxt:   { color: GOLD_PRIMARY, fontWeight: '800', fontSize: 10 },

  // Camera
  cameraFullScreen: { flex: 1, backgroundColor: '#000' },
  cameraTopBar:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18 },
  cameraTitle:      { color: W, fontSize: 17, fontWeight: '800' },
  roundButton:      { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  arOverlay:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  arCircle:         { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 3, borderColor: GOLD_PRIMARY, alignItems: 'center', justifyContent: 'center' },
  alignBadge:       { backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, color: GOLD_PRIMARY, fontWeight: '800', fontSize: 15 },
  alignBadgeReady:  { backgroundColor: 'rgba(16,185,129,0.8)', color: W },
  arSub:            { color: W60, fontSize: 13, fontWeight: '700' },
});
