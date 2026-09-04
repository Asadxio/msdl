import AsyncStorage from '@react-native-async-storage/async-storage';

export type ReadingTheme = 'light' | 'night' | 'sepia';

export interface BookReadingProgress {
  bookId: string;
  lastPage: number;
  totalPages?: number;
  theme: ReadingTheme;
  lastReadAt: number;
  readCount?: number;
}

export type NoteHighlightColor = 'yellow' | 'green' | 'blue' | 'pink';

export interface BookNote {
  id: string;
  bookId: string;
  page: number;
  color: NoteHighlightColor;
  title?: string;
  text: string;
  createdAt: number;
}

const READING_PROGRESS_PREFIX = '@msdl_book_progress_';
const BOOK_NOTES_PREFIX = '@msdl_book_notes_';
const BOOK_READ_COUNTS_KEY = '@msdl_book_read_counts_v1';
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
    const existing = await getBookProgress(bookId);
    const progress: BookReadingProgress = {
      bookId,
      lastPage: Math.max(1, page),
      totalPages: (totalPages && totalPages > 0) ? totalPages : (existing?.totalPages || undefined),
      theme,
      lastReadAt: Date.now(),
      readCount: existing?.readCount || 1,
    };
    await AsyncStorage.setItem(`${READING_PROGRESS_PREFIX}${bookId}`, JSON.stringify(progress));
  } catch {
    // ignore
  }
}

export async function getAllBooksProgress(bookIds: string[]): Promise<Record<string, BookReadingProgress>> {
  const result: Record<string, BookReadingProgress> = {};
  if (!bookIds.length) return result;
  try {
    const keys = bookIds.map((id) => `${READING_PROGRESS_PREFIX}${id}`);
    const pairs = await AsyncStorage.multiGet(keys);
    for (const [key, val] of pairs) {
      if (val) {
        try {
          const parsed = JSON.parse(val) as BookReadingProgress;
          if (parsed && parsed.bookId) {
            result[parsed.bookId] = parsed;
          }
        } catch {}
      }
    }
  } catch {}
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7.2 Book Highlights & Notes
// ─────────────────────────────────────────────────────────────────────────────

export async function getBookNotes(bookId: string): Promise<BookNote[]> {
  try {
    const raw = await AsyncStorage.getItem(`${BOOK_NOTES_PREFIX}${bookId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function addBookNote(
  bookId: string,
  note: { page: number; color?: NoteHighlightColor; title?: string; text: string }
): Promise<BookNote> {
  const existing = await getBookNotes(bookId);
  const newNote: BookNote = {
    id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    bookId,
    page: Math.max(1, note.page),
    color: note.color || 'yellow',
    title: note.title?.trim() || undefined,
    text: note.text.trim(),
    createdAt: Date.now(),
  };

  const updated = [newNote, ...existing];
  try {
    await AsyncStorage.setItem(`${BOOK_NOTES_PREFIX}${bookId}`, JSON.stringify(updated));
  } catch {}
  return newNote;
}

export async function deleteBookNote(bookId: string, noteId: string): Promise<boolean> {
  try {
    const existing = await getBookNotes(bookId);
    const updated = existing.filter((n) => n.id !== noteId);
    await AsyncStorage.setItem(`${BOOK_NOTES_PREFIX}${bookId}`, JSON.stringify(updated));
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7.3 Read Counts & Popularity
// ─────────────────────────────────────────────────────────────────────────────

export async function getBookReadCounts(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(BOOK_READ_COUNTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export async function incrementBookReadCount(bookId: string): Promise<number> {
  try {
    const counts = await getBookReadCounts();
    const current = counts[bookId] || 0;
    const next = current + 1;
    counts[bookId] = next;
    await AsyncStorage.setItem(BOOK_READ_COUNTS_KEY, JSON.stringify(counts));
    return next;
  } catch {
    return 1;
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

