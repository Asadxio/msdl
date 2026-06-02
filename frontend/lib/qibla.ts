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

const CARDINAL_8 = [
  "North",
  "North-East",
  "East",
  "South-East",
  "South",
  "South-West",
  "West",
  "North-West",
];

const CARDINAL_16 = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
];

const CARDINAL_16_LONG = [
  "North",
  "North North East",
  "North East",
  "East North East",
  "East",
  "East South East",
  "South East",
  "South South East",
  "South",
  "South South West",
  "South West",
  "West South West",
  "West",
  "West North West",
  "North West",
  "North North West",
];

export function getDirectionText(angle: number) {
  const index = Math.round(normalizeDegrees(angle) / 45) % CARDINAL_8.length;
  return CARDINAL_8[index];
}

export function getDirectionAbbreviation(angle: number) {
  const index = Math.round(normalizeDegrees(angle) / 22.5) % CARDINAL_16.length;
  return CARDINAL_16[index];
}

export function getDirectionLongText(angle: number) {
  const index = Math.round(normalizeDegrees(angle) / 22.5) % CARDINAL_16_LONG.length;
  return CARDINAL_16_LONG[index];
}

export function getQiblaTurnGuidance(offset: number) {
  const normalized = ((offset + 540) % 360) - 180;
  const abs = Math.abs(normalized);
  if (abs <= 3) return "Facing Qibla ✓";
  return normalized > 0 ? `Turn Right ${Math.round(abs)}°` : `Turn Left ${Math.round(abs)}°`;
}

export function getLegacyQiblaTurnGuidance(offset: number) {
  const normalized = ((offset + 540) % 360) - 180;
  const abs = Math.abs(normalized);
  if (abs <= 3) return "You are facing the Qibla";
  if (abs <= 12) return "Almost aligned — adjust slightly";
  return normalized > 0 ? "Turn right toward Qibla" : "Turn left toward Qibla";
}

export function getCompassAccuracyLabel(accuracyDegrees?: number | null) {
  if (typeof accuracyDegrees !== "number" || !Number.isFinite(accuracyDegrees)) return "Medium";
  if (accuracyDegrees <= 15) return "High";
  if (accuracyDegrees <= 35) return "Medium";
  return "Low";
}

export function calculateMapLine(from: Coordinates) {
  return [from, KAABA_COORDINATES];
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
    directionAbbreviation: getDirectionAbbreviation(qiblaAngle),
    directionLongText: getDirectionLongText(qiblaAngle),
    distanceKm: calculateDistanceToKaaba(location),
    guidance: getQiblaTurnGuidance(offset),
    legacyGuidance: getLegacyQiblaTurnGuidance(offset),
    aligned: Math.abs(offset) <= 3,
  };
}
