import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SavedSabaqNote {
  id: string;
  topic: string;
  content: string;
  mode: 'tutor' | 'quiz' | 'vocab' | 'summary';
  language: 'en' | 'ur';
  savedAt: number;
  courseTitle?: string;
  lessonTitle?: string;
}

const STORAGE_KEY = '@mslb_saved_sabaq_notes_v1';

export async function getSavedSabaqNotes(): Promise<SavedSabaqNote[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveSabaqNote(note: Omit<SavedSabaqNote, 'id' | 'savedAt'>): Promise<SavedSabaqNote> {
  const existing = await getSavedSabaqNotes();
  const newNote: SavedSabaqNote = {
    ...note,
    id: 'note_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    savedAt: Date.now(),
  };

  const updated = [newNote, ...existing.slice(0, 99)]; // retain up to 100 notes
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return newNote;
}

export async function deleteSabaqNote(id: string): Promise<boolean> {
  try {
    const existing = await getSavedSabaqNotes();
    const filtered = existing.filter((n) => n.id !== id);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch {
    return false;
  }
}
