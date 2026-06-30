const fs = require('fs');
const path = require('path');

const TABS_DIR = 'app/(tabs)';
const TABS = ['courses.tsx', 'library.tsx', 'quiz.tsx', 'attendance.tsx', 'teachers.tsx', 'notifications.tsx'];

const standardHeader = `header: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    ...SHADOWS.header,
  },`;

const standardTitle = `fontSize: 24, fontWeight: '800', color: COLORS.primary`;
const standardCard = `backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, ...SHADOWS.card`;

function patchFile(filename) {
  const filePath = path.join(TABS_DIR, filename);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  // Fix header
  content = content.replace(/header:\s*\{[^}]*\},/g, standardHeader);

  // Fix title / headerTitle
  content = content.replace(/headerTitle:\s*\{[^}]*\},/g, `headerTitle: { ${standardTitle} },`);
  content = content.replace(/title:\s*\{[^}]*\},/g, `title: { ${standardTitle} },`);

  // Fix card radii to RADIUS.xxl
  content = content.replace(/borderRadius:\s*(?:18|16|RADIUS\.lg|RADIUS\.xl)/g, 'borderRadius: RADIUS.xxl');

  fs.writeFileSync(filePath, content);
  console.log('Patched', filename);
}

TABS.forEach(patchFile);
