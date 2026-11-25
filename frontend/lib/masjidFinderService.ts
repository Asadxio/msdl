import AsyncStorage from '@react-native-async-storage/async-storage';

export type PlaceCategory = 'masjid' | 'halal';

export interface NearbyMasjid {
  id: string;
  name: string;
  category: PlaceCategory;
  latitude: number;
  longitude: number;
  distanceKm: number;
  bearingDeg: number;
  directionLabel: string;
  address?: string;
  source: 'Overpass' | 'Nominatim';
}

const CACHE_KEY_PREFIX = '@suffah_nearby_masjids_v1_';

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Great-circle Haversine distance in kilometers.
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

export function calculateBearingDeg(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  return ((toDeg(Math.atan2(y, x)) % 360) + 360) % 360;
}

export function formatCompassDirection(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return dirs[idx];
}

export function buildDirectionsUrl(lat: number, lon: number, label: string): string {
  const q = encodeURIComponent(label || 'Masjid');
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&query=${q}`;
}

export function parseOverpassElements(
  elements: any[],
  userLat: number,
  userLon: number,
  category: PlaceCategory = 'masjid'
): NearbyMasjid[] {
  const results: NearbyMasjid[] = [];
  const seen = new Set<string>();

  for (const el of elements || []) {
    const lat = Number(el?.lat ?? el?.center?.lat);
    const lon = Number(el?.lon ?? el?.center?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const tags = el?.tags || {};
    const name = String(
      tags['name:en'] ||
        tags.name ||
        tags['name:ur'] ||
        tags['name:ar'] ||
        (category === 'halal' ? 'Halal Spot' : 'Nearby Masjid')
    ).trim();

    const dedupeKey = `${name.toLowerCase()}_${lat.toFixed(4)}_${lon.toFixed(4)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const addressParts = [
      tags['addr:street'],
      tags['addr:suburb'] || tags['addr:neighbourhood'],
      tags['addr:city'],
    ].filter(Boolean);

    const bearingDeg = calculateBearingDeg(userLat, userLon, lat, lon);
    results.push({
      id: `osm_${category}_${el?.type || 'node'}_${el?.id || results.length}`,
      name,
      category,
      latitude: lat,
      longitude: lon,
      distanceKm: calculateDistanceKm(userLat, userLon, lat, lon),
      bearingDeg,
      directionLabel: formatCompassDirection(bearingDeg),
      address: addressParts.length > 0 ? addressParts.join(', ') : undefined,
      source: 'Overpass',
    });
  }

  return results.sort((a, b) => a.distanceKm - b.distanceKm);
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 12000
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

/**
 * Fetches nearby Masjids or Halal dining locations via OpenStreetMap Overpass API mirrors,
 * with Nominatim bounded fallback and AsyncStorage caching.
 */
export async function fetchNearbyPlaces(
  latitude: number,
  longitude: number,
  radiusMeters: number = 5000,
  category: PlaceCategory = 'masjid'
): Promise<NearbyMasjid[]> {
  const safeRadius = Math.min(15000, Math.max(1000, radiusMeters));
  const cacheKey = `${CACHE_KEY_PREFIX}${category}_${latitude.toFixed(2)}_${longitude.toFixed(2)}_${safeRadius}`;

  try {
    const cachedRaw = await AsyncStorage.getItem(cacheKey);
    if (cachedRaw) {
      const parsed = JSON.parse(cachedRaw) as { fetchedAt: number; items: NearbyMasjid[] };
      if (
        Date.now() - parsed.fetchedAt < 6 * 60 * 60 * 1000 &&
        Array.isArray(parsed.items) &&
        parsed.items.length > 0
      ) {
        return parsed.items;
      }
    }
  } catch {
    // proceed to network
  }

  const query =
    category === 'halal'
      ? `[out:json][timeout:18];(node["diet:halal"="yes"](around:${safeRadius},${latitude},${longitude});way["diet:halal"="yes"](around:${safeRadius},${latitude},${longitude});node["halal"="yes"](around:${safeRadius},${latitude},${longitude});node["cuisine"~"halal",i](around:${safeRadius},${latitude},${longitude}););out center 40;`
      : `[out:json][timeout:18];(node["amenity"="place_of_worship"]["religion"="muslim"](around:${safeRadius},${latitude},${longitude});way["amenity"="place_of_worship"]["religion"="muslim"](around:${safeRadius},${latitude},${longitude}););out center 40;`;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetchWithTimeout(
        endpoint,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(query)}`,
        },
        12000
      );
      if (res.ok) {
        const json = await res.json();
        const items = parseOverpassElements(json?.elements || [], latitude, longitude, category);
        if (items.length > 0) {
          AsyncStorage.setItem(
            cacheKey,
            JSON.stringify({ fetchedAt: Date.now(), items })
          ).catch(() => {});
        }
        return items;
      }
    } catch {
      // try next mirror
    }
  }

  // Secondary fallback: Nominatim bounded search around location
  const deltaDeg = safeRadius / 111000;
  const viewbox = `${(longitude - deltaDeg).toFixed(5)},${(latitude + deltaDeg).toFixed(5)},${(
    longitude + deltaDeg
  ).toFixed(5)},${(latitude - deltaDeg).toFixed(5)}`;
  const searchTerm = category === 'halal' ? 'halal' : 'mosque';
  const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${searchTerm}&bounded=1&limit=25&viewbox=${viewbox}`;

  const nomRes = await fetchWithTimeout(
    nominatimUrl,
    { headers: { 'User-Agent': 'SUFFAH-Islamic-App/1.0' } },
    10000
  );
  if (!nomRes.ok) {
    throw new Error('Overpass and Nominatim map services are temporarily busy. Please retry.');
  }

  const nomData = await nomRes.json();
  const mapped: NearbyMasjid[] = (Array.isArray(nomData) ? nomData : [])
    .map((item: any, index: number): NearbyMasjid | null => {
      const lat = Number(item?.lat);
      const lon = Number(item?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      const bearingDeg = calculateBearingDeg(latitude, longitude, lat, lon);
      return {
        id: `nom_${category}_${item?.place_id || index}`,
        name: String(
          item?.name ||
            String(item?.display_name || (category === 'halal' ? 'Halal Spot' : 'Masjid')).split(',')[0]
        ),
        category,
        latitude: lat,
        longitude: lon,
        distanceKm: calculateDistanceKm(latitude, longitude, lat, lon),
        bearingDeg,
        directionLabel: formatCompassDirection(bearingDeg),
        address: String(item?.display_name || '').split(',').slice(1, 4).join(',').trim() || undefined,
        source: 'Nominatim',
      };
    })
    .filter((item): item is NearbyMasjid => item !== null)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  if (mapped.length > 0) {
    AsyncStorage.setItem(
      cacheKey,
      JSON.stringify({ fetchedAt: Date.now(), items: mapped })
    ).catch(() => {});
  }
  return mapped;
}

export async function fetchNearbyMasjids(
  latitude: number,
  longitude: number,
  radiusMeters: number = 5000
): Promise<NearbyMasjid[]> {
  return fetchNearbyPlaces(latitude, longitude, radiusMeters, 'masjid');
}
