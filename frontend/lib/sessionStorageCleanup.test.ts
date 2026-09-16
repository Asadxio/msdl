let mockStore: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(async (key: string, val: string) => {
    mockStore[key] = String(val);
  }),
  getItem: jest.fn(async (key: string) => mockStore[key] ?? null),
  removeItem: jest.fn(async (key: string) => {
    delete mockStore[key];
  }),
  getAllKeys: jest.fn(async () => Object.keys(mockStore)),
  multiRemove: jest.fn(async (keys: string[]) => {
    keys.forEach((k) => delete mockStore[k]);
  }),
  clear: jest.fn(async () => {
    mockStore = {};
  }),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  cleanupSessionStorageOnSignOut,
  isPreservedKey,
} from './sessionStorageCleanup';

describe('Safe AsyncStorage Logout Cleanup (Task 3)', () => {
  beforeEach(async () => {
    mockStore = {};
    jest.clearAllMocks();
  });

  test('isPreservedKey correctly identifies app-global utility keys and scripture cache', () => {
    expect(isPreservedKey('MSLB_INSTALLED_v3')).toBe(true);
    expect(isPreservedKey('prayer_settings_v4')).toBe(true);
    expect(isPreservedKey('@msdl_app_language')).toBe(true);
    expect(isPreservedKey('settings_theme')).toBe(true);
    expect(isPreservedKey('@msdl_quran_font_size')).toBe(true);
    expect(isPreservedKey('mslb_tasbeeh_stats_v2')).toBe(true);
    expect(isPreservedKey('@msdl_quran_cache_1')).toBe(true);

    // Sensitive / session keys must NOT be preserved
    expect(isPreservedKey('profile_cache_user123')).toBe(false);
    expect(isPreservedKey('verification_resend_user123')).toBe(false);
    expect(isPreservedKey('mslb_active_org_id')).toBe(false);
    expect(isPreservedKey('@msdl_taharat_secure_entries')).toBe(false);
    expect(isPreservedKey('@msdl_taharat_security_pin')).toBe(false);
    expect(isPreservedKey('@msdl_qaza_namaz_record')).toBe(false);
    expect(isPreservedKey('STORAGE_KEY_AI_CHAT')).toBe(false);
    expect(isPreservedKey('assignment_draft_user123_assign1')).toBe(false);
  });

  test('cleanupSessionStorageOnSignOut removes user-specific cache and preserves device preferences', async () => {
    // 1. Seed device preferences (should survive logout)
    await AsyncStorage.setItem('prayer_settings_v4', JSON.stringify({ method: 'Karachi', asr: 'Hanafi' }));
    await AsyncStorage.setItem('@msdl_app_language', 'ur');
    await AsyncStorage.setItem('settings_theme', 'dark');
    await AsyncStorage.setItem('@msdl_quran_font_size', '24');
    await AsyncStorage.setItem('mslb_tasbeeh_stats_v2', '100');
    await AsyncStorage.setItem('MSLB_INSTALLED_v3', '1');
    await AsyncStorage.setItem('@msdl_quran_cache_1', JSON.stringify({ surah: 1 }));

    // 2. Seed user session & private data (MUST BE REMOVED)
    await AsyncStorage.setItem('profile_cache_user123', JSON.stringify({ uid: 'user123', name: 'Zainab' }));
    await AsyncStorage.setItem('verification_resend_user123', '123456');
    await AsyncStorage.setItem('mslb_active_org_id', 'org-abc');
    await AsyncStorage.setItem('@msdl_taharat_secure_entries', JSON.stringify({ entries: [] }));
    await AsyncStorage.setItem('@msdl_taharat_security_pin', '1234');
    await AsyncStorage.setItem('@msdl_qaza_namaz_record', JSON.stringify({ fajr: 5 }));
    await AsyncStorage.setItem('STORAGE_KEY_AI_CHAT', JSON.stringify([{ msg: 'private question' }]));
    await AsyncStorage.setItem('assignment_draft_user123_a1', 'Draft content');

    // 3. Execute selective cleanup
    const result = await cleanupSessionStorageOnSignOut('user123');

    expect(result.removedCount).toBe(8);
    expect(result.preservedCount).toBe(7);

    // 4. Verify preserved keys STILL EXIST
    expect(await AsyncStorage.getItem('prayer_settings_v4')).not.toBeNull();
    expect(await AsyncStorage.getItem('@msdl_app_language')).toBe('ur');
    expect(await AsyncStorage.getItem('settings_theme')).toBe('dark');
    expect(await AsyncStorage.getItem('@msdl_quran_font_size')).toBe('24');
    expect(await AsyncStorage.getItem('mslb_tasbeeh_stats_v2')).toBe('100');
    expect(await AsyncStorage.getItem('MSLB_INSTALLED_v3')).toBe('1');
    expect(await AsyncStorage.getItem('@msdl_quran_cache_1')).not.toBeNull();

    // 5. Verify sensitive user session keys WERE COMPLETELY REMOVED
    expect(await AsyncStorage.getItem('profile_cache_user123')).toBeNull();
    expect(await AsyncStorage.getItem('verification_resend_user123')).toBeNull();
    expect(await AsyncStorage.getItem('mslb_active_org_id')).toBeNull();
    expect(await AsyncStorage.getItem('@msdl_taharat_secure_entries')).toBeNull();
    expect(await AsyncStorage.getItem('@msdl_taharat_security_pin')).toBeNull();
    expect(await AsyncStorage.getItem('@msdl_qaza_namaz_record')).toBeNull();
    expect(await AsyncStorage.getItem('STORAGE_KEY_AI_CHAT')).toBeNull();
    expect(await AsyncStorage.getItem('assignment_draft_user123_a1')).toBeNull();
  });
});
