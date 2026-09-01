import { getBookmarkedFatawaIds, isFatwaBookmarked, toggleFatwaBookmark } from './fatawaBookmarks';

describe('Fatawa Bookmarks Module', () => {
  it('initializes with empty bookmarks', async () => {
    const list = await getBookmarkedFatawaIds();
    expect(Array.isArray(list)).toBe(true);
  });

  it('toggles bookmark on and off', async () => {
    const isNowBookmarked = await toggleFatwaBookmark('fatwa_123');
    expect(isNowBookmarked).toBe(true);
    expect(await isFatwaBookmarked('fatwa_123')).toBe(true);

    const isNowRemoved = await toggleFatwaBookmark('fatwa_123');
    expect(isNowRemoved).toBe(false);
    expect(await isFatwaBookmarked('fatwa_123')).toBe(false);
  });
});
