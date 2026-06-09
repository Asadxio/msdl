import fs from 'fs';
import path from 'path';
import {
  QIBLA_LOCATION_CACHE_KEY,
  calculateDistanceToKaaba,
  calculateQiblaAngle,
  calculateQiblaState,
  formatDistanceToKaaba,
  getDirectionText,
  getQiblaTurnGuidance,
} from './qibla';

describe('qibla calculations', () => {
  it('calculates expected qibla angle and distance from New York', () => {
    const newYork = { latitude: 40.7128, longitude: -74.006 };
    expect(Math.round(calculateQiblaAngle(newYork))).toBe(58);
    expect(Math.round(calculateDistanceToKaaba(newYork))).toBeGreaterThan(10000);
    expect(formatDistanceToKaaba(calculateDistanceToKaaba(newYork))).toContain('km');
  });

  it('normalizes direction and turn guidance', () => {
    expect(getDirectionText(90)).toBe('East');
    expect(getQiblaTurnGuidance(2)).toBe('Facing Qibla ✓');
    expect(getQiblaTurnGuidance(40)).toBe('Turn Right 40°');
    expect(getQiblaTurnGuidance(-40)).toBe('Turn Left 40°');
  });

  it('returns complete qibla state for UI', () => {
    const state = calculateQiblaState({ latitude: 51.5072, longitude: -0.1276 }, 120);
    expect(state).toEqual(expect.objectContaining({
      qiblaAngle: expect.any(Number),
      heading: 120,
      offset: expect.any(Number),
      directionText: expect.any(String),
      distanceKm: expect.any(Number),
      directionAbbreviation: expect.any(String),
      directionLongText: expect.any(String),
      guidance: expect.any(String),
      aligned: expect.any(Boolean),
    }));
  });

  it('wires Qibla entry points, sensors, camera, and offline cache in screens', () => {
    const qiblaScreen = fs.readFileSync(path.join(__dirname, '../app/qibla.tsx'), 'utf8');
    const moreScreen = fs.readFileSync(path.join(__dirname, '../app/more/applications/index.tsx'), 'utf8');
    const homeScreen = fs.readFileSync(path.join(__dirname, '../app/(tabs)/index.tsx'), 'utf8');

    expect(QIBLA_LOCATION_CACHE_KEY).toBe('qibla_location_cache_v1');
    expect(moreScreen).toContain("route: '/qibla'");
    expect(homeScreen).toContain('Islamic Dashboard relocated to More');
    expect(moreScreen).toContain('Google Camera Qibla Finder (Internet Required)');
    expect(qiblaScreen).toContain('Magnetometer.addListener');
    expect(qiblaScreen).toContain('CameraView');
    expect(qiblaScreen).toContain('GOOGLE_QIBLA_FINDER_URL');
    expect(qiblaScreen).toContain("params.mode === 'camera' || params.mode === 'google'");
    expect(qiblaScreen).toContain("params.mode === 'native-camera'");
    expect(qiblaScreen).toContain('https://qiblafinder.withgoogle.com/');
    expect(qiblaScreen).toContain('Google Qibla Finder will open in your browser.');
    expect(qiblaScreen).toContain('Unable to open Qibla Finder.');
    expect(qiblaScreen).toContain('AsyncStorage.getItem(QIBLA_LOCATION_CACHE_KEY)');
    expect(qiblaScreen).toContain("permission?.status === 'granted'");
    expect(qiblaScreen).toContain('sensorStatus');
    expect(qiblaScreen).toContain('react-native-maps');
    expect(qiblaScreen).toContain('Google Camera Qibla Finder (Internet Required)');
    expect(qiblaScreen).toContain('🧭 Compass Qibla Direction');
    expect(qiblaScreen).not.toContain('WebView');
    expect(qiblaScreen).not.toContain('expo-web-browser');
    expect(qiblaScreen).toContain('Move your phone in a figure-8 motion to improve accuracy.');
    expect(qiblaScreen).toContain('formatDistanceToKaaba(qibla.distanceKm)');
  });
});
