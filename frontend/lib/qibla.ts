export const KAABA_COORDINATES = {
  latitude: 21.422487,
  longitude: 39.826206,
};

export const QIBLA_LOCATION_CACHE_KEY = "qibla_location_cache_v1";

type Coordinates = { latitude: number; longitude: number };

const EARTH_RADIUS_KM = 6371.0088;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number) {
  return (value * 180) / Math.PI;
}

export function normalizeDegrees(value: number) {
  return ((value % 360) + 360) % 360;
}

export function calculateQiblaAngle(from: Coordinates) {
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(KAABA_COORDINATES.latitude);
  const deltaLng = toRadians(KAABA_COORDINATES.longitude - from.longitude);
  const y = Math.sin(deltaLng);
  const x = Math.cos(lat1) * Math.tan(lat2) - Math.sin(lat1) * Math.cos(deltaLng);
  return normalizeDegrees(toDegrees(Math.atan2(y, x)));
}

export function calculateDistanceToKaaba(from: Coordinates) {
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(KAABA_COORDINATES.latitude);
  const deltaLat = toRadians(KAABA_COORDINATES.latitude - from.latitude);
  const deltaLng = toRadians(KAABA_COORDINATES.longitude - from.longitude);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistanceToKaaba(kilometers: number) {
  if (!Number.isFinite(kilometers)) return "Distance unavailable";
  if (kilometers < 100) return `${kilometers.toFixed(1)} km`;
  return `${Math.round(kilometers).toLocaleString()} km`;
}

export function getDirectionText(angle: number) {
  const directions = [
    "North",
    "North-East",
    "East",
    "South-East",
    "South",
    "South-West",
    "West",
    "North-West",
  ];
  const index = Math.round(normalizeDegrees(angle) / 45) % directions.length;
  return directions[index];
}

export function getQiblaTurnGuidance(offset: number) {
  const normalized = ((offset + 540) % 360) - 180;
  const abs = Math.abs(normalized);
  if (abs <= 3) return "You are facing the Qibla";
  if (abs <= 12) return "Almost aligned — adjust slightly";
  return normalized > 0 ? "Turn right toward Qibla" : "Turn left toward Qibla";
}

export function calculateQiblaState(location: Coordinates, heading: number) {
  const qiblaAngle = calculateQiblaAngle(location);
  const headingNormalized = normalizeDegrees(heading);
  const offset = ((qiblaAngle - headingNormalized + 540) % 360) - 180;
  return {
    qiblaAngle,
    heading: headingNormalized,
    offset,
    directionText: getDirectionText(qiblaAngle),
    distanceKm: calculateDistanceToKaaba(location),
    guidance: getQiblaTurnGuidance(offset),
  };
}
