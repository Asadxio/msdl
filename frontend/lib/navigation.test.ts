import fs from 'fs';
import path from 'path';

describe('navigation history preservation audit', () => {
  const appRoot = path.join(__dirname, '../app');
  const read = (relativePath: string) => fs.readFileSync(path.join(appRoot, relativePath), 'utf8');

  it('uses fallback-aware back navigation instead of raw router.back buttons', () => {
    const auditedScreens = [
      'course/[id].tsx',
      'live-class/[id].tsx',
      'chat/[id].tsx',
      'qibla.tsx',
      'islamic-calendar.tsx',
      'prayer-times.tsx',
      'payment.tsx',
      'settings.tsx',
      'recordings.tsx',
      'teacher/[id].tsx',
      'book/[id].tsx',
      'call/[id].tsx',
      'status.tsx',
      'status-player.tsx',
      'admin/add-book.tsx',
      'admin/analytics.tsx',
      'admin/manage-academics.tsx',
      'admin/payments.tsx',
      'admin/privacy-requests.tsx',
      'admin/users.tsx',
      'privacy.tsx',
      'data-privacy.tsx',
      'unauthorized.tsx',
      'islamic-dashboard.tsx',
    ];

    auditedScreens.forEach((screen) => {
      const source = read(screen);
      expect(source).toContain('goBackOrReplace');
      expect(source).not.toContain('router.back()');
    });
  });

  it('registers application, legal, payment, course, live-class, chat, and admin screens on the root stack', () => {
    const layout = read('_layout.tsx');
    [
      'course/[id]',
      'live-class/[id]',
      'chat/[id]',
      'more',
      'qibla',
      'islamic-calendar',
      'prayer-times',
      'payment',
      'privacy',
      'terms',
      'community-guidelines',
      'data-privacy',
      'admin/manage-academics',
      'admin/payments',
      'admin/users',
      'admin/privacy-requests',
      'admin/moderation',
      'admin/security',
    ].forEach((route) => {
      expect(layout).toContain(`<Stack.Screen name="${route}"`);
    });
  });

  it('keeps menu and dashboard feature entries on push navigation', () => {
    const home = read('(tabs)/index.tsx');
    const more = read('more/index.tsx');
    const courses = read('(tabs)/courses.tsx');
    const navigation = fs.readFileSync(path.join(__dirname, 'navigation.ts'), 'utf8');
    expect(home).toContain('router.push');
    expect(more).toContain('router.push');
    expect(courses).toContain('router.push');
    expect(home).not.toContain('router.replace(`/course/');
    expect(more).not.toContain('router.replace(item.route');
    expect(courses).not.toContain('router.replace(path');
    expect(navigation).toContain('router.canGoBack()');
    expect(navigation).toContain('router.replace(fallback)');
  });

  it('does not keep a permanent startup navigation lock after auth redirects', () => {
    const layout = read('_layout.tsx');
    const navigation = fs.readFileSync(path.join(__dirname, 'navigation.ts'), 'utf8');
    expect(layout).not.toContain('navigationLockedRef.current = true');
    expect(navigation).toContain('STARTUP_NAVIGATION_LOCK_MS');
    expect(navigation).toContain('currentLock?.href === hrefKey');
    expect(navigation).toContain('delete g[STARTUP_NAVIGATION_LOCK_KEY]');
  });

});
