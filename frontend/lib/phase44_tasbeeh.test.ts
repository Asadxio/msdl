import fs from 'fs';
import path from 'path';

describe('Phase 44 — Digital Smart Tasbeeh Counter & Daily Azkar Tracker', () => {
  const tasbeehScreenSrc = fs.readFileSync(path.resolve(__dirname, '../app/tasbeeh.tsx'), 'utf8');
  const tasbeehStorageSrc = fs.readFileSync(path.resolve(__dirname, './tasbeehStorage.ts'), 'utf8');
  const homeScreenSrc = fs.readFileSync(path.resolve(__dirname, '../app/(tabs)/index.tsx'), 'utf8');

  test('tasbeehStorage.ts provides required count persistence methods with non-blocking memory buffering', () => {
    expect(tasbeehStorageSrc).toContain('loadTasbeehStats');
    expect(tasbeehStorageSrc).toContain('saveTasbeehStats');
    expect(tasbeehStorageSrc).toContain('queueTasbeehTap');
    expect(tasbeehStorageSrc).toContain('recordTasbeehTap');
    expect(tasbeehStorageSrc).toContain('recordTasbeehLap');
    expect(tasbeehStorageSrc).toContain('resetDailyTasbeeh');
    expect(tasbeehStorageSrc).toContain('lifetimeCount');
    expect(tasbeehStorageSrc).toContain('streakDays');
  });

  test('DHIKR_PRESETS contains Islamic zikrs and Tasbeeh-e-Fatima', () => {
    expect(tasbeehScreenSrc).toContain('DHIKR_PRESETS');
    expect(tasbeehScreenSrc).toContain('fatima');
    expect(tasbeehScreenSrc).toContain('subhanallah');
    expect(tasbeehScreenSrc).toContain('alhamdulillah');
    expect(tasbeehScreenSrc).toContain('allahuakbar');
    expect(tasbeehScreenSrc).toContain('astaghfirullah');
    expect(tasbeehScreenSrc).toContain('darood');
  });

  test('tasbeeh.tsx contains ultra-fast touch, haptic feedback, and Fatima auto sequence', () => {
    expect(tasbeehScreenSrc).toContain('handleFastTap');
    expect(tasbeehScreenSrc).toContain('Haptics.impactAsync');
    expect(tasbeehScreenSrc).toContain('fatimaStep');
    expect(tasbeehScreenSrc).toContain('SubhanAllah (1/3)');
    expect(tasbeehScreenSrc).toContain('Alhamdulillah (2/3)');
    expect(tasbeehScreenSrc).toContain('Allahu Akbar (3/3)');
    expect(tasbeehScreenSrc).toContain('fullScreenMode');
  });

  test('index.tsx includes Digital Smart Tasbeeh shortcut in Islamic Utilities', () => {
    expect(homeScreenSrc).toContain('Smart Tasbeeh');
    expect(homeScreenSrc).toContain('/tasbeeh');
    expect(homeScreenSrc).toContain('islamicGridRow');
  });

  test('9.1 Vibration on target reached triggers multi-burst haptic vibration sequence', () => {
    expect(tasbeehScreenSrc).toContain('triggerCelebrationVibration');
    expect(tasbeehScreenSrc).toContain('Haptics.notificationAsync');
    expect(tasbeehScreenSrc).toContain('Haptics.NotificationFeedbackType.Success');
    expect(tasbeehScreenSrc).toContain('Haptics.ImpactFeedbackStyle.Heavy');
    expect(tasbeehScreenSrc).toContain('celebrateAnim');
    expect(tasbeehScreenSrc).toContain('celebrateGlow');
  });

  test('9.2 7-day daily history stats and bar chart are provided', () => {
    expect(tasbeehStorageSrc).toContain('dailyHistory');
    expect(tasbeehScreenSrc).toContain('past7DaysData');
    expect(tasbeehScreenSrc).toContain('chartContainer');
    expect(tasbeehScreenSrc).toContain('7-Day Dhikr Activity');
    expect(tasbeehScreenSrc).toContain('barFill');
  });

  test('9.3 Custom Dhikr creation, persistence, selection and deletion are supported', () => {
    expect(tasbeehStorageSrc).toContain('loadCustomDhikrs');
    expect(tasbeehStorageSrc).toContain('saveCustomDhikrs');
    expect(tasbeehStorageSrc).toContain('addCustomDhikr');
    expect(tasbeehStorageSrc).toContain('deleteCustomDhikr');
    expect(tasbeehScreenSrc).toContain('handleCreateCustomDhikr');
    expect(tasbeehScreenSrc).toContain('handleDeleteCustomDhikr');
    expect(tasbeehScreenSrc).toContain('showAddDhikrModal');
    expect(tasbeehScreenSrc).toContain('Apna Dhikr Jodein');
  });
});
