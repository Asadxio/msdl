import AsyncStorage from '@react-native-async-storage/async-storage';

const FATAWA_BOOKMARKS_KEY = 'mslb_fatawa_bookmarks_v1';

let memoryBookmarks: string[] = [];

export async function getBookmarkedFatawaIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(FATAWA_BOOKMARKS_KEY);
    if (!raw) return memoryBookmarks;
    memoryBookmarks = JSON.parse(raw) as string[];
    return memoryBookmarks;
  } catch {
    return memoryBookmarks;
  }
}

export async function isFatwaBookmarked(id: string): Promise<boolean> {
  const list = await getBookmarkedFatawaIds();
  return list.includes(id);
}

export async function toggleFatwaBookmark(id: string): Promise<boolean> {
  try {
    const list = await getBookmarkedFatawaIds();
    let updated: string[];
    let isNowBookmarked = false;

    if (list.includes(id)) {
      updated = list.filter((item) => item !== id);
      isNowBookmarked = false;
    } else {
      updated = [id, ...list];
      isNowBookmarked = true;
    }

    memoryBookmarks = updated;
    try {
      await AsyncStorage.setItem(FATAWA_BOOKMARKS_KEY, JSON.stringify(updated));
    } catch {}
    return isNowBookmarked;
  } catch {
    return false;
  }
}
