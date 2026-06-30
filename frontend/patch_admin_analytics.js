const fs = require('fs');
const f = 'app/admin/analytics.tsx';
let content = fs.readFileSync(f, 'utf8');

content = content.replace(
  `metricCard: {
      backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl,
      padding: SPACING.md, ...SHADOWS.card, gap: 6,
    },`,
  `metricCard: {
      backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl,
      padding: SPACING.lg, ...SHADOWS.card, gap: 10,
      borderWidth: 1, borderColor: COLORS.border,
    },`
);

content = content.replace(
  `metricIcon: {
      width: 36, height: 36, borderRadius: 18,
      alignItems: 'center', justifyContent: 'center', marginBottom: 2,
    },
    metricLabel: { color: COLORS.textMuted, fontSize: 12, fontWeight: '600' },
    metricValue: { color: COLORS.primary, fontSize: 22, fontWeight: '800' },
    metricSub: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },`,
  `metricIcon: {
      width: 44, height: 44, borderRadius: 22,
      alignItems: 'center', justifyContent: 'center', marginBottom: 4,
    },
    metricLabel: { color: COLORS.textMuted, fontSize: 13, fontWeight: '700' },
    metricValue: { color: COLORS.textMain, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
    metricSub: { color: COLORS.textMuted, fontSize: 12, marginTop: 4, fontWeight: '500' },`
);

content = content.replace(
  `title: { color: COLORS.primary, fontSize: 22, fontWeight: '800' },
  subtitle: { color: COLORS.textMuted, fontSize: 13 },`,
  `title: { color: COLORS.textMain, fontSize: 26, fontWeight: '900' },
  subtitle: { color: COLORS.textMuted, fontSize: 14, marginTop: 2 },`
);

content = content.replace(
  `sectionTitle: { color: COLORS.textMain, fontSize: 16, fontWeight: '700', marginBottom: SPACING.sm, marginTop: SPACING.sm, paddingHorizontal: 4 },`,
  `sectionTitle: { color: COLORS.textMain, fontSize: 18, fontWeight: '800', marginBottom: SPACING.md, marginTop: SPACING.md, paddingHorizontal: 4 },`
);

fs.writeFileSync(f, content);
console.log('Admin Analytics UI patched');
