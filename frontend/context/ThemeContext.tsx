import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, DARK_COLORS } from '@/constants/theme';

export type ThemeMode = 'System Default' | 'Light Mode' | 'Dark Mode';
export type FontSizeScale = 'Small' | 'Medium' | 'Large' | 'Extra Large';

interface ThemeContextType {
  themeMode: ThemeMode;
  fontSizeScale: FontSizeScale;
  isDark: boolean;
  colors: typeof COLORS;
  fontScale: number;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setFontSizeScale: (scale: FontSizeScale) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType>({
  themeMode: 'System Default',
  fontSizeScale: 'Medium',
  isDark: false,
  colors: COLORS,
  fontScale: 1.0,
  setThemeMode: async () => {},
  setFontSizeScale: async () => {},
});

const THEME_PREF_KEY = 'settings_theme';
const FONT_SIZE_PREF_KEY = 'settings_font_size';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('System Default');
  const [fontSizeScale, setFontSizeScaleState] = useState<FontSizeScale>('Medium');

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [savedTheme, savedFont] = await Promise.all([
          AsyncStorage.getItem(THEME_PREF_KEY),
          AsyncStorage.getItem(FONT_SIZE_PREF_KEY),
        ]);
        if (savedTheme === 'Light Mode' || savedTheme === 'Dark Mode' || savedTheme === 'System Default') {
          setThemeModeState(savedTheme);
        }
        if (savedFont === 'Small' || savedFont === 'Medium' || savedFont === 'Large' || savedFont === 'Extra Large') {
          setFontSizeScaleState(savedFont);
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
    <ThemeContext.Provider value={{ themeMode, fontSizeScale, isDark, colors, fontScale, setThemeMode, setFontSizeScale }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
