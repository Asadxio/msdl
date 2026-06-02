import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  Dimensions,
  Easing,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
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

const SENSOR_UPDATE_MS = 120;
const COMPASS_SIZE = Math.min(Dimensions.get('window').width - 44, 340);
const DEGREE_MARKS = Array.from({ length: 72 }, (_, index) => index * 5);

declare const require: ((moduleName: string) => any) | undefined;

function safeRequire(moduleName: string) {
  try {
    return typeof require === 'function' ? require(moduleName) : null;
  } catch {
    return null;
  }
}

function getExpoLocationModule() {
  return safeRequire('expo-location');
}

function getMagnetometerModule() {
  return safeRequire('expo-sensors')?.Magnetometer;
}

function getCameraModule() {
  return safeRequire('expo-camera');
}

function getMapModule() {
  return safeRequire('react-native-maps');
}

function getHapticsModule() {
  return safeRequire('expo-haptics');
}

function headingFromMagnetometer(sample: { x: number; y: number }) {
  let angle = Math.atan2(sample.y, sample.x) * (180 / Math.PI);
  angle = angle >= 0 ? angle : angle + 360;
  return (450 - angle) % 360;
}

function formatCoordinate(value: number, axis: 'lat' | 'lng') {
  const direction = axis === 'lat' ? (value >= 0 ? 'N' : 'S') : (value >= 0 ? 'E' : 'W');
  return `${Math.abs(value).toFixed(6)}° ${direction}`;
}

async function requestCameraPermission(Camera: any): Promise<CameraPermission> {
  if (!Camera) return 'unavailable';
  if (typeof Camera.requestCameraPermissionsAsync === 'function') {
    const permission = await Camera.requestCameraPermissionsAsync();
    return permission?.status === 'granted' ? 'granted' : 'denied';
  }
  if (Camera.Camera?.requestCameraPermissionsAsync) {
    const permission = await Camera.Camera.requestCameraPermissionsAsync();
    return permission?.status === 'granted' ? 'granted' : 'denied';
  }
  return 'unavailable';
}

export default function QiblaScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isFocused = useIsFocused();
  const headingAnim = useRef(new Animated.Value(0)).current;
  const qiblaAnim = useRef(new Animated.Value(0)).current;
  const lastHeadingRef = useRef(0);
  const alignmentBuzzedRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [entryVisible, setEntryVisible] = useState(() => !['camera', 'compass', 'map'].includes(String(params.mode)));
  const [location, setLocation] = useState<QiblaLocation>(FALLBACK_LOCATION);
  const [heading, setHeading] = useState(0);
  const [headingAccuracy, setHeadingAccuracy] = useState<number | null>(null);
  const [sensorStatus, setSensorStatus] = useState<'checking' | 'active' | 'unavailable'>('checking');
  const [cameraMode, setCameraMode] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<CameraPermission>('idle');
  const [mapMode, setMapMode] = useState(false);

  const qibla = useMemo(() => calculateQiblaState(location, heading), [heading, location]);
  const accuracy = getCompassAccuracyLabel(headingAccuracy) as AccuracyLabel;
  const qiblaLine = useMemo(() => calculateMapLine(location), [location]);
  const modalSurfaceStyle = colorScheme === 'dark' ? styles.entryModalDark : styles.entryModal;

  const setSmoothHeading = useCallback((next: number, accuracyDegrees?: number | null) => {
    const previous = lastHeadingRef.current;
    let target = next;
    const delta = target - previous;
    if (delta > 180) target -= 360;
    if (delta < -180) target += 360;
    lastHeadingRef.current = target;
    setHeading(((target % 360) + 360) % 360);
    if (typeof accuracyDegrees === 'number') setHeadingAccuracy(accuracyDegrees);
    Animated.timing(headingAnim, {
      toValue: -target,
      duration: SENSOR_UPDATE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [headingAnim]);

  const refreshLocation = useCallback(async () => {
    setLocation((current) => ({ ...current, permission: 'requesting' }));
    const Location = getExpoLocationModule();
    if (!Location) {
      setLocation((current) => ({ ...current, permission: current.source === 'cache' ? 'offline' : 'unavailable' }));
      return;
    }
    try {
      const existing = await Location.getForegroundPermissionsAsync();
      const permission = existing?.status === 'granted' ? existing : await Location.requestForegroundPermissionsAsync();
      if (permission?.status !== 'granted') {
        setLocation((current) => ({ ...current, permission: current.source === 'cache' ? 'offline' : 'denied' }));
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy?.Balanced ?? 3 });
      let city = 'Detected location';
      let state = 'Local region';
      let country = 'Local Qibla direction';
      try {
        const reverse = await Location.reverseGeocodeAsync({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        const place = reverse?.[0];
        city = place?.city || place?.district || place?.subregion || city;
        state = place?.region || place?.subregion || state;
        country = place?.country || place?.isoCountryCode || country;
      } catch {
        // Reverse geocoding is optional; coordinates are enough for production Qibla math.
      }
      const nextLocation: QiblaLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        city,
        state,
        country,
        permission: 'granted',
        source: 'device',
        updatedAt: Date.now(),
      };
      setLocation(nextLocation);
      await AsyncStorage.setItem(QIBLA_LOCATION_CACHE_KEY, JSON.stringify(nextLocation)).catch(() => {});
    } catch {
      setLocation((current) => ({ ...current, permission: current.source === 'cache' ? 'offline' : 'unavailable' }));
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(QIBLA_LOCATION_CACHE_KEY)
      .then((raw) => {
        if (!mounted || !raw) return;
        const cached = JSON.parse(raw) as QiblaLocation;
        if (typeof cached?.latitude === 'number' && typeof cached?.longitude === 'number') {
          setLocation({ ...cached, permission: 'offline', source: 'cache' });
        }
      })
      .catch(() => {});
    refreshLocation().catch(() => {});
    return () => {
      mounted = false;
    };
  }, [refreshLocation]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      appStateRef.current = state;
      setAppActive(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!isFocused || !appActive || appStateRef.current !== 'active') return undefined;
    const Magnetometer = getMagnetometerModule();
    const Location = getExpoLocationModule();
    let subscription: { remove?: () => void } | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;

    if (Magnetometer?.addListener) {
      setSensorStatus('active');
      Magnetometer.setUpdateInterval?.(SENSOR_UPDATE_MS);
      subscription = Magnetometer.addListener((sample: { x: number; y: number }) => {
        setSmoothHeading(headingFromMagnetometer(sample), headingAccuracy);
      });
    } else if (Location?.getHeadingAsync) {
      setSensorStatus('checking');
      timer = setInterval(() => {
        Location.getHeadingAsync()
          .then((value: any) => {
            const nextHeading = value?.trueHeading >= 0 ? value.trueHeading : value?.magHeading;
            if (typeof nextHeading === 'number' && nextHeading >= 0) {
              setSensorStatus('active');
              setSmoothHeading(nextHeading, value?.accuracy);
            }
          })
          .catch(() => setSensorStatus('unavailable'));
      }, 500);
    } else {
      setSensorStatus('unavailable');
    }

    return () => {
      subscription?.remove?.();
      if (timer) clearInterval(timer);
    };
  }, [appActive, headingAccuracy, isFocused, setSmoothHeading]);

  useEffect(() => {
    Animated.timing(qiblaAnim, {
      toValue: qibla.offset,
      duration: 140,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    if (qibla.aligned && !alignmentBuzzedRef.current) {
      alignmentBuzzedRef.current = true;
      const Haptics = getHapticsModule();
      Haptics?.notificationAsync?.(Haptics.NotificationFeedbackType?.Success).catch?.(() => {});
    }
    if (!qibla.aligned) alignmentBuzzedRef.current = false;
  }, [qibla.aligned, qibla.offset, qiblaAnim]);

  const openCameraMode = useCallback(async () => {
    const Camera = getCameraModule();
    setEntryVisible(false);
    setMapMode(false);
    setCameraPermission('requesting');
    const permission = await requestCameraPermission(Camera).catch(() => 'unavailable' as CameraPermission);
    setCameraPermission(permission);
    if (permission === 'granted') setCameraMode(true);
  }, []);

  const openCompassMode = useCallback(() => {
    setEntryVisible(false);
    setCameraMode(false);
    setMapMode(false);
  }, []);

  const openMapMode = useCallback(() => {
    setEntryVisible(false);
    setCameraMode(false);
    setMapMode(true);
  }, []);

  useEffect(() => {
    if (params.mode === 'camera' && cameraPermission === 'idle') {
      openCameraMode().catch(() => setCameraPermission('unavailable'));
    }
    if (params.mode === 'compass') openCompassMode();
    if (params.mode === 'map') openMapMode();
  }, [cameraPermission, openCameraMode, openCompassMode, openMapMode, params.mode]);

  const Camera = cameraMode ? getCameraModule() : null;
  const CameraView = Camera?.CameraView || Camera?.Camera;
  const Maps = mapMode ? getMapModule() : null;
  const MapView = Maps?.default || Maps?.MapView || Maps;
  const Marker = Maps?.Marker;
  const Polyline = Maps?.Polyline;
  const compassRotation = headingAnim.interpolate({ inputRange: [-720, 720], outputRange: ['-720deg', '720deg'] });
  const qiblaRotation = qiblaAnim.interpolate({ inputRange: [-180, 180], outputRange: ['-180deg', '180deg'] });

  return (
    <View style={styles.screen}>
      <Modal visible={entryVisible} transparent animationType="fade" onRequestClose={() => setEntryVisible(false)}>
        <View style={styles.modalBackdrop}>
          <Animated.View style={modalSurfaceStyle}>
            <Text style={styles.modalEyebrow}>Professional Qibla Finder</Text>
            <Text style={styles.modalTitle}>Choose your Qibla experience</Text>
            <TouchableOpacity style={styles.entryOption} onPress={openCameraMode} accessibilityRole="button">
              <View style={styles.entryIcon}><Ionicons name="camera-outline" size={30} color={COLORS.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.entryTitle}>📷 Camera Qibla Finder</Text>
                <Text style={styles.entryText}>Native camera preview with AR-style Kaaba alignment overlay.</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.secondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.entryOption} onPress={openCompassMode} accessibilityRole="button">
              <View style={styles.entryIcon}><Ionicons name="compass-outline" size={30} color={COLORS.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.entryTitle}>🧭 Compass Qibla Direction</Text>
                <Text style={styles.entryText}>Live magnetometer heading, bearing, distance, map, and calibration.</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.secondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.entryOption} onPress={openMapMode} accessibilityRole="button" accessibilityLabel="Open map Qibla view">
              <View style={styles.entryIcon}><Ionicons name="map-outline" size={30} color={COLORS.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.entryTitle}>🗺️ Map Qibla View</Text>
                <Text style={styles.entryText}>Native map with user marker, Kaaba marker, distance, and bearing line.</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.secondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSkip} onPress={() => setEntryVisible(false)}><Text style={styles.modalSkipText}>Continue to compass</Text></TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      {cameraMode && CameraView ? (
        <View style={styles.cameraFullScreen} testID="qibla-camera-finder">
          <CameraView style={StyleSheet.absoluteFill} facing="back" />
          <View style={[styles.cameraTopBar, { paddingTop: insets.top + 10 }]}> 
            <TouchableOpacity style={styles.roundButton} onPress={() => setCameraMode(false)}><Ionicons name="close" size={22} color="#fff" /></TouchableOpacity>
            <Text style={styles.cameraTitle}>Camera Qibla Finder</Text>
            <TouchableOpacity style={styles.roundButton} onPress={() => setMapMode((value) => !value)}><Ionicons name="map-outline" size={20} color="#fff" /></TouchableOpacity>
          </View>
          <View style={styles.arOverlay}>
            <Animated.View style={[styles.arArrow, { transform: [{ rotate: qiblaRotation }] }]}> 
              <Ionicons name={qibla.offset < 0 ? 'arrow-back' : qibla.offset > 0 ? 'arrow-forward' : 'checkmark'} size={58} color={qibla.aligned ? '#22c55e' : COLORS.secondary} />
            </Animated.View>
            <Text style={[styles.alignmentBadge, qibla.aligned && styles.alignmentBadgeReady]}>{qibla.aligned ? '✓ Facing Qibla' : qibla.guidance}</Text>
            <Text style={styles.arSubText}>Qibla {Math.round(qibla.qiblaAngle)}° • Heading {Math.round(qibla.heading)}°</Text>
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + SPACING.md }]} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Go back">
              <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>Qibla System</Text>
              <Text style={styles.title}>Professional Kaaba direction</Text>
            </View>
            <TouchableOpacity style={styles.modeButton} onPress={() => setEntryVisible(true)}><Text style={styles.modeButtonText}>Modes</Text></TouchableOpacity>
          </View>

          {accuracy === 'Low' ? (
            <View style={styles.calibrationBanner}>
              <Ionicons name="warning-outline" size={20} color="#92400e" />
              <Text style={styles.calibrationText}>Move your phone in a figure-8 motion to improve accuracy.</Text>
            </View>
          ) : null}

          {location.source === 'cache' || location.permission === 'offline' ? (
            <View style={styles.cacheBanner}><Text style={styles.cacheText}>Using last known location</Text></View>
          ) : null}

          <View style={styles.heroCard} testID="qibla-compass-section">
            <Text style={styles.heroLabel}>Live Compass Qibla Finder</Text>
            <Text style={styles.degreeDisplay}>{Math.round(qibla.qiblaAngle)}°</Text>
            <Text style={styles.heroSubtitle}>{qibla.guidance}</Text>
            <View style={[styles.compassWrap, { width: COMPASS_SIZE, height: COMPASS_SIZE, borderRadius: COMPASS_SIZE / 2 }]}>
              <Animated.View style={[styles.compassDial, { width: COMPASS_SIZE - 28, height: COMPASS_SIZE - 28, borderRadius: (COMPASS_SIZE - 28) / 2, transform: [{ rotate: compassRotation }] }]}> 
                {DEGREE_MARKS.map((mark) => (
                  <View key={mark} style={[styles.degreeMark, { height: mark % 30 === 0 ? 18 : 10, transform: [{ rotate: `${mark}deg` }, { translateY: -(COMPASS_SIZE / 2 - 28) }] }]} />
                ))}
                {['N', 'E', 'S', 'W'].map((label, index) => (
                  <Text key={label} style={[styles.compassPoint, { transform: [{ rotate: `${index * 90}deg` }, { translateY: -(COMPASS_SIZE / 2 - 52) }, { rotate: `${-index * 90}deg` }] }]}>{label}</Text>
                ))}
              </Animated.View>
              <View style={styles.qiblaLine} />
              <Animated.View style={[styles.qiblaNeedle, { transform: [{ rotate: qiblaRotation }] }]}> 
                <Ionicons name="navigate" size={64} color={COLORS.secondary} />
              </Animated.View>
              <View style={styles.kaabaCenter}><MaterialCommunityIcons name={'mosque' as any} size={34} color={COLORS.primary} /><Text style={styles.kaabaText}>Kaaba</Text></View>
            </View>
            <View style={styles.accuracyPills}>
              {(['Low', 'Medium', 'High'] as AccuracyLabel[]).map((item) => <View key={item} style={[styles.accuracyPill, accuracy === item && styles.accuracyPillActive]}><Text style={[styles.accuracyText, accuracy === item && styles.accuracyTextActive]}>Accuracy: {item}</Text></View>)}
            </View>
          </View>

          <View style={styles.metricGrid}>
            <Metric label="Qibla Bearing" value={`${Math.round(qibla.qiblaAngle)}°`} />
            <Metric label="Device Heading" value={`${Math.round(qibla.heading)}°`} />
            <Metric label="Turn Direction" value={qibla.guidance} />
            <Metric label="Direction" value={qibla.directionLongText} />
            <Metric label="Distance" value={formatDistanceToKaaba(qibla.distanceKm)} />
            <Metric label="Compass Sensor" value={sensorStatus === 'active' ? 'Live' : sensorStatus} />
          </View>

          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <Ionicons name="location-outline" size={18} color={COLORS.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.statusTitle}>{location.city}, {location.state}, {location.country}</Text>
                <Text style={styles.statusText}>Latitude {formatCoordinate(location.latitude, 'lat')} • Longitude {formatCoordinate(location.longitude, 'lng')}</Text>
                <Text style={styles.statusText}>Location: {location.permission} • Source: {location.source}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.primaryButton} onPress={() => refreshLocation().catch(() => {})}>
              {location.permission === 'requesting' ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Refresh location</Text>}
            </TouchableOpacity>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionCard} onPress={openCameraMode}>
              <Ionicons name="camera-outline" size={24} color={COLORS.primary} />
              <Text style={styles.actionTitle}>Camera mode</Text>
              <Text style={styles.actionText}>{cameraPermission === 'denied' ? 'Permission denied' : 'Open AR overlay'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => setMapMode((value) => !value)}>
              <Ionicons name="map-outline" size={24} color={COLORS.primary} />
              <Text style={styles.actionTitle}>Map mode</Text>
              <Text style={styles.actionText}>{mapMode ? 'Hide map' : 'Show bearing line'}</Text>
            </TouchableOpacity>
          </View>

          {cameraPermission === 'denied' ? (
            <View style={styles.permissionCard}><Ionicons name="lock-closed-outline" size={20} color={COLORS.primary} /><Text style={styles.statusText}>Camera permission denied. Enable camera permission in device settings to use the native Qibla camera overlay.</Text></View>
          ) : null}

          {mapMode ? (
            <View style={styles.mapCard} testID="qibla-map-mode">
              {MapView && Marker && Polyline ? (
                <MapView style={styles.map} initialRegion={{ latitude: location.latitude, longitude: location.longitude, latitudeDelta: 50, longitudeDelta: 50 }}>
                  <Marker coordinate={location} title="Your location" />
                  <Marker coordinate={KAABA_COORDINATES} title="Kaaba" description="Masjid al-Haram" />
                  <Polyline coordinates={qiblaLine} strokeWidth={4} strokeColor={COLORS.secondary} geodesic />
                </MapView>
              ) : (
                <View style={styles.mapFallback}><Text style={styles.statusTitle}>Map native module unavailable</Text><Text style={styles.statusText}>Install react-native-maps in the native build to display the user location, Kaaba marker, and bearing line.</Text></View>
              )}
              <Text style={styles.mapMeta}>Distance: {formatDistanceToKaaba(qibla.distanceKm)} • Direction: {qibla.directionLongText}</Text>
            </View>
          ) : null}

          <View style={styles.guidanceCard}>
            <Text style={styles.heroLabel}>Performance & accuracy</Text>
            <Text style={styles.statusText}>• Sensor updates are throttled to {SENSOR_UPDATE_MS}ms and paused when the screen is hidden.</Text>
            <Text style={styles.statusText}>• Location and Qibla calculations are cached for offline fallback.</Text>
            <Text style={styles.statusText}>• Compass remains visible while calibration guidance is shown.</Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={styles.metricCard}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: COLORS.secondary, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  title: { ...TYPOGRAPHY.title, color: COLORS.text },
  modeButton: { backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 9 },
  modeButtonText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(2,6,23,0.72)', justifyContent: 'center', padding: SPACING.lg },
  entryModal: { borderRadius: 32, padding: SPACING.lg, gap: SPACING.md, backgroundColor: COLORS.surface, ...SHADOWS.card },
  entryModalDark: { borderRadius: 32, padding: SPACING.lg, gap: SPACING.md, backgroundColor: '#0f172a', ...SHADOWS.card },
  modalEyebrow: { color: COLORS.secondary, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  modalTitle: { color: COLORS.text, fontSize: 24, fontWeight: '900' },
  entryOption: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, borderRadius: 24, padding: SPACING.md, backgroundColor: COLORS.goldBg, borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)' },
  entryIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  entryTitle: { color: COLORS.text, fontSize: 16, fontWeight: '900' },
  entryText: { color: COLORS.textMuted, fontSize: 13, fontWeight: '600', marginTop: 3 },
  modalSkip: { alignSelf: 'center', padding: 8 },
  modalSkipText: { color: COLORS.primary, fontWeight: '900' },
  calibrationBanner: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, borderRadius: 18, padding: SPACING.md, backgroundColor: '#fef3c7' },
  calibrationText: { color: '#92400e', flex: 1, fontWeight: '800' },
  cacheBanner: { borderRadius: 16, padding: SPACING.sm, backgroundColor: '#dbeafe' },
  cacheText: { color: '#1e40af', fontWeight: '900', textAlign: 'center' },
  heroCard: { backgroundColor: COLORS.primary, borderRadius: 30, padding: SPACING.lg, alignItems: 'center', ...SHADOWS.card },
  heroLabel: { color: COLORS.secondary, fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  degreeDisplay: { color: '#fff', fontSize: 58, fontWeight: '900', marginTop: 2 },
  heroSubtitle: { color: '#fff', fontSize: 21, fontWeight: '900', marginBottom: SPACING.md },
  compassWrap: { borderWidth: 3, borderColor: 'rgba(212,175,55,0.75)', alignItems: 'center', justifyContent: 'center', marginVertical: SPACING.sm, backgroundColor: 'rgba(255,255,255,0.08)' },
  compassDial: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  degreeMark: { position: 'absolute', width: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.62)' },
  compassPoint: { position: 'absolute', color: '#fff', fontWeight: '900', fontSize: 18 },
  qiblaLine: { position: 'absolute', top: 20, width: 4, height: COMPASS_SIZE / 2 - 42, borderRadius: 4, backgroundColor: '#22c55e' },
  qiblaNeedle: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  kaabaCenter: { width: 78, height: 78, borderRadius: 39, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  kaabaText: { color: COLORS.primary, fontSize: 10, fontWeight: '900' },
  accuracyPills: { flexDirection: 'row', gap: 6, marginTop: SPACING.md, flexWrap: 'wrap', justifyContent: 'center' },
  accuracyPill: { borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: 'rgba(255,255,255,0.12)' },
  accuracyPillActive: { backgroundColor: COLORS.secondary },
  accuracyText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  accuracyTextActive: { color: COLORS.primary },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  metricCard: { flexGrow: 1, minWidth: '45%', borderRadius: RADIUS.lg, padding: SPACING.md, backgroundColor: COLORS.surface, ...SHADOWS.card },
  metricLabel: { color: COLORS.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  metricValue: { color: COLORS.text, fontSize: 18, fontWeight: '900', marginTop: 3 },
  statusCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.md, gap: SPACING.md, ...SHADOWS.card },
  statusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  statusTitle: { color: COLORS.text, fontWeight: '900', fontSize: 15 },
  statusText: { color: COLORS.textMuted, fontWeight: '600', fontSize: 13, lineHeight: 19 },
  primaryButton: { backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  actionRow: { flexDirection: 'row', gap: SPACING.md },
  actionCard: { flex: 1, borderRadius: 22, padding: SPACING.md, backgroundColor: COLORS.surface, ...SHADOWS.card },
  actionTitle: { color: COLORS.text, fontWeight: '900', marginTop: 8 },
  actionText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700', marginTop: 3 },
  permissionCard: { flexDirection: 'row', gap: SPACING.sm, borderRadius: 18, padding: SPACING.md, backgroundColor: COLORS.goldBg },
  mapCard: { borderRadius: RADIUS.xl, overflow: 'hidden', backgroundColor: COLORS.surface, ...SHADOWS.card },
  map: { height: 310 },
  mapFallback: { height: 220, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
  mapMeta: { color: COLORS.text, fontWeight: '900', padding: SPACING.md },
  guidanceCard: { backgroundColor: COLORS.goldBg, borderRadius: RADIUS.xl, padding: SPACING.md, gap: 4, marginBottom: Platform.OS === 'ios' ? SPACING.md : 0 },
  cameraFullScreen: { flex: 1, backgroundColor: '#020617' },
  cameraTopBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingBottom: 10, backgroundColor: 'rgba(2,6,23,0.35)' },
  roundButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.42)' },
  cameraTitle: { color: '#fff', fontWeight: '900', fontSize: 16 },
  arOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(2,6,23,0.10)' },
  arArrow: { width: 142, height: 142, borderRadius: 71, borderWidth: 3, borderColor: COLORS.secondary, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(6,78,59,0.45)' },
  alignmentBadge: { overflow: 'hidden', color: '#fff', fontSize: 22, fontWeight: '900', marginTop: SPACING.lg, paddingHorizontal: 18, paddingVertical: 10, borderRadius: RADIUS.full, backgroundColor: 'rgba(15,23,42,0.72)' },
  alignmentBadgeReady: { backgroundColor: '#16a34a' },
  arSubText: { color: 'rgba(255,255,255,0.88)', fontSize: 14, fontWeight: '800', marginTop: 8 },
});
