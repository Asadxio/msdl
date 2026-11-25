import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { goBackOrReplace } from '@/lib/navigation';
import { loadPrayerSettings } from '@/lib/prayerStorage';
import {
  NearbyMasjid,
  PlaceCategory,
  buildDirectionsUrl,
  fetchNearbyPlaces,
} from '@/lib/masjidFinderService';

const RADIUS_OPTIONS = [
  { meters: 2000, label: '2 km' },
  { meters: 5000, label: '5 km' },
  { meters: 10000, label: '10 km' },
] as const;

export default function NearbyMasjidsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const [category, setCategory] = useState<PlaceCategory>('masjid');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number; label: string } | null>(null);
  const [radiusMeters, setRadiusMeters] = useState<number>(5000);
  const [masjids, setMasjids] = useState<NearbyMasjid[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [usingFallbackLoc, setUsingFallbackLoc] = useState<boolean>(false);

  const loadLocationAndMasjids = useCallback(
    async (targetRadius: number, targetCategory: PlaceCategory) => {
      setLoading(true);
      setError(null);
      try {
        let lat = 0;
        let lon = 0;
        let label = 'Current GPS Location';
        let isFallback = false;

        try {
          const perm = await Location.requestForegroundPermissionsAsync();
          if (perm.status === 'granted') {
            const pos = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            lat = pos.coords.latitude;
            lon = pos.coords.longitude;
          }
        } catch {
          // Fallback to saved prayer settings
        }

        if (!lat || !lon) {
          const saved = await loadPrayerSettings();
          lat = saved.latitude;
          lon = saved.longitude;
          label = saved.city && saved.city !== 'Location unavailable' ? saved.city : 'Saved Prayer Location';
          isFallback = true;
        }

        setUsingFallbackLoc(isFallback);
        setCoords({ latitude: lat, longitude: lon, label });

        const found = await fetchNearbyPlaces(lat, lon, targetRadius, targetCategory);
        setMasjids(found);
      } catch (err: any) {
        setError(err?.message || 'Unable to load nearby locations right now.');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadLocationAndMasjids(radiusMeters, category);
  }, [loadLocationAndMasjids, radiusMeters, category]);

  const handleOpenDirections = (masjid: NearbyMasjid) => {
    void Haptics.selectionAsync();
    const url = buildDirectionsUrl(masjid.latitude, masjid.longitude, masjid.name);
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Emerald Header */}
      <View style={[styles.header, { backgroundColor: colors.primaryDeep }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => goBackOrReplace(router, '/more')}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerAr}>المَسَاجِدُ وَالحَلَال</Text>
          <Text style={styles.headerTitle}>
            {category === 'halal' ? 'Halal Spots Compass' : 'Nearby Masjids'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => void loadLocationAndMasjids(radiusMeters, category)}
          accessibilityLabel="Refresh nearby places"
        >
          <Ionicons name="refresh" size={20} color="#E5C378" />
        </TouchableOpacity>
      </View>

      {/* Location, Category & Radius Bar */}
      <View style={styles.controlsWrap}>
        <View style={styles.radiusRow}>
          {(
            [
              { id: 'masjid' as const, label: 'Masjids (مساجد)', icon: 'business-outline' as const },
              { id: 'halal' as const, label: 'Halal Spots (حلال)', icon: 'restaurant-outline' as const },
            ]
          ).map((cat) => {
            const active = category === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.radiusPill,
                  {
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 6,
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderColor: active ? colors.gold : colors.border,
                  },
                ]}
                onPress={() => setCategory(cat.id)}
              >
                <Ionicons name={cat.icon} size={14} color={active ? '#FFFFFF' : colors.primary} />
                <Text style={[styles.radiusText, { color: active ? '#FFFFFF' : colors.text }]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View
          style={[
            styles.locationBanner,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Ionicons
            name={usingFallbackLoc ? 'location-outline' : 'navigate'}
            size={18}
            color={colors.gold}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.locTitle, { color: colors.text }]} numberOfLines={1}>
              {coords ? coords.label : 'Locating...'}
            </Text>
            {coords && (
              <Text style={[styles.locCoords, { color: colors.textSecondary }]}>
                {coords.latitude.toFixed(4)}°, {coords.longitude.toFixed(4)}° • OpenStreetMap Overpass
              </Text>
            )}
          </View>
        </View>

        <View style={styles.radiusRow}>
          {RADIUS_OPTIONS.map((opt) => {
            const active = radiusMeters === opt.meters;
            return (
              <TouchableOpacity
                key={opt.meters}
                style={[
                  styles.radiusPill,
                  {
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderColor: active ? colors.gold : colors.border,
                  },
                ]}
                onPress={() => setRadiusMeters(opt.meters)}
              >
                <Text style={[styles.radiusText, { color: active ? '#FFFFFF' : colors.text }]}>
                  Within {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={[styles.centerText, { color: colors.textSecondary }]}>
            Scanning {category === 'halal' ? 'Halal places' : 'Masjids'} around you...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Ionicons name="cloud-offline-outline" size={46} color={colors.error} />
          <Text style={[styles.centerText, { color: colors.error }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            onPress={() => void loadLocationAndMasjids(radiusMeters, category)}
          >
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={masjids}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.centerBox}>
              <Ionicons name="compass-outline" size={46} color={colors.textMuted} />
              <Text style={[styles.centerText, { color: colors.textSecondary }]}>
                No mapped {category === 'halal' ? 'Halal spots' : 'Masjids'} found within {radiusMeters / 1000} km. Try expanding to 10 km.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.masjidCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View
                style={[
                  styles.masjidIcon,
                  { backgroundColor: isDark ? colors.surfaceAlt : '#ECFDF5' },
                ]}
              >
                <Ionicons
                  name={category === 'halal' ? 'restaurant' : 'business'}
                  size={22}
                  color={colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.masjidName, { color: colors.text }]} numberOfLines={2}>
                  {item.name}
                </Text>
                {item.address ? (
                  <Text style={[styles.masjidAddress, { color: colors.textSecondary }]} numberOfLines={1}>
                    {item.address}
                  </Text>
                ) : null}
                <View style={styles.metaRow}>
                  <View style={[styles.distBadge, { backgroundColor: colors.goldBg }]}>
                    <Ionicons
                      name="arrow-up"
                      size={12}
                      color={colors.goldText}
                      style={{ transform: [{ rotate: `${Math.round(item.bearingDeg)}deg` }] }}
                    />
                    <Text style={[styles.distText, { color: colors.goldText }]}>
                      {item.distanceKm.toFixed(2)} km • {item.directionLabel} ({Math.round(item.bearingDeg)}°)
                    </Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.dirBtn, { backgroundColor: colors.primary }]}
                onPress={() => handleOpenDirections(item)}
                accessibilityLabel={`Get directions to ${item.name}`}
              >
                <Ionicons name="navigate-outline" size={16} color="#FFFFFF" />
                <Text style={styles.dirText}>Map</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerAr: { fontSize: 12, fontWeight: '700', color: '#E5C378' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#FFFFFF' },
  controlsWrap: { padding: SPACING.md, paddingBottom: 6, gap: 10 },
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  locTitle: { fontSize: 13.5, fontWeight: '800' },
  locCoords: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  radiusRow: { flexDirection: 'row', gap: 8 },
  radiusPill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    alignItems: 'center',
  },
  radiusText: { fontSize: 12, fontWeight: '700' },
  listContent: { padding: SPACING.md, gap: 10 },
  masjidCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    ...SHADOWS.card,
  },
  masjidIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  masjidName: { fontSize: 14.5, fontWeight: '800' },
  masjidAddress: { fontSize: 12, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  distBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  distText: { fontSize: 11, fontWeight: '700' },
  dirBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    minHeight: 42,
  },
  dirText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 12,
  },
  centerText: { fontSize: 13.5, fontWeight: '600', textAlign: 'center' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: RADIUS.md },
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
});
