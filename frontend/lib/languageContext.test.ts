import {
  translations,
  LANGUAGE_OPTIONS,
  LANGUAGE_STORAGE_KEY,
  getUrduFontFamily,
} from '../context/LanguageContext';

describe('1-Tap Language & Nastaliq Switcher Module', () => {
  it('supports 4 official language modes', () => {
    expect(LANGUAGE_OPTIONS.map((o) => o.code)).toEqual(['ur', 'roman_ur', 'en', 'ar']);
  });

  it('contains valid translations for all 4 language dictionaries', () => {
    const enTabs = translations.en.tabs as Record<string, string>;
    const urTabs = translations.ur.tabs as Record<string, string>;
    const romanUrTabs = translations.roman_ur.tabs as Record<string, string>;
    const arTabs = translations.ar.tabs as Record<string, string>;

    expect(enTabs.home).toBe('Home');
    expect(urTabs.home).toBe('صفحہ اول');
    expect(romanUrTabs.home).toBe('Home');
    expect(arTabs.home).toBe('الرئيسية');

    expect(urTabs.fatawa).toBe('دار الافتاء');
    expect(romanUrTabs.fatawa).toBe('Dar-ul-Iftaa');
    expect(arTabs.fatawa).toBe('دار الإفتاء');
  });

  it('provides appropriate font family for Urdu and Arabic script', () => {
    const font = getUrduFontFamily();
    expect(typeof font).toBe('string');
    expect(font.length).toBeGreaterThan(0);
  });

  it('uses consistent AsyncStorage persistence key', () => {
    expect(LANGUAGE_STORAGE_KEY).toBe('@msdl_app_language');
  });
});
