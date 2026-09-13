jest.mock('expo-constants', () => ({
  expoConfig: {
    version: '1.0.7',
    android: { versionCode: 40 },
  },
}));

jest.mock('./firebase', () => ({
  db: {},
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
}));

import {
  compareSemver,
  evaluateVersionRequirements,
  type VersionControlConfig,
} from './versionCheck';

describe('versionCheck', () => {
  describe('compareSemver', () => {
    it('returns 0 when versions are equal', () => {
      expect(compareSemver('1.0.7', '1.0.7')).toBe(0);
      expect(compareSemver('1.0', '1.0.0')).toBe(0);
    });

    it('returns 1 when v1 is higher than v2', () => {
      expect(compareSemver('1.0.8', '1.0.7')).toBe(1);
      expect(compareSemver('1.1.0', '1.0.9')).toBe(1);
      expect(compareSemver('2.0.0', '1.9.9')).toBe(1);
    });

    it('returns -1 when v1 is lower than v2', () => {
      expect(compareSemver('1.0.6', '1.0.7')).toBe(-1);
      expect(compareSemver('1.0.0', '1.0.1')).toBe(-1);
      expect(compareSemver('0.9.9', '1.0.0')).toBe(-1);
    });
  });

  describe('evaluateVersionRequirements', () => {
    const baseConfig: VersionControlConfig = {
      min_version: '1.0.5',
      min_version_code: 38,
      latest_version: '1.0.7',
      latest_version_code: 40,
      update_url: 'market://details?id=com.madrasatussalikat.lilbanat',
    };

    it('returns ok when current version is at latest', () => {
      const result = evaluateVersionRequirements(baseConfig, { version: '1.0.7', versionCode: 40 });
      expect(result.type).toBe('ok');
    });

    it('triggers force_update when version is below min_version', () => {
      const result = evaluateVersionRequirements(baseConfig, { version: '1.0.4', versionCode: 36 });
      expect(result.type).toBe('force_update');
      if (result.type === 'force_update') {
        expect(result.minVersion).toBe('1.0.5');
      }
    });

    it('triggers force_update when versionCode is below min_version_code', () => {
      const result = evaluateVersionRequirements(baseConfig, { version: '1.0.5', versionCode: 37 });
      expect(result.type).toBe('force_update');
    });

    it('triggers soft_update when version is between min and latest', () => {
      const result = evaluateVersionRequirements(baseConfig, { version: '1.0.6', versionCode: 39 });
      expect(result.type).toBe('soft_update');
      if (result.type === 'soft_update') {
        expect(result.latestVersion).toBe('1.0.7');
      }
    });

    it('triggers maintenance mode when maintenance_mode flag is true', () => {
      const maintConfig: VersionControlConfig = {
        ...baseConfig,
        maintenance_mode: true,
        maintenance_message_en: 'Upgrading database servers.',
      };
      const result = evaluateVersionRequirements(maintConfig, { version: '1.0.7', versionCode: 40 });
      expect(result.type).toBe('maintenance');
      if (result.type === 'maintenance') {
        expect(result.message).toBe('Upgrading database servers.');
      }
    });
  });
});
