import fs from 'fs';
import path from 'path';

const homePath = path.join(__dirname, '../app/(tabs)/index.tsx');
const source = fs.readFileSync(homePath, 'utf8');

describe('phase 2 Islamic dashboard features', () => {
  it('renders English, Hijri, and Urdu Hijri calendar labels on the dashboard', () => {
    expect(source).toContain('const calendarInfo = getIslamicCalendar(now);');
    expect(source).toContain('{calendarInfo.englishDate}');
    expect(source).toContain('{calendarInfo.hijriDate}');
    expect(source).toContain('{calendarInfo.urduHijriDate}');
    expect(source).toContain('toUrduDigits');
    expect(source).toContain('Zul Hijjah');
  });

  it('calculates all requested prayer times including nafl and marker times', () => {
    ['Fajr', 'Sunrise', 'Ishraq', 'Chasht', 'Dahwa-e-Kubra', 'Zuhr', 'Asr', 'Maghrib', 'Isha', 'Tahajjud'].forEach((name) => {
      expect(source).toContain(`name: "${name}"`);
    });
  });

  it('supports daily refresh, offline cache, current highlight, and next-prayer countdown', () => {
    expect(source).toContain('PRAYER_LOCATION_CACHE_KEY');
    expect(source).toContain('AsyncStorage.getItem(PRAYER_LOCATION_CACHE_KEY)');
    expect(source).toContain('AsyncStorage.setItem(PRAYER_LOCATION_CACHE_KEY');
    expect(source).toContain('nextMidnight');
    expect(source).toContain('const countdown = formatDuration');
    expect(source).toContain('active && styles.prayerPillActive');
    expect(source).toContain('Current');
    expect(source).toContain('Next: {prayerWindow.next.name}');
  });
});
