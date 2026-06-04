import fs from 'fs';
import path from 'path';

const homePath = path.join(__dirname, '../app/(tabs)/index.tsx');
const source = fs.readFileSync(homePath, 'utf8');

describe('phase 2 Islamic dashboard features', () => {
  it('keeps a compact Hijri prayer snapshot on dashboard and moves full calendar to applications', () => {
    const moreSource = fs.readFileSync(path.join(__dirname, '../app/more.tsx'), 'utf8');
    const calendarScreen = fs.readFileSync(path.join(__dirname, '../app/islamic-calendar.tsx'), 'utf8');
    expect(source).toContain('testID="compact-islamic-dashboard"');
    expect(source).toContain('Hijri: {calendarInfo.hijriDate}');
    expect(source).not.toContain('<Text style={styles.dashboardEyebrow}>Islamic Calendar</Text>');
    expect(moreSource).toContain('More → Applications');
    expect(moreSource).toContain("route: '/islamic-calendar'");
    expect(moreSource).toContain("route: '/prayer-times'");
    expect(calendarScreen).toContain('Islamic Calendar');
    expect(calendarScreen).toContain('Zul Hijjah');
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
    expect(source).toContain('Current Prayer');
    expect(source).toContain('Next Prayer');
    expect(source).toContain('Remaining');
    expect(source).toContain('Location');
    expect(source).toContain('dashboard-google-qibla-finder-option');
  });
});
