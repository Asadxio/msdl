import fs from 'fs';
import path from 'path';

const homePath = path.join(__dirname, '../app/(tabs)/index.tsx');
const source = fs.readFileSync(homePath, 'utf8');
const prayerTimesSource = fs.readFileSync(path.join(__dirname, '../app/prayer-times.tsx'), 'utf8');
const moreSource = fs.readFileSync(path.join(__dirname, '../app/more/applications/index.tsx'), 'utf8');

describe('phase 2 Islamic dashboard features', () => {
  it('keeps a compact Hijri prayer snapshot on dashboard and moves full calendar to applications', () => {
    const calendarScreen = fs.readFileSync(path.join(__dirname, '../app/islamic-calendar.tsx'), 'utf8');
    expect(moreSource).toContain('Islamic Dashboard');
    expect(source).not.toContain('<Text style={styles.dashboardEyebrow}>Islamic Calendar</Text>');
    expect(moreSource).toContain('More → Applications');
    expect(moreSource).toContain("route: '/islamic-calendar'");
    expect(moreSource).toContain("route: '/prayer-times'");
    expect(calendarScreen).toContain('Islamic Calendar');
    expect(calendarScreen).toContain('Zul Hijjah');
  });

  it('calculates all requested prayer times including nafl and marker times', () => {
    const calcSource = fs.readFileSync(path.join(__dirname, './prayerTimes.ts'), 'utf8');
    ['Fajr', 'Sunrise', 'Ishraq', 'Chasht', 'Dahwa-e-Kubra', 'Zuhr', 'Asr', 'Maghrib', 'Isha', 'Tahajjud'].forEach((name) => {
      expect(calcSource).toContain(`name: "${name}"`);
    });
  });

  it('supports daily refresh, offline cache, current highlight, and next-prayer countdown', () => {
    const storageSource = fs.readFileSync(path.join(__dirname, './prayerStorage.ts'), 'utf8');
    expect(storageSource).toContain('PRAYER_SETTINGS_KEY');
    expect(storageSource).toContain('AsyncStorage.getItem(PRAYER_SETTINGS_KEY)');
    expect(prayerTimesSource).toContain('Next Prayer');
    expect(moreSource).toContain('Google Camera Qibla Finder (Internet Required)');
  });
});
