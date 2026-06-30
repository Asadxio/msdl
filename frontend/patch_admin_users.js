const fs = require('fs');
const f = 'app/admin/users.tsx';
let content = fs.readFileSync(f, 'utf8');

content = content.replace(
  `userCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.md, ...SHADOWS.card },`,
  `userCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.lg, ...SHADOWS.card, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 },`
);

content = content.replace(
  `roleBadge: { backgroundColor: COLORS.surfaceAlt, paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.sm, marginLeft: 'auto' },
  roleBadgeText: { fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase', fontWeight: '800' },`,
  `roleBadge: { backgroundColor: '#E8F5EE', paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full, marginLeft: 'auto' },
  roleBadgeText: { fontSize: 11, color: COLORS.primary, textTransform: 'uppercase', fontWeight: '800', letterSpacing: 0.5 },`
);

content = content.replace(
  `statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.sm },
  statusActive: { backgroundColor: '#d1fae5' },
  statusInactive: { backgroundColor: '#fee2e2' },
  statusTextActive: { fontSize: 10, color: '#065f46', fontWeight: '700' },
  statusTextInactive: { fontSize: 10, color: '#991b1b', fontWeight: '700' },`,
  `statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full, alignSelf: 'flex-start', marginTop: 8 },
  statusActive: { backgroundColor: '#E8F5EE' },
  statusInactive: { backgroundColor: '#FDECEC' },
  statusTextActive: { fontSize: 11, color: COLORS.primary, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  statusTextInactive: { fontSize: 11, color: COLORS.error, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },`
);

content = content.replace(
  `searchInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    color: COLORS.textMain,
    fontSize: 14,
  },`,
  `searchInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    color: COLORS.textMain,
    fontSize: 15,
    ...SHADOWS.card,
  },`
);

content = content.replace(
  `avatarBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },`,
  `avatarBox: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E8F5EE', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(6, 78, 59, 0.1)' },`
);

content = content.replace(
  `name: { fontSize: 14, fontWeight: '700', color: COLORS.textMain },
  email: { fontSize: 12, color: COLORS.textMuted },`,
  `name: { fontSize: 16, fontWeight: '800', color: COLORS.textMain, marginBottom: 2 },
  email: { fontSize: 13, color: COLORS.textMuted },`
);

fs.writeFileSync(f, content);
console.log('Admin Users UI patched');
