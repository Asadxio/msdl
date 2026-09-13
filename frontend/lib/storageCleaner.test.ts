jest.mock('expo-file-system', () => ({
  Paths: {
    document: { exists: true, list: () => [] },
    cache: { exists: true, list: () => [] },
  },
  Directory: jest.fn().mockImplementation(() => ({
    exists: true,
    list: () => [],
  })),
  File: jest.fn().mockImplementation(() => ({
    exists: true,
    size: 1024,
    delete: jest.fn(),
  })),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  removeItem: jest.fn().mockResolvedValue(undefined),
  multiRemove: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('./quranAudioDownloader', () => ({
  DOWNLOADED_SURAHS_INDEX_KEY: '@msdl_downloaded_surahs_index',
}));

jest.mock('./lmsHardening', () => ({
  clearQuizCounts: jest.fn().mockResolvedValue(undefined),
}));

import { formatBytes, DISPOSABLE_ASYNC_KEYS } from './storageCleaner';

describe('storageCleaner', () => {
  describe('formatBytes', () => {
    it('handles zero or negative bytes', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(-50)).toBe('0 B');
    });

    it('formats bytes under 1 KB', () => {
      expect(formatBytes(512)).toBe('512 B');
      expect(formatBytes(1023)).toBe('1023 B');
    });

    it('formats kilobytes', () => {
      expect(formatBytes(1024)).toBe('1.0 KB');
      expect(formatBytes(1024 * 50)).toBe('50.0 KB');
    });

    it('formats megabytes', () => {
      expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
      expect(formatBytes(1024 * 1024 * 42.5)).toBe('42.5 MB');
    });

    it('formats gigabytes', () => {
      expect(formatBytes(1024 * 1024 * 1024 * 1.5)).toBe('1.5 GB');
    });
  });

  describe('DISPOSABLE_ASYNC_KEYS', () => {
    it('contains expected disposable cache keys without touching auth tokens or bookmarks', () => {
      expect(DISPOSABLE_ASYNC_KEYS).toContain('cached_announcements');
      expect(DISPOSABLE_ASYNC_KEYS).toContain('offline_library_manifest_temp');

      // Crucial safety assertion: never include user auth or bookmarks in disposable list
      expect(DISPOSABLE_ASYNC_KEYS).not.toContain('@msdl_quran_bookmarks');
      expect(DISPOSABLE_ASYNC_KEYS).not.toContain('@msdl_quran_khatam');
      expect(DISPOSABLE_ASYNC_KEYS).not.toContain('@msdl_user_token');
      expect(DISPOSABLE_ASYNC_KEYS).not.toContain('auth_user_session');
    });
  });
});
