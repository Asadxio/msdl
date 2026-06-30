const fs = require('fs');
const f = 'app/admin/manage-academics.tsx';
let content = fs.readFileSync(f, 'utf8');

content = content.replace(
  `section: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.md, gap: 8, ...SHADOWS.card },`,
  `section: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.lg, gap: 12, ...SHADOWS.card, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 },`
);

content = content.replace(
  `sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.primary, marginBottom: 2 },`,
  `sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.primary, marginBottom: 4 },`
);

content = content.replace(
  `itemRow: {
      flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8,
      borderTopWidth: 1, borderTopColor: COLORS.border,
    },`,
  `itemRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12,
      borderTopWidth: 1, borderTopColor: COLORS.border,
    },`
);

content = content.replace(
  `itemTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textMain },
    itemMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },`,
  `itemTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textMain },
    itemMeta: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },`
);

content = content.replace(
  `input: {
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 10,
      color: COLORS.textMain,
      fontSize: 14,
    },`,
  `input: {
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: RADIUS.lg,
      paddingHorizontal: SPACING.md,
      paddingVertical: 12,
      color: COLORS.textMain,
      fontSize: 15,
    },`
);

content = content.replace(
  `primaryBtn: {
      backgroundColor: COLORS.primary,
      paddingVertical: 12,
      paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.lg,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
    },
    primaryBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },`,
  `primaryBtn: {
      backgroundColor: COLORS.primary,
      paddingVertical: 14,
      paddingHorizontal: SPACING.lg,
      borderRadius: RADIUS.full,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },`
);

content = content.replace(
  `secondaryBtn: {
      backgroundColor: COLORS.surfaceAlt,
      paddingVertical: 12,
      paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.lg,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
    },
    secondaryBtnText: { color: COLORS.primary, fontWeight: 'bold', fontSize: 14 },`,
  `secondaryBtn: {
      backgroundColor: '#E8F5EE',
      paddingVertical: 14,
      paddingHorizontal: SPACING.lg,
      borderRadius: RADIUS.full,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    secondaryBtnText: { color: COLORS.primary, fontWeight: '800', fontSize: 15 },`
);

fs.writeFileSync(f, content);
console.log('Admin Academics UI patched');
