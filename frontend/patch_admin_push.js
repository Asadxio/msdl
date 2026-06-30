const fs = require('fs');
const f = 'app/admin/send-push.tsx';
let content = fs.readFileSync(f, 'utf8');

content = content.replace(
  `h: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
    label: { marginTop: 12, marginBottom: 6, color: '#333' },`,
  `h: { fontSize: 22, fontWeight: '800', marginBottom: SPACING.md, color: COLORS.textMain },
    label: { marginTop: SPACING.md, marginBottom: 8, color: COLORS.textMain, fontWeight: '700', fontSize: 14 },`
);

content = content.replace(
  `input: {
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: RADIUS.lg,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      color: COLORS.textMain,
      fontSize: 14,
    },`,
  `input: {
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: RADIUS.lg,
      paddingHorizontal: SPACING.md,
      paddingVertical: 14,
      color: COLORS.textMain,
      fontSize: 15,
      ...SHADOWS.card,
    },`
);

content = content.replace(
  `btn: {
      backgroundColor: COLORS.primary,
      padding: SPACING.md,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      marginTop: SPACING.xl,
    },
    btnText: { color: '#fff', fontWeight: 'bold' },`,
  `btn: {
      backgroundColor: COLORS.primary,
      padding: 16,
      borderRadius: RADIUS.full,
      alignItems: 'center',
      marginTop: SPACING.xxl,
      shadowColor: COLORS.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    btnText: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 0.5 },`
);

fs.writeFileSync(f, content);
console.log('Admin Send Push UI patched');
