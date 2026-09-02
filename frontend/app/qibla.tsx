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
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import {
  KAABA_COORDINATES,
  QIBLA_LOCATION_CACHE_KEY,
  calculateMapLine,
  calculateQiblaState,
  formatDistanceToKaaba,
  getCompassAccuracyLabel,
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
const SENSOR_UPDATE_MS = 80;
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

  const headingAnim      = useRef(new Animated.Value(0)).current;
  const qiblaAnim        = useRef(new Animated.Value(0)).current;
  const glowAnim         = useRef(new Animated.Value(0)).current;
  const alignScaleAnim   = useRef(new Animated.Value(1)).current;
  const lastHeadingRef   = useRef(0);
  const alignBuzzedRef   = useRef(false);
  const googlePromptedRef = useRef(false);
  const appStateRef      = useRef(AppState.currentState);

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
        Animated.timing(glowAnim, { toValue: 1, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(glowAnim, { toValue: 0, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      ]));
      p.start();
      return () => p.stop();
    } else {
      glowAnim.setValue(0);
    }
  }, [qibla.aligned, glowAnim]);

  const setSmoothHeading = useCallback((next: number, acc?: number | null) => {
    const prev = lastHeadingRef.current;
    let target = next;
    const delta = target - prev;
    if (delta > 180) target -= 360;
    if (delta < -180) target += 360;
    lastHeadingRef.current = target;
    setHeading(((target % 360) + 360) % 360);
    if (typeof acc === 'number') setHeadingAccuracy(acc);
    Animated.timing(headingAnim, { toValue: -target, duration: SENSOR_UPDATE_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
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

  // Magnetometer with EMA noise filter
  useEffect(() => {
    if (!isFocused || !appActive || appStateRef.current !== 'active') return undefined;
    let mounted = true;
    let sub: { remove?: () => void } | null = null;
    let emaX = 0, emaY = 0;
    const ALPHA = 0.22;
    setSensorStatus('checking');
    Magnetometer.isAvailableAsync().then((ok) => {
      if (!mounted) return;
      if (!ok) { setSensorStatus('unavailable'); return; }
      Magnetometer.setUpdateInterval(SENSOR_UPDATE_MS);
      sub = Magnetometer.addListener((data) => {
        if (!mounted) return;
        setSensorStatus('active');
        emaX = ALPHA * data.x + (1 - ALPHA) * emaX;
        emaY = ALPHA * data.y + (1 - ALPHA) * emaY;
        let h = Math.atan2(-emaX, emaY) * (180 / Math.PI);
        if (h < 0) h += 360;
        setHeadingSource('Magnetic North');
        setSmoothHeading(h, 3);
      });
    }).catch(() => { if (mounted) setSensorStatus('unavailable'); });
    return () => { mounted = false; sub?.remove?.(); };
  }, [appActive, isFocused, setSmoothHeading]);

  useEffect(() => {
    Animated.timing(qiblaAnim, { toValue: qibla.offset, duration: 120, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    if (qibla.aligned && !alignBuzzedRef.current) {
      alignBuzzedRef.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Animated.sequence([
        Animated.timing(alignScaleAnim, { toValue: 1.12, duration: 200, useNativeDriver: true }),
        Animated.spring(alignScaleAnim, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 150 }),
      ]).start();
    }
    if (!qibla.aligned) alignBuzzedRef.current = false;
  }, [qibla.aligned, qibla.offset, qiblaAnim, alignScaleAnim]);

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

  const compassRot = headingAnim.interpolate({ inputRange: [-720, 720], outputRange: ['-720deg', '720deg'] });
  const qiblaRot   = qiblaAnim.interpolate({ inputRange: [-180, 180], outputRange: ['-180deg', '180deg'] });

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={DARK_BG} />

      {/* ENTRY MODAL */}
      <Modal visible={entryVisible} transparent animationType="fade" onRequestClose={() => setEntryVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.entryModal}>
            <Text style={styles.modalBismillah}>بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْم</Text>
            <Text style={styles.modalEyebrow}>✦ Qibla System</Text>
            <Text style={styles.modalTitle}>Choose Mode</Text>

            <TouchableOpacity style={styles.entryOption} onPress={openGoogleQiblaFinder} accessibilityRole="button" testID="google-qibla-finder-option">
              <View style={styles.entryIconWrap}><Ionicons name="camera" size={22} color={GOLD_PRIMARY} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.entryTitle}>Google Camera AR</Text>
                <Text style={styles.entryText}>Augmented Reality · Internet required</Text>
              </View>
              <View style={styles.entryTag}><Text style={styles.entryTagTxt}>AR</Text></View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.entryOption, styles.entryOptionGold]} onPress={openCompassMode} accessibilityRole="button" testID="compass-qibla-direction-option">
              <View style={[styles.entryIconWrap, { backgroundColor: 'rgba(0,0,0,0.15)' }]}><Ionicons name="compass" size={22} color={DARK_BG} /></View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.entryTitle, { color: DARK_BG }]}>Live Compass</Text>
                <Text style={[styles.entryText, { color: 'rgba(0,61,43,0.65)' }]}>Magnetometer · Offline · Precise</Text>
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
              <Text style={styles.eyebrow}>✦ Qibla System</Text>
              <Text style={styles.title}>Kaaba Direction</Text>
            </View>
            <TouchableOpacity style={styles.modesBtn} onPress={() => setEntryVisible(true)}>
              <Ionicons name="apps-outline" size={13} color={GOLD_PRIMARY} style={{ marginRight: 5 }} />
              <Text style={styles.modesBtnTxt}>Modes</Text>
            </TouchableOpacity>
          </View>

          {/* BANNERS */}
          {accuracy === 'Low' && (
            <View style={styles.calibBanner}>
              <Ionicons name="warning" size={15} color={GOLD_PRIMARY} />
              <Text style={styles.calibTxt}>Move phone in figure‑8 motion to calibrate</Text>
            </View>
          )}
          {(location.source === 'cache' || location.permission === 'offline') && (
            <View style={styles.cacheBanner}>
              <Ionicons name="cloud-offline-outline" size={14} color="#93C5FD" />
              <Text style={styles.cacheTxt}>Using last known location</Text>
            </View>
          )}

          {/* COMPASS HERO */}
          {sensorStatus === 'unavailable' ? (
            <View style={[styles.heroCard, { alignItems: 'center', paddingVertical: 40 }]} testID="qibla-compass-unavailable">
              <Ionicons name="warning" size={48} color="#EF4444" style={{ marginBottom: 12 }} />
              <Text style={[styles.heroLabel, { color: '#EF4444' }]}>Compass Unavailable</Text>
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
                  <Text style={[styles.accChipTxt, { color: accuracyColor }]}>{accuracy}</Text>
                </View>
              </View>

              {/* Big degree */}
              <Animated.Text style={[styles.degreeDisplay, { transform: [{ scale: alignScaleAnim }], color: qibla.aligned ? EMERALD_LIGHT : W }]}>
                {Math.round(qibla.qiblaAngle)}°
              </Animated.Text>

              {/* Guidance */}
              <Text style={[styles.guidanceTxt, { color: qibla.aligned ? EMERALD_LIGHT : GOLD_LIGHT }]}>
                {qibla.aligned ? '✦ You are facing the Qibla' : qibla.guidance}
              </Text>

              {/* COMPASS */}
              <View style={[styles.compassOuter, { width: COMPASS_SIZE + 24, height: COMPASS_SIZE + 24 }]}>
                {/* Gold outer ring */}
                <View style={[styles.goldRing, { width: COMPASS_SIZE + 16, height: COMPASS_SIZE + 16, borderRadius: (COMPASS_SIZE + 16) / 2 }]} />

                {/* Rotating dial */}
                <Animated.View style={[styles.compassDial, { width: COMPASS_SIZE, height: COMPASS_SIZE, borderRadius: COMPASS_SIZE / 2, transform: [{ rotate: compassRot }] }]}>
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
                  {CARDINALS.map(({ label, deg, major, north }) => (
                    <Text key={label} style={[styles.cardinalTxt, {
                      color:      north ? '#EF4444' : major ? GOLD_PRIMARY : W60,
                      fontSize:   label.length === 1 ? 16 : 11,
                      fontWeight: label.length === 1 ? '900' : '700',
                      transform:  [{ rotate: `${deg}deg` }, { translateY: -(COMPASS_SIZE / 2 - 38) }, { rotate: `-${deg}deg` }],
                    }]}>{label}</Text>
                  ))}
                </Animated.View>

                {/* Qibla needle */}
                <Animated.View style={[styles.needleWrap, { transform: [{ rotate: qiblaRot }] }]}>
                  <View style={[styles.needleArrow, { borderBottomColor: qibla.aligned ? EMERALD_LIGHT : GOLD_PRIMARY }]} />
                  <View style={[styles.needleLine, {
                    backgroundColor: qibla.aligned ? EMERALD_LIGHT : GOLD_PRIMARY,
                    shadowColor:     qibla.aligned ? EMERALD_LIGHT : GOLD_PRIMARY,
                  }]} />
                </Animated.View>

                {/* Kaaba center */}
                <View style={styles.kaabaCenter}>
                  <View style={styles.kaabaRing}>
                    <MaterialCommunityIcons name={'mosque' as any} size={26} color={GOLD_PRIMARY} />
                  </View>
                  <Text style={styles.kaabaLbl}>الكعبة</Text>
                </View>
              </View>

              {/* Accuracy pills */}
              <View style={styles.accRow}>
                {(['Low', 'Medium', 'High'] as AccuracyLabel[]).map((lvl) => (
                  <AccuracyBadge key={lvl} level={lvl} active={accuracy === lvl} />
                ))}
              </View>
            </View>
          )}

          {/* METRICS GRID */}
          <View style={styles.metricsGrid}>
            <MetricCard label="Qibla Bearing"  value={`${Math.round(qibla.qiblaAngle)}°`}                                      icon="compass"               highlight />
            <MetricCard label="Device Heading" value={sensorStatus === 'unavailable' ? '--' : `${Math.round(qibla.heading)}°`} icon="phone-portrait-outline" />
            <MetricCard label="Heading Source" value={sensorStatus === 'unavailable' ? '--' : headingSource}                   icon="magnet-outline" />
            <MetricCard label="Turn Direction" value={sensorStatus === 'unavailable' ? '--' : qibla.guidance}                  icon="navigate-outline"       highlight />
            <MetricCard label="Distance"       value={formatDistanceToKaaba(qibla.distanceKm)}                                 icon="earth-outline" />
            <MetricCard label="Sensor"         value={sensorStatus === 'active' ? 'Live ●' : sensorStatus}                    icon="radio-outline" />
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
                : <><Ionicons name="refresh" size={14} color={DARK_BG} style={{ marginRight: 6 }} /><Text style={styles.refreshTxt}>Refresh Location</Text></>
              }
            </TouchableOpacity>
          </View>

          {/* ACTION ROW */}
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

          {/* MAP */}
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
              <Text style={styles.tipsTitleTxt}>Performance & Accuracy</Text>
            </View>
            {[
              'Sensor updates at 80ms with exponential noise filter for smooth readings.',
              'GPS uses high-accuracy mode for precise Qibla calculation.',
              'Location and bearing cached for offline use.',
              'Hold phone flat and level for best compass accuracy.',
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
  calibBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: 'rgba(212,175,55,0.10)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)' },
  calibTxt:    { color: GOLD_LIGHT, fontWeight: '700', fontSize: 13, flex: 1 },
  cacheBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: 'rgba(59,130,246,0.10)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.25)' },
  cacheTxt:    { color: '#93C5FD', fontWeight: '700', fontSize: 13 },

  // Hero card
  heroCard: {
    backgroundColor: EMERALD_DEEP, borderRadius: 28,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24,
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)',
    shadowColor: EMERALD_MID, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.35, shadowRadius: 24, elevation: 10,
    alignItems: 'center', gap: 8,
  },
  heroTopRow:  { flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'space-between' },
  liveBadge:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot:     { width: 7, height: 7, borderRadius: 4, backgroundColor: EMERALD_LIGHT },
  liveTxt:     { color: EMERALD_LIGHT, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  heroLabel:   { color: GOLD_PRIMARY, fontSize: 18, fontWeight: '700', letterSpacing: 1 },
  heroSub:     { color: W60, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  accChip:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: W10, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  accDotSm:    { width: 6, height: 6, borderRadius: 3 },
  accChipTxt:  { fontSize: 11, fontWeight: '800' },

  degreeDisplay: { color: W, fontSize: 72, fontWeight: '900', letterSpacing: -2, lineHeight: 78 },
  guidanceTxt:   { fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },

  // Compass
  compassOuter: { alignItems: 'center', justifyContent: 'center', marginVertical: 8 },
  goldRing: { position: 'absolute', borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.5)', shadowColor: GOLD_PRIMARY, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 },
  compassDial: { backgroundColor: 'rgba(0,30,20,0.85)', borderWidth: 1, borderColor: W10, alignItems: 'center', justifyContent: 'center', position: 'absolute' },
  tick:         { position: 'absolute', borderRadius: 2 },
  cardinalTxt:  { position: 'absolute' },

  // Needle
  needleWrap:  { position: 'absolute', alignItems: 'center', justifyContent: 'center', height: COMPASS_SIZE, width: 4 },
  needleLine:  { position: 'absolute', top: 18, width: 3, height: COMPASS_SIZE / 2 - 52, borderRadius: 2, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 8, elevation: 8 },
  needleArrow: { position: 'absolute', top: 4, width: 0, height: 0, borderLeftWidth: 7, borderRightWidth: 7, borderBottomWidth: 14, borderLeftColor: 'transparent', borderRightColor: 'transparent' },

  // Kaaba center
  kaabaCenter: { alignItems: 'center', justifyContent: 'center' },
  kaabaRing: { width: 68, height: 68, borderRadius: 34, backgroundColor: CARD_BG, borderWidth: 2, borderColor: GOLD_PRIMARY, alignItems: 'center', justifyContent: 'center', shadowColor: GOLD_PRIMARY, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6 },
  kaabaLbl:  { color: GOLD_PRIMARY, fontSize: 10, fontWeight: '800', marginTop: 3, letterSpacing: 0.5 },

  accRow:  { flexDirection: 'row', gap: 8, marginTop: 4 },

  // Metrics
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  // Location
  locCard:    { backgroundColor: CARD_BG, borderRadius: 22, padding: 16, gap: 12, borderWidth: 1, borderColor: CARD_BORDER },
  locHeader:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  locIconWrap:{ width: 34, height: 34, borderRadius: 17, backgroundColor: GOLD_GLOW, alignItems: 'center', justifyContent: 'center' },
  locCity:    { color: W, fontWeight: '800', fontSize: 15 },
  locCountry: { color: W60, fontWeight: '600', fontSize: 12, marginTop: 2 },
  locDot:     { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  coordRow:   { flexDirection: 'row', alignItems: 'center' },
  coordCol:   { flex: 1, alignItems: 'center' },
  coordDiv:   { width: 1, height: 30, backgroundColor: CARD_BORDER },
  coordLbl:   { color: W30, fontSize: 9, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 },
  coordVal:   { color: GOLD_LIGHT, fontSize: 12, fontWeight: '700' },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: GOLD_PRIMARY, borderRadius: 14, paddingVertical: 12 },
  refreshTxt: { color: DARK_BG, fontWeight: '900', fontSize: 13 },

  // Action row
  actionRow:     { flexDirection: 'row', gap: 12 },
  actionCard:    { flex: 1, backgroundColor: CARD_BG, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: CARD_BORDER, alignItems: 'center', gap: 6 },
  actionIconWrap:{ width: 46, height: 46, borderRadius: 23, backgroundColor: GOLD_GLOW, alignItems: 'center', justifyContent: 'center' },
  actionTitle:   { color: W, fontWeight: '900', fontSize: 13, textAlign: 'center' },
  actionSub:     { color: W60, fontSize: 11, fontWeight: '600', textAlign: 'center' },

  // Map
  mapCard:    { borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: CARD_BORDER },
  map:        { height: 300 },
  mapMeta:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: CARD_BG, paddingHorizontal: 16, paddingVertical: 12 },
  mapMetaTxt: { color: GOLD_LIGHT, fontWeight: '800', fontSize: 13 },

  // Tips
  tipsCard:     { backgroundColor: 'rgba(212,175,55,0.06)', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: 'rgba(212,175,55,0.18)', gap: 10 },
  tipsHeader:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tipsTitleTxt: { color: GOLD_LIGHT, fontWeight: '900', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.8 },
  tipRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  tipDot:       { width: 5, height: 5, borderRadius: 3, backgroundColor: GOLD_PRIMARY, marginTop: 5 },
  tipTxt:       { color: W60, fontSize: 12, fontWeight: '600', flex: 1, lineHeight: 18 },

  // Camera
  cameraFullScreen: { flex: 1, backgroundColor: '#020617' },
  cameraTopBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 10, backgroundColor: 'rgba(0,0,0,0.40)' },
  roundButton:  { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
  cameraTitle:  { color: W, fontWeight: '900', fontSize: 16 },
  arOverlay:    { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  arCircle:     { width: 130, height: 130, borderRadius: 65, borderWidth: 2.5, borderColor: GOLD_PRIMARY, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,61,43,0.55)' },
  alignBadge:      { color: W, fontSize: 20, fontWeight: '900', marginTop: 22, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 30, backgroundColor: 'rgba(0,0,0,0.65)', overflow: 'hidden' },
  alignBadgeReady: { backgroundColor: EMERALD_MID },
  arSub:        { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '800', marginTop: 8 },

  // Entry Modal
  modalBackdrop:   { flex: 1, backgroundColor: 'rgba(0,10,6,0.88)', justifyContent: 'flex-end', padding: 16 },
  entryModal:      { backgroundColor: CARD_BG, borderRadius: 30, padding: 24, gap: 14, borderWidth: 1, borderColor: CARD_BORDER },
  modalBismillah:  { color: GOLD_PRIMARY, fontSize: 18, fontWeight: '700', textAlign: 'center', letterSpacing: 1 },
  modalEyebrow:    { color: GOLD_PRIMARY, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, textAlign: 'center' },
  modalTitle:      { color: W, fontSize: 26, fontWeight: '900', textAlign: 'center' },
  entryOption:     { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 20, padding: 16, backgroundColor: W10, borderWidth: 1, borderColor: CARD_BORDER },
  entryOptionGold: { backgroundColor: GOLD_PRIMARY, borderColor: GOLD_PRIMARY },
  entryIconWrap:   { width: 50, height: 50, borderRadius: 25, backgroundColor: GOLD_GLOW, alignItems: 'center', justifyContent: 'center' },
  entryTitle:      { color: W, fontSize: 16, fontWeight: '900' },
  entryText:       { color: W60, fontSize: 12, fontWeight: '600', marginTop: 2 },
  entryTag:        { backgroundColor: GOLD_GLOW, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: CARD_BORDER },
  entryTagTxt:     { color: GOLD_LIGHT, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
});
