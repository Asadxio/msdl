import AsyncStorage from '@react-native-async-storage/async-storage';

export type ReadingTheme = 'light' | 'night' | 'sepia';

export interface BookReadingProgress {
  bookId: string;
  lastPage: number;
  totalPages?: number;
  theme: ReadingTheme;
  lastReadAt: number;
}

const READING_PROGRESS_PREFIX = '@msdl_book_progress_';
const GLOBAL_THEME_KEY = '@msdl_library_theme';

export async function getBookProgress(bookId: string): Promise<BookReadingProgress | null> {
  try {
    const raw = await AsyncStorage.getItem(`${READING_PROGRESS_PREFIX}${bookId}`);
    if (!raw) return null;
    return JSON.parse(raw) as BookReadingProgress;
  } catch {
    return null;
  }
}

export async function saveBookProgress(
  bookId: string,
  page: number,
  theme: ReadingTheme = 'light',
  totalPages?: number
): Promise<void> {
  try {
    const progress: BookReadingProgress = {
      bookId,
      lastPage: Math.max(1, page),
      totalPages: totalPages && totalPages > 0 ? totalPages : undefined,
      theme,
      lastReadAt: Date.now(),
    };
    await AsyncStorage.setItem(`${READING_PROGRESS_PREFIX}${bookId}`, JSON.stringify(progress));
  } catch {
    // ignore
  }
}

export async function getLibraryTheme(): Promise<ReadingTheme> {
  try {
    const theme = await AsyncStorage.getItem(GLOBAL_THEME_KEY);
    if (theme === 'night' || theme === 'sepia' || theme === 'light') {
      return theme;
    }
    return 'light';
  } catch {
    return 'light';
  }
}

export async function saveLibraryTheme(theme: ReadingTheme): Promise<void> {
  try {
    await AsyncStorage.setItem(GLOBAL_THEME_KEY, theme);
  } catch {
    // ignore
  }
}
