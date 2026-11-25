import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, DARK_COLORS } from '@/constants/theme';

export type ThemeMode = 'System Default' | 'Light Mode' | 'Dark Mode';
export type FontSizeScale = 'Small' | 'Medium' | 'Large' | 'Extra Large';

export interface ReadingPreferences {
  arabicFontSize: number;
  translationFontSize: number;
  showTransliteration: boolean;
  showUrduTranslation: boolean;
  showEnglishTranslation: boolean;
}

interface ThemeContextType {
  themeMode: ThemeMode;
  fontSizeScale: FontSizeScale;
  isDark: boolean;
  colors: typeof COLORS;
  fontScale: number;
  readingPreferences: ReadingPreferences;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setFontSizeScale: (scale: FontSizeScale) => Promise<void>;
  updateReadingPreferences: (prefs: Partial<ReadingPreferences>) => Promise<void>;
}

const DEFAULT_READING_PREFS: ReadingPreferences = {
  arabicFontSize: 24,
  translationFontSize: 14,
  showTransliteration: true,
  showUrduTranslation: true,
  showEnglishTranslation: true,
};

const ThemeContext = createContext<ThemeContextType>({
  themeMode: 'System Default',
  fontSizeScale: 'Medium',
  isDark: false,
  colors: COLORS,
  fontScale: 1.0,
  readingPreferences: DEFAULT_READING_PREFS,
  setThemeMode: async () => {},
  setFontSizeScale: async () => {},
  updateReadingPreferences: async () => {},
});

const THEME_PREF_KEY = 'settings_theme';
const FONT_SIZE_PREF_KEY = 'settings_font_size';
const READING_PREFS_KEY = '@suffah_reading_prefs_v1';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('System Default');
  const [fontSizeScale, setFontSizeScaleState] = useState<FontSizeScale>('Medium');
  const [readingPreferences, setReadingPreferencesState] = useState<ReadingPreferences>(DEFAULT_READING_PREFS);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [savedTheme, savedFont, savedReading] = await Promise.all([
          AsyncStorage.getItem(THEME_PREF_KEY),
          AsyncStorage.getItem(FONT_SIZE_PREF_KEY),
          AsyncStorage.getItem(READING_PREFS_KEY),
        ]);
        if (savedTheme === 'Light Mode' || savedTheme === 'Dark Mode' || savedTheme === 'System Default') {
          setThemeModeState(savedTheme);
        }
        if (savedFont === 'Small' || savedFont === 'Medium' || savedFont === 'Large' || savedFont === 'Extra Large') {
          setFontSizeScaleState(savedFont);
        }
        if (savedReading) {
          setReadingPreferencesState((prev) => ({
            ...prev,
            ...JSON.parse(savedReading),
          }));
        }
      } catch (err) {
        console.warn('Failed to load theme settings', err);
      }
    };
    void loadSettings();
  }, []);

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem(THEME_PREF_KEY, mode);
    } catch {}
  };

  const setFontSizeScale = async (scale: FontSizeScale) => {
    setFontSizeScaleState(scale);
    try {
      await AsyncStorage.setItem(FONT_SIZE_PREF_KEY, scale);
    } catch {}
  };

  const updateReadingPreferences = async (prefs: Partial<ReadingPreferences>) => {
    setReadingPreferencesState((prev) => {
      const updated = { ...prev, ...prefs };
      AsyncStorage.setItem(READING_PREFS_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  };

  const isDark =
    themeMode === 'Dark Mode' ? true :
    themeMode === 'Light Mode' ? false :
    systemColorScheme === 'dark';

  const colors = isDark ? DARK_COLORS : COLORS;

  const fontScale =
    fontSizeScale === 'Small' ? 0.85 :
    fontSizeScale === 'Large' ? 1.15 :
    fontSizeScale === 'Extra Large' ? 1.3 :
    1.0;

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        fontSizeScale,
        isDark,
        colors,
        fontScale,
        readingPreferences,
        setThemeMode,
        setFontSizeScale,
        updateReadingPreferences,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

export const useReadingPreferences = () => {
  const { readingPreferences, updateReadingPreferences } = useTheme();
  return { readingPreferences, updateReadingPreferences };
};
