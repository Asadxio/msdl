import fs from 'fs';
import path from 'path';

const librarySource = fs.readFileSync(path.join(__dirname, '../app/(tabs)/library.tsx'), 'utf8');
const dataContextSource = fs.readFileSync(path.join(__dirname, '../context/DataContext.tsx'), 'utf8');

describe('student library manual refresh', () => {
  it('adds a top-right refresh button with loading animation and disabled state', () => {
    expect(librarySource).toContain('testID="library-refresh-btn"');
    expect(librarySource).toContain('accessibilityLabel="Refresh library"');
    expect(librarySource).toContain('Animated.loop');
    expect(librarySource).toContain('Easing.linear');
    expect(librarySource).toContain('disabled={refreshing || booksLoading}');
    expect(librarySource).toContain("refreshing ? 'Refreshing library...'");
  });

  it('reuses library and category Firestore queries without adding duplicate listeners', () => {
    expect(dataContextSource).toContain("getDocs(collection(db, 'library'))");
    expect(librarySource).toContain('const ok = await refetchBooks();');
    expect(librarySource).toContain("query(collection(db, 'categories'), orderBy('name'))");
    expect(librarySource).toContain('const snap = await getDocs(q);');
    expect(librarySource).toContain('onSnapshot(q, (snap) => {');
    expect(librarySource).toContain('return unsub;');
  });

  it('shows the required refresh failure message without changing permissions/uploads/downloads', () => {
    expect(librarySource).toContain('Unable to refresh library. Please try again.');
    expect(librarySource).not.toContain('uploadBytes');
    expect(librarySource).not.toContain('getDownloadURL');
    expect(librarySource).not.toContain('allow read');
  });
});
