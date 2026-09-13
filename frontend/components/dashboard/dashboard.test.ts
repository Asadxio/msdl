import { ALL_QUICK_ACCESS_SERVICES } from '../../lib/quickAccessData';
import { COLORS } from '@/constants/theme';
import * as fs from 'fs';
import * as path from 'path';

describe('Student Dashboard Redesign Verification', () => {
  describe('Quick Access Inventory Preservation', () => {
    it('contains all 18 mandatory services without any omission', () => {
      expect(ALL_QUICK_ACCESS_SERVICES).toHaveLength(18);

      const serviceNames = ALL_QUICK_ACCESS_SERVICES.map((s) => s.name);
      expect(serviceNames).toContain('Quran Karim');
      expect(serviceNames).toContain('My Courses');
      expect(serviceNames).toContain('Taharat Tracker');
      expect(serviceNames).toContain('AI Sabaq Tutor');
      expect(serviceNames).toContain('Flashcards');
      expect(serviceNames).toContain('Dar-ul-Iftaa');
      expect(serviceNames).toContain('Referral Rewards');
      expect(serviceNames).toContain('Smart Tasbeeh');
      expect(serviceNames).toContain('Sanad / Cert');
      expect(serviceNames).toContain('Pay Fees');
      expect(serviceNames).toContain('Live Classes');
      expect(serviceNames).toContain('Dars Audio');
      expect(serviceNames).toContain('Library');
      expect(serviceNames).toContain('Quiz');
      expect(serviceNames).toContain('Prayer Times');
      expect(serviceNames).toContain('Qibla Finder');
      expect(serviceNames).toContain('Hijri Calendar');
      expect(serviceNames).toContain('All Services');
    });

    it('each service has a valid route, title, subtitle, and icon', () => {
      ALL_QUICK_ACCESS_SERVICES.forEach((service) => {
        expect(service.name).toBeTruthy();
        expect(service.subtitle).toBeTruthy();
        expect(service.icon).toBeTruthy();
        expect(service.route).toBeTruthy();
        expect(service.route.startsWith('/')).toBe(true);
      });
    });
  });

  describe('Design System Color Tokens', () => {
    it('implements the specified premium Islamic palette', () => {
      expect(COLORS.primary).toBe('#075B49'); // Primary Emerald
      expect(COLORS.primaryDeep).toBe('#043C32'); // Deep Emerald
      expect(COLORS.background).toBe('#F7F5EF'); // Warm Ivory Background
      expect(COLORS.surface).toBe('#FFFFFF'); // Card White
      expect(COLORS.text).toBe('#17332C'); // Dark Text
      expect(COLORS.gold).toBe('#C6A15B'); // Gold Accent
      expect(COLORS.lightChampagne).toBe('#D8C28A'); // Light Champagne
      expect(COLORS.secondaryText).toBe('#71817B'); // Secondary Text
      expect(COLORS.border).toBe('#E7E4DA'); // Border
    });
  });

  describe('Graphic Assets Verification', () => {
    const assetsDir = path.resolve(__dirname, '../../assets/images');

    it('header background asset exists and is non-empty', () => {
      const headerPath = path.join(assetsDir, 'islamic_header_bg.jpg');
      expect(fs.existsSync(headerPath)).toBe(true);
      expect(fs.statSync(headerPath).size).toBeGreaterThan(1000);
    });

    it('daily wisdom lantern asset exists and is non-empty', () => {
      const lanternPath = path.join(assetsDir, 'islamic_lantern_art.jpg');
      expect(fs.existsSync(lanternPath)).toBe(true);
      expect(fs.statSync(lanternPath).size).toBeGreaterThan(1000);
    });

    it('prayer mosque artwork asset exists and is non-empty', () => {
      const mosquePath = path.join(assetsDir, 'prayer_mosque_art.jpg');
      expect(fs.existsSync(mosquePath)).toBe(true);
      expect(fs.statSync(mosquePath).size).toBeGreaterThan(1000);
    });

    it('islamic geometric pattern SVG exists and is non-empty', () => {
      const patternPath = path.join(assetsDir, 'islamic_geometric_pattern.svg');
      expect(fs.existsSync(patternPath)).toBe(true);
      expect(fs.statSync(patternPath).size).toBeGreaterThan(100);
    });
  });

  describe('Component Architecture Verification', () => {
    const compDir = __dirname;

    it('all 6 modular dashboard component files exist', () => {
      const expectedComponents = [
        'StudentLearningCard.tsx',
        'DailyWisdomCard.tsx',
        'SpiritualMomentsRow.tsx',
        'PrayerTimesHeroCard.tsx',
        'TodaysJourneyCard.tsx',
        'QuickAccessGrid.tsx',
      ];
      expectedComponents.forEach((file) => {
        const filePath = path.join(compDir, file);
        expect(fs.existsSync(filePath)).toBe(true);
        expect(fs.statSync(filePath).size).toBeGreaterThan(500);
      });
    });

    it('Quick Access services have distinct and coherent icons', () => {
      const flashcard = ALL_QUICK_ACCESS_SERVICES.find((s) => s.name === 'Flashcards');
      const payFees = ALL_QUICK_ACCESS_SERVICES.find((s) => s.name === 'Pay Fees');
      const taharat = ALL_QUICK_ACCESS_SERVICES.find((s) => s.name === 'Taharat Tracker');

      expect(flashcard?.icon).toBe('layers-outline');
      expect(payFees?.icon).toBe('wallet-outline');
      expect(taharat?.icon).toBe('water-outline');
    });

    it('Quick Access subtitles are concise to prevent text truncation on narrow screens', () => {
      ALL_QUICK_ACCESS_SERVICES.forEach((service) => {
        expect(service.subtitle.length).toBeLessThanOrEqual(16);
      });
    });
  });
});
