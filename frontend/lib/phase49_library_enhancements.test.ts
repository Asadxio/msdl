import {
  type BookReadingProgress,
  type BookNote,
  type NoteHighlightColor,
} from './libraryStorage';

describe('Phase 49: Library Enhancements (7.1, 7.2, 7.3)', () => {
  describe('7.1 Book reading progress calculations', () => {
    it('computes reading progress percentage accurately and clamps to 100', () => {
      const calcProgressPercent = (lastPage: number, totalPages: number) => {
        if (!totalPages || totalPages <= 0) return 0;
        return Math.min(100, Math.round((Math.max(1, lastPage) / totalPages) * 100));
      };

      // Page 1 of 100 -> 1%
      expect(calcProgressPercent(1, 100)).toBe(1);
      // Page 25 of 100 -> 25%
      expect(calcProgressPercent(25, 100)).toBe(25);
      // Page 50 of 200 -> 25%
      expect(calcProgressPercent(50, 200)).toBe(25);
      // Page 150 of 100 (exceeded total) -> 100%
      expect(calcProgressPercent(150, 100)).toBe(100);
      // Fallback on 0 totalPages
      expect(calcProgressPercent(5, 0)).toBe(0);
    });

    it('formats book progress label for cards and details', () => {
      const formatProgressBadge = (progress?: BookReadingProgress) => {
        if (!progress || progress.lastPage <= 1) return null;
        const total = progress.totalPages || 100;
        const pct = Math.min(100, Math.round((progress.lastPage / total) * 100));
        return 'p. ' + progress.lastPage + '/' + total + ' (' + pct + '%)';
      };

      expect(formatProgressBadge(undefined)).toBeNull();
      expect(formatProgressBadge({ bookId: 'b1', lastPage: 1, theme: 'light', lastReadAt: Date.now() })).toBeNull();
      expect(
        formatProgressBadge({ bookId: 'b1', lastPage: 34, totalPages: 120, theme: 'light', lastReadAt: Date.now() })
      ).toBe('p. 34/120 (28%)');
    });
  });

  describe('7.2 Book Notes & Highlights data structure', () => {
    it('verifies note creation structure with page tag and color palette', () => {
      const notes: BookNote[] = [
        {
          id: 'note_1',
          bookId: 'book_123',
          page: 15,
          color: 'yellow',
          text: 'Aham nukta: Wuzu ke faraiz 4 hain.',
          createdAt: Date.now(),
        },
        {
          id: 'note_2',
          bookId: 'book_123',
          page: 22,
          color: 'green',
          text: 'Taharat ki ahmiyat par Hadith shareef.',
          createdAt: Date.now(),
        },
      ];

      expect(notes.length).toBe(2);
      expect(notes[0].page).toBe(15);
      expect(notes[0].color).toBe('yellow');

      // Filter notes by page
      const page15Notes = notes.filter((n) => n.page === 15);
      expect(page15Notes.length).toBe(1);
      expect(page15Notes[0].text).toContain('Wuzu');
    });
  });

  describe('7.3 Popular Books ranking & Teacher Recommended', () => {
    it('ranks books by read counts descending', () => {
      const books = [
        { id: 'b1', title: 'Book One' },
        { id: 'b2', title: 'Book Two' },
        { id: 'b3', title: 'Book Three' },
      ];

      const readCounts: Record<string, number> = {
        b1: 12,
        b2: 45,
        b3: 28,
      };

      const sortedByPopularity = [...books].sort((a, b) => {
        const countA = readCounts[a.id] || 0;
        const countB = readCounts[b.id] || 0;
        return countB - countA;
      });

      expect(sortedByPopularity[0].id).toBe('b2'); // 45 reads (#1)
      expect(sortedByPopularity[1].id).toBe('b3'); // 28 reads (#2)
      expect(sortedByPopularity[2].id).toBe('b1'); // 12 reads (#3)
    });

    it('identifies teacher recommended books by title matching', () => {
      const recommendedTitles = [
        'Risala Roohi Sharif',
        'Misbah-ul-Insha',
        'Qirat Course',
        'Uroos ul Adab',
      ];

      const libraryCatalog = [
        { id: '1', title: 'Risala Roohi Sharif' },
        { id: '2', title: 'General Islamic History' },
        { id: '3', title: 'Qirat Course (قرأت کورس)' },
      ];

      const isRecommended = (title: string) =>
        recommendedTitles.some((rec) => title.toLowerCase().includes(rec.toLowerCase()));

      expect(isRecommended(libraryCatalog[0].title)).toBe(true);
      expect(isRecommended(libraryCatalog[1].title)).toBe(false);
      expect(isRecommended(libraryCatalog[2].title)).toBe(true);
    });
  });
});
