import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import {
  QIBLA_LOCATION_CACHE_KEY,
  calculateQiblaState,
  formatDistanceToKaaba,
} from '@/lib/qibla';

type QiblaLocation = {
  latitude: number;
  longitude: number;
  city: string;
  country: string;
  permission: 'idle' | 'requesting' | 'granted' | 'denied' | 'offline' | 'unavailable';
  source: 'device' | 'cache' | 'fallback';
  updatedAt?: number;
};

const FALLBACK_LOCATION: QiblaLocation = {
  latitude: 21.422487,
  longitude: 39.826206,
  city: 'Makkah',
  country: 'Saudi Arabia',
  permission: 'idle',
  source: 'fallback',
};

function getExpoLocationModule() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-location');
  } catch {
    return null;
  }
}

function getMagnetometerModule() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-sensors')?.Magnetometer;
  } catch {
    return null;
  }
}

function getCameraModule() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-camera');
  } catch {
    return null;
  }
}

function headingFromMagnetometer(sample: { x: number; y: number }) {
  const angle = Math.atan2(sample.y, sample.x) * (180 / Math.PI);
  return (angle + 360) % 360;
}

async function requestCameraPermission(Camera: any) {
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
  const insets = useSafeAreaInsets();
  const compassSpin = useRef(new Animated.Value(0)).current;
  const [location, setLocation] = useState<QiblaLocation>(FALLBACK_LOCATION);
  const [heading, setHeading] = useState(0);
  const [sensorStatus, setSensorStatus] = useState<'checking' | 'active' | 'unavailable'>('checking');
  const [cameraMode, setCameraMode] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable'>('idle');

  const qibla = useMemo(
    () => calculateQiblaState(location, heading),
    [heading, location],
  );
  const arrowRotation = `${qibla.offset}deg`;
  const compassRotation = `${-heading}deg`;

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
      let country = 'Local Qibla direction';
      try {
        const reverse = await Location.reverseGeocodeAsync({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        const place = reverse?.[0];
        city = place?.city || place?.district || place?.subregion || city;
        country = place?.country || place?.isoCountryCode || country;
      } catch {
        // Coordinates are enough for Qibla; reverse geocoding is optional.
      }
      const nextLocation: QiblaLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        city,
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
    const Magnetometer = getMagnetometerModule();
    let subscription: { remove?: () => void } | null = null;
    if (Magnetometer?.addListener) {
      setSensorStatus('active');
      Magnetometer.setUpdateInterval?.(250);
      subscription = Magnetometer.addListener((sample: { x: number; y: number }) => {
        setHeading(headingFromMagnetometer(sample));
      });
    } else {
      setSensorStatus('unavailable');
      const Location = getExpoLocationModule();
      if (Location?.getHeadingAsync) {
        const timer = setInterval(() => {
          Location.getHeadingAsync()
            .then((value: any) => {
              const nextHeading = value?.trueHeading ?? value?.magHeading;
              if (typeof nextHeading === 'number' && nextHeading >= 0) {
                setHeading(nextHeading);
                setSensorStatus('active');
              }
            })
            .catch(() => setSensorStatus('unavailable'));
        }, 1000);
        return () => clearInterval(timer);
      }
    }
    return () => subscription?.remove?.();
  }, []);

  useEffect(() => {
    Animated.spring(compassSpin, {
      toValue: heading,
      useNativeDriver: true,
      friction: 8,
      tension: 40,
    }).start();
  }, [compassSpin, heading]);

  const openCameraMode = async () => {
    const Camera = getCameraModule();
    setCameraPermission('requesting');
    const permission = await requestCameraPermission(Camera).catch(() => 'unavailable');
    setCameraPermission(permission as any);
    if (permission === 'granted') setCameraMode(true);
  };

  const Camera = cameraMode ? getCameraModule() : null;
  const CameraView = Camera?.CameraView || Camera?.Camera;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + SPACING.md }]} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Qibla System</Text>
            <Text style={styles.title}>Find the Kaaba direction</Text>
          </View>
        </View>

        <View style={styles.heroCard} testID="qibla-compass-section">
          <Text style={styles.heroLabel}>Compass Qibla Finder</Text>
          <Text style={styles.heroSubtitle}>{qibla.guidance}</Text>
          <View style={styles.compassWrap}>
            <View style={[styles.compassDial, { transform: [{ rotate: compassRotation }] }]}> 
              {['N', 'E', 'S', 'W'].map((label, index) => (
                <Text key={label} style={[styles.compassPoint, { transform: [{ rotate: `${index * 90}deg` }, { translateY: -122 }, { rotate: `${-index * 90}deg` }] }]}>{label}</Text>
              ))}
            </View>
            <View style={[styles.qiblaArrow, { transform: [{ rotate: arrowRotation }] }]}>
              <Ionicons name="navigate" size={58} color={COLORS.secondary} />
            </View>
            <View style={styles.kaabaCenter}>
              <MaterialCommunityIcons name={"mosque" as any} size={34} color={COLORS.primary} />
            </View>
          </View>
          <View style={styles.metricGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Device heading</Text>
              <Text style={styles.metricValue}>{Math.round(qibla.heading)}°</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Qibla angle</Text>
              <Text style={styles.metricValue}>{Math.round(qibla.qiblaAngle)}°</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Direction</Text>
              <Text style={styles.metricValue}>{qibla.directionText}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Distance</Text>
              <Text style={styles.metricValue}>{formatDistanceToKaaba(qibla.distanceKm)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <Ionicons name="location-outline" size={18} color={COLORS.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.statusTitle}>{location.city}, {location.country}</Text>
              <Text style={styles.statusText}>Location: {location.permission} • Source: {location.source}</Text>
            </View>
            <TouchableOpacity style={styles.smallButton} onPress={() => refreshLocation().catch(() => {})}>
              {location.permission === 'requesting' ? <ActivityIndicator color="#fff" /> : <Text style={styles.smallButtonText}>Refresh</Text>}
            </TouchableOpacity>
          </View>
          <View style={styles.statusRow}>
            <Ionicons name="compass-outline" size={18} color={COLORS.primary} />
            <Text style={styles.statusText}>Compass sensor: {sensorStatus === 'active' ? 'real-time heading active' : 'not available; use manual alignment guidance'}</Text>
          </View>
        </View>

        <View style={styles.cameraCard} testID="qibla-camera-finder">
          <View style={styles.cameraHeader}>
            <View>
              <Text style={styles.heroLabel}>Camera Qibla Finder</Text>
              <Text style={styles.statusText}>AR-style overlay with live Qibla guidance.</Text>
            </View>
            <TouchableOpacity style={styles.primaryButton} onPress={cameraMode ? () => setCameraMode(false) : openCameraMode}>
              {cameraPermission === 'requesting' ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{cameraMode ? 'Close Camera' : 'Open Camera'}</Text>}
            </TouchableOpacity>
          </View>
          {cameraMode && CameraView ? (
            <View style={styles.cameraPreview}>
              <CameraView style={StyleSheet.absoluteFill} facing="back" />
              <View style={styles.cameraOverlay}>
                <View style={[styles.arArrow, { transform: [{ rotate: arrowRotation }] }]}>
                  <Ionicons name="navigate" size={72} color={COLORS.secondary} />
                </View>
                <Text style={styles.arText}>{qibla.guidance}</Text>
                <Text style={styles.arSubText}>Qibla {Math.round(qibla.qiblaAngle)}° • Heading {Math.round(qibla.heading)}°</Text>
              </View>
            </View>
          ) : (
            <View style={styles.cameraFallback}>
              <Ionicons name={cameraPermission === 'denied' ? 'lock-closed-outline' : 'camera-outline'} size={32} color={COLORS.primary} />
              <Text style={styles.statusTitle}>{cameraPermission === 'denied' ? 'Camera permission denied' : 'Camera preview ready on device'}</Text>
              <Text style={styles.statusText}>{CameraView ? 'Tap Open Camera to align using the overlay.' : 'Install expo-camera in native builds to enable camera mode; compass remains usable.'}</Text>
            </View>
          )}
        </View>

        <View style={styles.guidanceCard}>
          <Text style={styles.heroLabel}>Reliability notes</Text>
          <Text style={styles.statusText}>• Works with cached location when offline.</Text>
          <Text style={styles.statusText}>• Denied location keeps the last known location or Makkah fallback.</Text>
          <Text style={styles.statusText}>• Missing compass sensors show a clear unavailable state.</Text>
          <Text style={styles.statusText}>• For best accuracy, calibrate by moving the phone in a figure-eight motion.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: COLORS.secondary, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  title: { ...TYPOGRAPHY.title, color: COLORS.text },
  heroCard: { backgroundColor: COLORS.primary, borderRadius: 28, padding: SPACING.lg, ...SHADOWS.card },
  heroLabel: { color: COLORS.secondary, fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  heroSubtitle: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 4 },
  compassWrap: { alignSelf: 'center', width: 290, height: 290, borderRadius: 145, borderWidth: 3, borderColor: 'rgba(212,175,55,0.75)', alignItems: 'center', justifyContent: 'center', marginVertical: SPACING.lg, backgroundColor: 'rgba(255,255,255,0.08)' },
  compassDial: { position: 'absolute', width: 260, height: 260, borderRadius: 130, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  compassPoint: { position: 'absolute', color: '#fff', fontWeight: '900', fontSize: 16 },
  qiblaArrow: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  kaabaCenter: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  metricCard: { flexGrow: 1, minWidth: '45%', borderRadius: RADIUS.lg, padding: SPACING.md, backgroundColor: 'rgba(255,255,255,0.12)' },
  metricLabel: { color: 'rgba(255,255,255,0.72)', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  metricValue: { color: '#fff', fontSize: 18, fontWeight: '900', marginTop: 3 },
  statusCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.md, gap: SPACING.sm, ...SHADOWS.card },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  statusTitle: { color: COLORS.text, fontWeight: '900', fontSize: 15 },
  statusText: { color: COLORS.textMuted, fontWeight: '600', fontSize: 13, lineHeight: 19 },
  smallButton: { backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, minWidth: 76, alignItems: 'center' },
  smallButtonText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  cameraCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.md, gap: SPACING.md, ...SHADOWS.card },
  cameraHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md },
  primaryButton: { backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, minWidth: 112, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  cameraPreview: { height: 360, borderRadius: 24, overflow: 'hidden', backgroundColor: '#020617' },
  cameraOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(2,6,23,0.20)' },
  arArrow: { width: 128, height: 128, borderRadius: 64, borderWidth: 2, borderColor: COLORS.secondary, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(6,78,59,0.45)' },
  arText: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: SPACING.md, textAlign: 'center' },
  arSubText: { color: 'rgba(255,255,255,0.82)', fontSize: 13, fontWeight: '700', marginTop: 4 },
  cameraFallback: { minHeight: 180, borderRadius: 24, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg, gap: SPACING.sm },
  guidanceCard: { backgroundColor: COLORS.goldBg, borderRadius: RADIUS.xl, padding: SPACING.md, gap: 4, marginBottom: Platform.OS === 'ios' ? SPACING.md : 0 },
});
